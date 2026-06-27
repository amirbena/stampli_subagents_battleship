package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.*;
import com.stampli.battleship.repository.GameRepository;
import com.stampli.battleship.repository.MoveRepository;
import com.stampli.battleship.repository.PlayerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * Core game orchestration service.
 * <p>
 * All game rules and state transitions live here — controllers delegate to this
 * service and never implement game logic themselves. Every method that mutates
 * a {@link Game} synchronises on the game object to prevent concurrent-shot races.
 */
@Service
public class GameService {

    private final GameRepository gameRepository;
    private final PlacementValidationService placementValidationService;
    private final ComputerPlayerService computerPlayerService;
    private final PlayerRepository playerRepository;
    private final MoveRepository moveRepository;
    private final ComputerMoveDelay computerMoveDelay;
    // Cryptographically strong source for per-seat session tokens (belonging secrets).
    private final SecureRandom secureRandom = new SecureRandom();

    public GameService(GameRepository gameRepository,
                       PlacementValidationService placementValidationService,
                       ComputerPlayerService computerPlayerService,
                       PlayerRepository playerRepository,
                       MoveRepository moveRepository,
                       ComputerMoveDelay computerMoveDelay) {
        this.gameRepository = gameRepository;
        this.placementValidationService = placementValidationService;
        this.computerPlayerService = computerPlayerService;
        this.playerRepository = playerRepository;
        this.moveRepository = moveRepository;
        this.computerMoveDelay = computerMoveDelay;
    }

    /**
     * Creates a new human-vs-human game room and registers the first player.
     * Backward-compat delegate — anonymous player ID generated server-side.
     *
     * @return response containing the new {@code gameId} and the creator's {@code playerId}
     */
    public CreateGameResponse createGame() {
        return createGame(GameMode.HUMAN);
    }

    /**
     * Creates a new game room with the given mode and registers the first (human) player.
     * Backward-compat delegate — anonymous player ID generated server-side (AC-23).
     *
     * @param mode HUMAN or COMPUTER
     * @return response containing the new {@code gameId} and the creator's {@code playerId}
     */
    public CreateGameResponse createGame(GameMode mode) {
        return createGame(mode, null);
    }

    /**
     * Creates a new game room with the given mode and an optional persistent player identity.
     * <p>
     * When {@code playerId} is supplied: validates that a {@link PlayerProfile} exists (404 if not)
     * and uses the ID verbatim — no new UUID generated (OQ-3, AC-11/AC-12).
     * When {@code playerId} is absent/blank: generates a UUID as before (anonymous backward-compat
     * path, AC-23).
     *
     * @param mode     HUMAN or COMPUTER
     * @param playerId optional persistent player ID from {@code POST /players}; may be {@code null}
     * @return response containing the new {@code gameId} and the resolved {@code playerId}
     * @throws GameException 404 PLAYER_NOT_FOUND if a non-blank {@code playerId} has no profile
     */
    public CreateGameResponse createGame(GameMode mode, String playerId) {
        String gameId = generateGameId();
        String resolvedPlayerId = resolvePlayerId(playerId);

        // Mint the creator's per-seat belonging secret ONCE here; it is returned exactly once
        // in this response and never re-disclosed by any read endpoint.
        String sessionToken = generateSessionToken();
        Player playerA = new Player(resolvedPlayerId, gameId, sessionToken);
        Game game = new Game(gameId, playerA, mode);

        if (mode == GameMode.COMPUTER) {
            String computerId = "COMPUTER-" + UUID.randomUUID().toString();
            // Computer seat carries no token — no browser ever authenticates as the computer.
            Player computerPlayer = new Player(computerId, gameId, null);
            computerPlayerService.placeShipsRandomly(computerPlayer.getBoard());
            computerPlayer.confirmReady();
            game.addPlayerB(computerPlayer);
        }

        gameRepository.save(game);
        return new CreateGameResponse(gameId, resolvedPlayerId, game.getStatus().name(), mode.name(),
                sessionToken);
    }

