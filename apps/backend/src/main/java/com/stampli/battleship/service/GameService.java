package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.*;
import com.stampli.battleship.repository.GameRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
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

    public GameService(GameRepository gameRepository,
                       PlacementValidationService placementValidationService,
                       ComputerPlayerService computerPlayerService) {
        this.gameRepository = gameRepository;
        this.placementValidationService = placementValidationService;
        this.computerPlayerService = computerPlayerService;
    }

    /**
     * Creates a new human-vs-human game room and registers the first player.
     *
     * @return response containing the new {@code gameId} and the creator's {@code playerId}
     */
    public CreateGameResponse createGame() {
        return createGame(GameMode.HUMAN);
    }

    /**
     * Creates a new game room with the given mode and registers the first (human) player.
     * When mode is COMPUTER, the computer player is immediately set up and marked ready.
     *
     * @param mode HUMAN or COMPUTER
     * @return response containing the new {@code gameId} and the creator's {@code playerId}
     */
    public CreateGameResponse createGame(GameMode mode) {
        String gameId = generateGameId();
        String playerId = UUID.randomUUID().toString();
        Player playerA = new Player(playerId, gameId);
        Game game = new Game(gameId, playerA, mode);

        if (mode == GameMode.COMPUTER) {
            String computerId = "COMPUTER-" + UUID.randomUUID().toString();
            Player computerPlayer = new Player(computerId, gameId);
            computerPlayerService.placeShipsRandomly(computerPlayer.getBoard());
            computerPlayer.confirmReady();
            game.addPlayerB(computerPlayer);
        }

        gameRepository.save(game);
        return new CreateGameResponse(gameId, playerId, game.getStatus().name(), mode.name());
    }

    /**
     * Adds a second player to an existing game room, transitioning status to PLACING_SHIPS.
     *
     * @param gameId the target game room
     * @return response containing the joiner's {@code playerId}
     * @throws GameException 409 if the room already has two players or has already started
     */
    public JoinGameResponse joinGame(String gameId) {
        Game game = findGameOrThrow(gameId);
        // Synchronize to prevent two concurrent joins filling the same slot
        synchronized (game) {
            if (game.getStatus() != GameStatus.WAITING_FOR_PLAYERS) {
                if (game.getPlayerB() != null) {
                    throw new GameException("Game is full", "GAME_FULL", HttpStatus.CONFLICT);
                }
                throw new GameException("Game has already started", "GAME_ALREADY_STARTED", HttpStatus.CONFLICT);
            }
            if (game.getPlayerB() != null) {
                throw new GameException("Game is full", "GAME_FULL", HttpStatus.CONFLICT);
            }
            String playerId = UUID.randomUUID().toString();
            Player playerB = new Player(playerId, gameId);
            game.addPlayerB(playerB);
            gameRepository.save(game);
            return new JoinGameResponse(gameId, playerId, game.getStatus().name());
        }
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
    public PlaceShipResponse placeShip(String gameId, String playerId, ShipType shipType,
                                       Coordinate anchor, Orientation orientation) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
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
    public void removeShip(String gameId, String playerId, ShipType shipType) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
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
    public ConfirmReadyResponse setReady(String gameId, String playerId) {
        Game game = findGameOrThrow(gameId);
        synchronized (game) {
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
    public FireShotResponse fireShot(String gameId, String playerId, Coordinate coordinate) {
        Game game = findGameOrThrow(gameId);
        // Synchronize on the Game to prevent two concurrent shots corrupting the same turn
        synchronized (game) {
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
    public GameStateResponse getGameState(String gameId, String playerId) {
        Game game = findGameOrThrow(gameId);
        Player me = getPlayerOrThrow(game, playerId);
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

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private Game findGameOrThrow(String gameId) {
        return gameRepository.findById(gameId)
                .orElseThrow(() -> new GameException("Game not found: " + gameId,
                        "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));
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