    /**
     * Adds a second player to an existing game room, transitioning status to PLACING_SHIPS.
     * Backward-compat delegate — anonymous player ID generated server-side (AC-23).
     *
     * @param gameId the target game room
     * @return response containing the joiner's {@code playerId}
     * @throws GameException 409 if the room already has two players or has already started
     */
    public JoinGameResponse joinGame(String gameId) {
        return joinGame(gameId, null);
    }

    /**
     * Adds a second player to an existing game room with an optional persistent player identity.
     * <p>
     * When {@code playerId} is supplied: validates the profile exists (404 if not) and uses it
     * verbatim as {@code playerB} (AC-13). When absent: generates as before (AC-23).
     *
     * @param gameId   the target game room
     * @param playerId optional persistent player ID; may be {@code null}
     * @return response containing the joiner's {@code playerId}
     * @throws GameException 404 PLAYER_NOT_FOUND if a non-blank {@code playerId} has no profile
     * @throws GameException 409 if the room already has two players or has already started
     */
    public JoinGameResponse joinGame(String gameId, String playerId) {
        Game game = findGameOrThrow(gameId);
        // Synchronize to prevent two concurrent joins filling the same slot
        synchronized (game) {
            // Belonging contract: every non-admit case (COMPUTER game with no open seat / full /
            // already started / second seat taken) collapses to the SAME generic 404 so no seat
            // state, game type, or existence is leaked to a non-admit caller (AC-10, AC-11).
            // COMPUTER games always have playerB pre-filled, so they fall through here too — a
            // join is therefore never offered for COMPUTER games.
            if (game.getStatus() != GameStatus.WAITING_FOR_PLAYERS || game.getPlayerB() != null) {
                throw notJoinable();
            }
            String resolvedPlayerId = resolvePlayerId(playerId);
            // Mint the joiner's OWN per-seat secret — never Player A's. The joiner belongs as a
            // brand-new, distinct identity; it can never inherit the creator's seat or token.
            String sessionToken = generateSessionToken();
            Player playerB = new Player(resolvedPlayerId, gameId, sessionToken);
            game.addPlayerB(playerB);
            gameRepository.save(game);
            return new JoinGameResponse(gameId, resolvedPlayerId, game.getStatus().name(), sessionToken);
        }
    }

    /**
     * Resolves a player ID for game creation/joining.
     * <p>
     * If {@code playerId} is non-blank: validates the profile exists and returns it verbatim.
     * If blank/null: generates a new UUID (anonymous path).
     *
     * @param playerId raw player ID from request (may be null/blank)
     * @return the resolved player ID to use
     * @throws GameException 404 PLAYER_NOT_FOUND if a non-blank ID has no profile
     */
    private String resolvePlayerId(String playerId) {
        if (playerId != null && !playerId.isBlank()) {
            playerRepository.findById(playerId)
                    .orElseThrow(() -> new GameException(
                            "Player not found", "PLAYER_NOT_FOUND", HttpStatus.NOT_FOUND));
            return playerId;
        }
        return UUID.randomUUID().toString();
    }

    /**
     * Places a single ship on the player's board.
     * <p>
     * Validates that the ship fits within the 10×10 boundary and does not
     * overlap any previously placed ship. Each {@link ShipType} may only be
     * placed once per player.
     *
     * @param gameId      the target game
     * @param playerId    the placing player
     * @param shipType    which ship to place
     * @param anchor      top-left (horizontal) or top (vertical) starting coordinate
     * @param orientation HORIZONTAL or VERTICAL
     * @return the computed cells that the ship now occupies
     * @throws GameException 409 if the game is in progress or finished
     * @throws GameException 400 if placement is out of bounds or overlaps another ship
     */
    public PlaceShipResponse placeShip(String gameId, String playerId, String sessionToken,
                                       ShipType shipType, Coordinate anchor, Orientation orientation) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            // Allow placement in both WAITING_FOR_PLAYERS (Player A pre-places before opponent joins)
            // and PLACING_SHIPS (both players present). Block only once the game is underway.
            if (game.getStatus() == GameStatus.IN_PROGRESS || game.getStatus() == GameStatus.FINISHED) {
                throw new GameException("Ships can only be placed before the game starts",
                        "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            Player player = getPlayerOrThrow(game, playerId);
            Board board = player.getBoard();

            placementValidationService.validateNotAlreadyPlaced(board, shipType);
            placementValidationService.validate(board, shipType, anchor, orientation);

            List<Coordinate> cells = Board.computeCells(shipType, anchor, orientation);
            Ship ship = new Ship(shipType, cells, orientation);
            board.placeShip(ship);
            gameRepository.save(game);

            List<CellStateDto> cellDtos = cells.stream()
                    .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                    .collect(Collectors.toList());
            return new PlaceShipResponse(shipType.name(), cellDtos);
        }
    }

    /**
     * Removes a previously placed ship from the player's board, allowing repositioning.
     *
     * @param gameId   the target game
     * @param playerId the requesting player
     * @param shipType the ship to remove
     * @throws GameException 409 if the game is in progress or finished
     * @throws GameException 400 if the ship has not been placed yet
     */
    public void removeShip(String gameId, String playerId, String sessionToken, ShipType shipType) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            // Mirror placeShip policy: removal is allowed in pre-game phases so players can reposition.
            if (game.getStatus() == GameStatus.IN_PROGRESS || game.getStatus() == GameStatus.FINISHED) {
                throw new GameException("Ships can only be removed before the game starts",
                        "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            Player player = getPlayerOrThrow(game, playerId);
            Board board = player.getBoard();

            Optional<Ship> shipOpt = board.getShips().stream()
                    .filter(s -> s.getType() == shipType)
                    .findFirst();
            if (shipOpt.isEmpty()) {
                throw new GameException("Ship type " + shipType + " is not placed",
                        "SHIP_NOT_PLACED", HttpStatus.BAD_REQUEST);
            }
            board.removeShip(shipOpt.get());
            gameRepository.save(game);
        }
    }

    /**
     * Marks a player as ready. If both players are ready, transitions the game to IN_PROGRESS
     * and assigns the first turn to playerA (human always goes first in vs-computer mode).
     *
     * @param gameId   the target game
     * @param playerId the player confirming their fleet
     * @return response containing updated status and the current turn player (if game started)
     * @throws GameException 409 if game is not in PLACING_SHIPS phase or player is already ready
     * @throws GameException 400 if the player has not placed all 5 ships
     */
    public ConfirmReadyResponse setReady(String gameId, String playerId, String sessionToken) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            if (game.getStatus() != GameStatus.PLACING_SHIPS) {
                throw new GameException("Cannot confirm ready outside of PLACING_SHIPS phase",
                        "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            Player player = getPlayerOrThrow(game, playerId);
            if (player.isReady()) {
                throw new GameException("Player is already ready", "ALREADY_READY", HttpStatus.CONFLICT);
            }
            if (!player.getBoard().hasAllShipsPlaced()) {
                throw new GameException("All 5 ships must be placed before confirming ready",
                        "FLEET_INCOMPLETE", HttpStatus.BAD_REQUEST);
            }
            player.confirmReady();

            Player opponent = game.getOpponent(playerId);
            String message;
            if (opponent != null && opponent.isReady()) {
                game.startGame();
                message = "Game started!";
            } else {
                message = "Waiting for opponent to confirm";
            }
            gameRepository.save(game);
            return new ConfirmReadyResponse(gameId, playerId, game.getStatus().name(),
                    message, game.getCurrentTurnPlayerId());
        }
    }

    /**
     * Fires a shot at the opponent's board on behalf of the requesting player.
     * <p>
     * Enforces turn order and prevents duplicate shots. Returns {@code WIN} internally
     * when the last opponent ship is sunk; the API response maps this to {@code SUNK}
     * and populates {@code winnerId} so the external contract stays clean.
     * <p>
     * In COMPUTER mode, after a valid human shot (that doesn't win), the computer
     * immediately fires back. The human always retains the next turn.
     *
     * @param gameId     the target game
     * @param playerId   the shooting player
     * @param coordinate the target cell (row and col must be 0–9)
     * @return shot result, sunk ship type (if any), next turn player, winner (if game ended),
     *         and computer shot details (if mode is COMPUTER)
     * @throws GameException 409 if game is not IN_PROGRESS or it is not this player's turn
     * @throws GameException 400 if coordinate is out of bounds or already targeted
     */
    public FireShotResponse fireShot(String gameId, String playerId, String sessionToken,
                                     Coordinate coordinate) {
        Game game = findGameOrThrow(gameId);
        // Synchronize on the Game to prevent two concurrent shots corrupting the same turn
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            if (game.getStatus() != GameStatus.IN_PROGRESS) {
                throw new GameException("Cannot fire outside of IN_PROGRESS phase",
                        "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            if (!playerId.equals(game.getCurrentTurnPlayerId())) {
                throw new GameException("It is not your turn", "NOT_YOUR_TURN", HttpStatus.CONFLICT);
            }
            if (!coordinate.isValid()) {
                throw new GameException("Coordinate is out of bounds", "INVALID_COORDINATE", HttpStatus.BAD_REQUEST);
            }

            Player opponent = game.getOpponent(playerId);
            Board opponentBoard = opponent.getBoard();

            boolean alreadyFired = game.getShotHistory().stream()
                    .filter(s -> s.getPlayerId().equals(playerId))
                    .anyMatch(s -> s.getCoordinate().equals(coordinate));
            if (alreadyFired) {
                throw new GameException("Already fired at this coordinate", "ALREADY_FIRED", HttpStatus.BAD_REQUEST);
            }

            // --- Resolve human shot ---
            Optional<Ship> hitShip = opponentBoard.shipAt(coordinate);
            ShotResult result;
            String sunkShipType = null;

            if (hitShip.isPresent()) {
                Ship ship = hitShip.get();
                ship.recordHit(coordinate);
                if (ship.isSunk()) {
                    if (opponentBoard.allShipsSunk()) {
                        result = ShotResult.WIN;
                    } else {
                        result = ShotResult.SUNK;
                    }
                    sunkShipType = ship.getType().name();
                } else {
                    result = ShotResult.HIT;
                }
            } else {
                opponentBoard.recordMiss(coordinate);
                result = ShotResult.MISS;
            }

            Shot shot = new Shot(playerId, coordinate, result);
            game.addShot(shot);
            recordMove(gameId, shot);

            String nextTurnPlayerId = null;
            String winnerId = null;

            if (result == ShotResult.WIN) {
                game.finishGame(playerId);
                winnerId = playerId;
            } else {
                // In HUMAN mode: alternate turns. In COMPUTER mode: human always goes next.
                if (game.getGameMode() == GameMode.COMPUTER) {
                    // Computer will fire immediately below; human goes again after
                    game.setCurrentTurnPlayerId(playerId);
                    nextTurnPlayerId = playerId;
                } else {
                    Player playerA = game.getPlayerA();
                    Player playerB = game.getPlayerB();
                    String nextPlayer = playerId.equals(playerA.getId()) ? playerB.getId() : playerA.getId();
                    game.setCurrentTurnPlayerId(nextPlayer);
                    nextTurnPlayerId = nextPlayer;
                }
            }

            // Map WIN → SUNK in the external response; winnerId carries the win signal instead
            String externalResult = (result == ShotResult.WIN) ? ShotResult.SUNK.name() : result.name();

            // --- Computer fires back (only if game still in progress and mode is COMPUTER) ---
            ComputerShotDto computerShotDto = null;
            if (game.getGameMode() == GameMode.COMPUTER && game.getStatus() == GameStatus.IN_PROGRESS) {
                // "Thinking" pause so the computer does not fire back instantly. Placed only on the
                // path that actually fires the computer shot, so HUMAN mode and the human-wins path
                // (status already FINISHED) never wait. The human's shot above is already applied to
                // the shared Game reference and getGameState reads without this monitor, so a poll
                // during the wait shows the human's result while the computer's shot is still pending.
                computerMoveDelay.await();

                Player computer = game.getOpponent(playerId);
                Coordinate compCoord = computerPlayerService.selectShot(game, computer.getId());

                if (compCoord != null) {
                    Board humanBoard = game.getPlayer(playerId).getBoard();
                    Optional<Ship> compHitShip = humanBoard.shipAt(compCoord);
                    ShotResult compResult;
                    String compSunkShipType = null;

                    if (compHitShip.isPresent()) {
                        Ship compShip = compHitShip.get();
                        compShip.recordHit(compCoord);
                        if (compShip.isSunk()) {
                            if (humanBoard.allShipsSunk()) {
                                compResult = ShotResult.WIN;
                            } else {
                                compResult = ShotResult.SUNK;
                            }
                            compSunkShipType = compShip.getType().name();
                        } else {
                            compResult = ShotResult.HIT;
                        }
                    } else {
                        humanBoard.recordMiss(compCoord);
                        compResult = ShotResult.MISS;
                    }

                    Shot compShot = new Shot(computer.getId(), compCoord, compResult);
                    game.addShot(compShot);
                    recordMove(gameId, compShot);

                    String compWinnerId = null;
                    if (compResult == ShotResult.WIN) {
                        game.finishGame(computer.getId());
                        compWinnerId = computer.getId();
                        nextTurnPlayerId = null;
                    }
                    // Human always goes next (currentTurnPlayerId stays as playerId, already set above)

                    String compExternalResult = (compResult == ShotResult.WIN) ? ShotResult.SUNK.name() : compResult.name();
                    computerShotDto = new ComputerShotDto(
                            compCoord.getRow(), compCoord.getCol(),
                            compExternalResult, compSunkShipType,
                            compWinnerId, game.getStatus().name()
                    );

                    // Update outer winnerId and nextTurnPlayerId if computer won
                    if (compResult == ShotResult.WIN) {
                        winnerId = compWinnerId;
                        nextTurnPlayerId = null;
                    }
                }
            }

            gameRepository.save(game);

            return new FireShotResponse(
                    coordinate.getRow(), coordinate.getCol(),
                    externalResult, sunkShipType,
                    nextTurnPlayerId, game.getStatus().name(), winnerId,
                    computerShotDto
            );
        }
    }

    /**
     * Returns a sanitised view of the game for the requesting player.
     * <p>
     * The opponent board included in the response contains <em>only sunk ships</em>.
     * Un-hit and partially-hit ship positions are never sent to the client.
     *
     * @param gameId   the target game
     * @param playerId the requesting player (determines which board is "mine" vs "opponent")
     * @return sanitised game state safe to deliver to the client
     * @throws GameException 404 if game not found, 403 if player is not in this game
     */
    public GameStateResponse getGameState(String gameId, String playerId, String sessionToken) {
        Game game = findGameOrThrow(gameId);
        // SECURITY: the state read returns boards/turn. A non-owner must receive the SAME generic
        // 404 as a missing game, so an outsider cannot confirm the game exists or whose turn it is.
        if (!game.ownsSeat(playerId, sessionToken)) {
            throw notFound();
        }
        Player me = game.getPlayer(playerId);
        Player opponent = game.getOpponent(playerId);

        BoardStateDto myBoardDto = buildMyBoardDto(me.getBoard());
        BoardStateDto opponentBoardDto = buildOpponentBoardDto(opponent, game, playerId);

        boolean myReady = me.isReady();
        boolean opponentReady = opponent != null && opponent.isReady();

        return new GameStateResponse(
                gameId,
                game.getStatus().name(),
                game.getCurrentTurnPlayerId(),
                game.getWinnerPlayerId(),
                myBoardDto,
                opponentBoardDto,
                myReady,
                opponentReady,
                game.getGameMode() != null ? game.getGameMode().name() : null
        );
    }

    /**
     * Resolves a saved COMPUTER game from its code (the gameId, also used as the room code)
     * so the client can rehydrate its session pointer after a refresh or fresh device.
     * <p>
     * Read-only — no mutation, no synchronization. Returns only the session pointer fields
     * ({@code gameId}, the human owner's {@code playerId} = playerA, {@code gameMode},
     * {@code status}); it returns NO board or ship data, so the existing hidden-data boundary
     * on {@code getGameState} remains the single source of visibility rules.
     * <p>
     * A non-existent code AND a code that maps to a non-COMPUTER game both yield the same
     * uniform 404 GAME_NOT_FOUND — restore-by-code is computer-only, and reporting human
     * games as plain not-found avoids disclosing the existence/type of other games.
     *
     * @param code the existing game identifier used as the room code
     * @return the session pointer for the resolved COMPUTER game
     * @throws GameException 404 GAME_NOT_FOUND if the game does not exist or is not a COMPUTER game
     */
    public RestoreGameResponse restoreGame(String code, String playerId, String sessionToken) {
        Optional<Game> gameOpt = gameRepository.findById(code);
        // Generic not-found for a missing game — never disclose existence to an unproven caller.
        if (gameOpt.isEmpty()) {
            throw notFound();
        }
        Game game = gameOpt.get();
        // Belonging is required: the caller must already hold the seat's minted token. Missing
        // game, terminal game, and any non-owning caller (incl. foreign browser, COMPUTER seat
        // attempt, stolen playerId without token) all surface the SAME generic 404 — no identity,
        // mode, status, or seat data leaks. Restore serves BOTH modes (Team Lead decision): once
        // belonging is token-proven it only ever confirms the caller's own seat, never discovers one.
        if (game.getStatus() == GameStatus.FINISHED || !game.ownsSeat(playerId, sessionToken)) {
            throw notFound();
        }
        // The returned playerId is the caller's OWN proven id, echoed back — never discovered.
        return new RestoreGameResponse(
                game.getId(),
                playerId,
                game.getGameMode().name(),
                game.getStatus().name());
    }

    /**
     * Pauses an active game on behalf of a participant.
     * <p>
     * Records the pre-pause phase so {@link #resumeGame} can restore it exactly.
     * Ownership is validated via the same {@code getPlayerOrThrow} path as fireShot/setReady.
     *
     * @param gameId   the target game
     * @param playerId the requesting participant
     * @return the transition result (status PAUSED, previousStatus = prior phase)
     * @throws GameException 404 GAME_NOT_FOUND if the game does not exist
     * @throws GameException 403 PLAYER_NOT_IN_GAME if the caller is not a participant
     * @throws GameException 409 WRONG_PHASE if the game is already PAUSED or FINISHED
     */
    public PauseResumeResponse pauseGame(String gameId, String playerId, String sessionToken) {
        Game game = findGameOrThrow(gameId);
        // Synchronize so a pause cannot race a concurrent shot/join on the same game
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            GameStatus previous = game.getStatus();
            try {
                game.pause();
            } catch (IllegalStateException e) {
                // Domain rejects pause from PAUSED/FINISHED — surface as 409 WRONG_PHASE
                throw new GameException(e.getMessage(), "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            gameRepository.save(game);
            return new PauseResumeResponse(gameId, game.getStatus(), previous);
        }
    }

    /**
     * Resumes a paused game on behalf of a participant, restoring the pre-pause phase.
     *
     * @param gameId   the target game
     * @param playerId the requesting participant
     * @return the transition result (status = restored prior phase, previousStatus = PAUSED)
     * @throws GameException 404 GAME_NOT_FOUND if the game does not exist
     * @throws GameException 403 PLAYER_NOT_IN_GAME if the caller is not a participant
     * @throws GameException 409 WRONG_PHASE if the game is not currently PAUSED
     */
    public PauseResumeResponse resumeGame(String gameId, String playerId, String sessionToken) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
            requireOwnership(game, playerId, sessionToken);
            try {
                game.resume();
            } catch (IllegalStateException e) {
                // Domain rejects resume from any non-PAUSED status — surface as 409 WRONG_PHASE
                throw new GameException(e.getMessage(), "WRONG_PHASE", HttpStatus.CONFLICT);
            }
            gameRepository.save(game);
            return new PauseResumeResponse(gameId, game.getStatus(), GameStatus.PAUSED);
        }
    }

    /**
     * Stops (terminally removes) a game session on behalf of a participant.
     * <p>
     * Idempotent: if the game is already absent this is a no-op (the client treats an
     * already-gone game as already-stopped). When the game exists, the caller must be a
     * participant before deletion.
     *
     * @param gameId   the target game
     * @param playerId the requesting participant
     * @throws GameException 403 PLAYER_NOT_IN_GAME if the game exists but the caller is not a participant
     */
    public void stopGame(String gameId, String playerId, String sessionToken) {
        Optional<Game> gameOpt = gameRepository.findById(gameId);
        // Idempotent: a missing game is already stopped — no error, no-op
        if (gameOpt.isEmpty()) {
            return;
        }
        Game game = gameOpt.get();
        synchronized (game) {
            // Belonging is enforced only while the game still exists; stop stays idempotent for
            // the rightful owner but a non-owner (bad/absent token) is rejected with 403.
            requireOwnership(game, playerId, sessionToken);
            gameRepository.delete(gameId);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private Game findGameOrThrow(String gameId) {
        return gameRepository.findById(gameId)
                .orElseThrow(() -> new GameException("Game not found: " + gameId,
                        "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));
    }

    /**
     * Enforces seat belonging before any membership/turn/phase logic on an authenticated action.
     * A stolen or guessed {@code playerId} without the matching per-seat token is rejected with
     * {@code 403 NOT_AUTHORIZED}, exposing no board, turn, or hidden-ship data.
     *
     * @throws GameException 403 NOT_AUTHORIZED if the caller does not own the seat
     */
    private void requireOwnership(Game game, String playerId, String sessionToken) {
        if (!game.ownsSeat(playerId, sessionToken)) {
            throw new GameException("Not authorized for this seat", "NOT_AUTHORIZED", HttpStatus.FORBIDDEN);
        }
    }

    /** The single generic not-found/not-belonging response — identical body in every case (no leakage). */
    private GameException notFound() {
        return new GameException("Game not found or not joinable", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND);
    }

    /** Generic not-joinable response for every non-admit join case — same shape as {@link #notFound()}. */
    private GameException notJoinable() {
        return notFound();
    }

    /**
     * Generates an opaque, high-entropy per-seat session token (32 SecureRandom bytes,
     * base64url, no padding → ~256 bits, 43 chars). Distinct from the playerId and never
     * re-disclosed after the single mint response.
     */
    private String generateSessionToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private Player getPlayerOrThrow(Game game, String playerId) {
        Player player = game.getPlayer(playerId);
        if (player == null) {
            throw new GameException("Player not in game", "PLAYER_NOT_IN_GAME", HttpStatus.FORBIDDEN);
        }
        return player;
    }

    /** Builds the full board view for the player who owns it — all ships and missed shots visible. */
    private BoardStateDto buildMyBoardDto(Board board) {
        List<ShipDto> shipDtos = board.getShips().stream()
                .map(ship -> new ShipDto(
                        ship.getType().name(),
                        ship.getCells().stream()
                                .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                                .collect(Collectors.toList()),
                        ship.getHits().stream()
                                .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                                .collect(Collectors.toList()),
                        ship.isSunk()
                ))
                .collect(Collectors.toList());

        List<CellStateDto> missedShots = board.getMissedShots().stream()
                .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                .collect(Collectors.toList());

        // Own-board hits are already conveyed via ships[].hits; the flat hits array is unused here.
        return new BoardStateDto(shipDtos, missedShots, new ArrayList<>());
    }

    /**
     * Builds the sanitised opponent board view.
     * <p>
     * SECURITY: Only sunk ships are included — their full cell list is safe to reveal
     * because the ship is already destroyed. Un-hit and partially-hit ship positions
     * must never be sent to the requesting player.
     */
    private BoardStateDto buildOpponentBoardDto(Player opponent, Game game, String requestingPlayerId) {
        if (opponent == null) {
            return new BoardStateDto(new ArrayList<>(), new ArrayList<>(), new ArrayList<>());
        }

        Board opponentBoard = opponent.getBoard();

        // SECURITY: filter to sunk ships only — never expose un-hit or partial ship positions
        List<ShipDto> sunkShips = opponentBoard.getShips().stream()
                .filter(Ship::isSunk)
                .map(ship -> new ShipDto(
                        ship.getType().name(),
                        ship.getCells().stream()
                                .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                                .collect(Collectors.toList()),
                        ship.getHits().stream()
                                .map(c -> new CellStateDto(c.getRow(), c.getCol()))
                                .collect(Collectors.toList()),
                        true
                ))
                .collect(Collectors.toList());

        // Only include missed shots fired by the requesting player — not the opponent's misses
        List<CellStateDto> myMissedShots = game.getShotHistory().stream()
                .filter(s -> s.getPlayerId().equals(requestingPlayerId))
                .filter(s -> s.getResult() == ShotResult.MISS)
                .map(s -> new CellStateDto(s.getCoordinate().getRow(), s.getCoordinate().getCol()))
                .collect(Collectors.toList());

        // SECURITY: only the requesting player's own HIT shots, sourced from authoritative
        // shot history — never from ship cell lists. A non-sunk ship's un-fired cells are not
        // in shot history, so they can never leak. Sinking shots are stored as SUNK (not HIT),
        // so those cells arrive via sunkShips instead and are excluded from this list.
        List<CellStateDto> myHitShots = game.getShotHistory().stream()
                .filter(s -> s.getPlayerId().equals(requestingPlayerId))
                .filter(s -> s.getResult() == ShotResult.HIT)
                .map(s -> new CellStateDto(s.getCoordinate().getRow(), s.getCoordinate().getCol()))
                .collect(Collectors.toList());

        return new BoardStateDto(sunkShips, myMissedShots, myHitShots);
    }

    /**
     * Records a shot as a persistent {@link Move} entry.
     * <p>
     * Coordinate mapping: {@code x = col}, {@code y = row} (standard screen convention).
     * {@code ShotResult.WIN} is normalised to {@code MoveResult.SUNK} — WIN is an internal
     * engine signal and must never be persisted (AC-19).
     * Called for every shot: human and computer alike (AC-20).
     *
     * @param gameId the game this shot belongs to
     * @param shot   the authoritative Shot just added to the game's history
     */
    private void recordMove(String gameId, Shot shot) {
        MoveResult mr;
        if (shot.getResult() == ShotResult.WIN) {
            mr = MoveResult.SUNK; // WIN → SUNK normalisation (AC-19)
        } else {
            mr = MoveResult.valueOf(shot.getResult().name()); // MISS/HIT/SUNK direct mapping
        }
        Move move = new Move(
                UUID.randomUUID().toString(),
                gameId,
                shot.getPlayerId(),
                shot.getCoordinate().getCol(),  // x = col (architecture §2.2)
                shot.getCoordinate().getRow(),  // y = row (architecture §2.2)
                mr,
                shot.getFiredAt()               // createdAt sourced from Shot.firedAt (AC-19)
        );
        moveRepository.save(move);
    }

    /** Generates a 6-character alphanumeric room code (e.g. "A3K9XZ"). */
    private String generateGameId() {
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        StringBuilder sb = new StringBuilder(6);
        for (int i = 0; i < 6; i++) {
            sb.append(chars.charAt(ThreadLocalRandom.current().nextInt(chars.length())));
        }
        return sb.toString();
    }
}
