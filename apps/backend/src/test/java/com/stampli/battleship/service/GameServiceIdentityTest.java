package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.CreateGameResponse;
import com.stampli.battleship.dto.JoinGameResponse;
import com.stampli.battleship.repository.GameRepository;
import com.stampli.battleship.repository.MoveRepository;
import com.stampli.battleship.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for the identity-linkage additions to {@link GameService}:
 * <ul>
 *   <li>OQ-3: supplied {@code playerId} echoed verbatim (no new UUID)</li>
 *   <li>OQ-1: absent {@code playerId} → UUID generated (anonymous backward-compat path)</li>
 *   <li>404 on unknown profile</li>
 *   <li>{@link Game} timestamp fields (AC-17)</li>
 *   <li>Move recording: x/y mapping, firedAt, WIN→SUNK normalisation, computer sentinel (AC-19/20)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class GameServiceIdentityTest {

    @Mock
    private GameRepository gameRepository;

    @Mock
    private PlayerRepository playerRepository;

    @Mock
    private MoveRepository moveRepository;

    // Use real sub-services for placement/computer behaviour
    private PlacementValidationService placementValidationService;
    private ComputerPlayerService computerPlayerService;
    private GameService gameService;

    // Belonging token for the human seat used in fireShot scenarios.
    private static final String HUMAN_TOKEN = "human-token";

    @BeforeEach
    void setUp() {
        placementValidationService = new PlacementValidationService();
        computerPlayerService = new ComputerPlayerService(placementValidationService);
        // No-op delay double — keeps the computer "thinking" pause out of unit tests (no real sleep).
        ComputerMoveDelay noDelay = () -> { };
        gameService = new GameService(gameRepository, placementValidationService, computerPlayerService,
                playerRepository, moveRepository, noDelay);
    }

    // =========================================================================
    // createGame — identity linkage
    // =========================================================================

    @Test
    void createGame_withValidPlayerId_echoesPlayerIdVerbatim() {
        // OQ-3: supplied playerId must be used verbatim — no new UUID generated
        String suppliedId = "player-profile-uuid-1";
        PlayerProfile profile = new PlayerProfile(suppliedId, "Alex", Instant.now());
        when(playerRepository.findById(suppliedId)).thenReturn(Optional.of(profile));

        CreateGameResponse response = gameService.createGame(GameMode.HUMAN, suppliedId);

        assertThat(response.getPlayerId()).isEqualTo(suppliedId);
    }

    @Test
    void createGame_withValidPlayerId_savedGameHasCorrectPlayerAId() {
        String suppliedId = "player-profile-uuid-2";
        when(playerRepository.findById(suppliedId))
                .thenReturn(Optional.of(new PlayerProfile(suppliedId, "Bob", Instant.now())));

        gameService.createGame(GameMode.HUMAN, suppliedId);

        ArgumentCaptor<Game> captor = ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        assertThat(captor.getValue().getPlayerA().getId()).isEqualTo(suppliedId);
    }

    @Test
    void createGame_withNullPlayerId_generatesNewUuid() {
        // OQ-1: absent playerId → anonymous path, UUID generated server-side
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN, null);

        assertThat(response.getPlayerId()).isNotNull().isNotBlank();
        // Must be a valid UUID format
        assertThat(response.getPlayerId()).matches(
                "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
        // Repository must NOT have been consulted for an anonymous player
        verify(playerRepository, never()).findById(any());
    }

    @Test
    void createGame_withBlankPlayerId_generatesNewUuid() {
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN, "  ");

        assertThat(response.getPlayerId()).isNotBlank();
        verify(playerRepository, never()).findById(any());
    }

    @Test
    void createGame_withUnknownPlayerId_throws404_PLAYER_NOT_FOUND() {
        when(playerRepository.findById("ghost-id")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gameService.createGame(GameMode.HUMAN, "ghost-id"))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("PLAYER_NOT_FOUND");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(404);
                });
    }

    @Test
    void createGame_modeOnlyDelegate_generatesUuid() {
        // The existing createGame(GameMode) overload must still work (backward compat, AC-23)
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN);

        assertThat(response.getPlayerId()).isNotBlank();
        verify(playerRepository, never()).findById(any());
    }

    @Test
    void createGame_noArgsDelegate_generatesUuid() {
        // The existing no-arg createGame() overload must still work (backward compat)
        CreateGameResponse response = gameService.createGame();

        assertThat(response.getPlayerId()).isNotBlank();
    }

    // =========================================================================
    // joinGame — identity linkage (AC-13)
    // =========================================================================

    @Test
    void joinGame_withValidPlayerId_echoesPlayerIdVerbatim() {
        String suppliedId = "joiner-profile-uuid-1";
        when(playerRepository.findById(suppliedId))
                .thenReturn(Optional.of(new PlayerProfile(suppliedId, "Carol", Instant.now())));

        Game waitingGame = buildWaitingGame();
        when(gameRepository.findById(waitingGame.getId())).thenReturn(Optional.of(waitingGame));

        JoinGameResponse response = gameService.joinGame(waitingGame.getId(), suppliedId);

        assertThat(response.getPlayerId()).isEqualTo(suppliedId);
    }

    @Test
    void joinGame_withNullPlayerId_generatesNewUuid() {
        Game waitingGame = buildWaitingGame();
        when(gameRepository.findById(waitingGame.getId())).thenReturn(Optional.of(waitingGame));

        JoinGameResponse response = gameService.joinGame(waitingGame.getId(), null);

        assertThat(response.getPlayerId()).isNotBlank();
        verify(playerRepository, never()).findById(any());
    }

    @Test
    void joinGame_withUnknownPlayerId_throws404_PLAYER_NOT_FOUND() {
        String ghostId = "non-existent-uuid";
        when(playerRepository.findById(ghostId)).thenReturn(Optional.empty());

        Game waitingGame = buildWaitingGame();
        when(gameRepository.findById(waitingGame.getId())).thenReturn(Optional.of(waitingGame));

        assertThatThrownBy(() -> gameService.joinGame(waitingGame.getId(), ghostId))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("PLAYER_NOT_FOUND");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(404);
                });
    }

    @Test
    void joinGame_noArgDelegate_generatesUuid() {
        // The existing no-arg joinGame(gameId) overload must still work (backward compat, AC-23)
        Game waitingGame = buildWaitingGame();
        when(gameRepository.findById(waitingGame.getId())).thenReturn(Optional.of(waitingGame));

        JoinGameResponse response = gameService.joinGame(waitingGame.getId());

        assertThat(response.getPlayerId()).isNotBlank();
    }

    // =========================================================================
    // Session-token belonging (mint-once, distinctness, non-transfer)
    // =========================================================================

    @Test
    void createGame_mintsSessionTokenDistinctFromPlayerId() {
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN);

        assertThat(response.getSessionToken()).isNotBlank();
        assertThat(response.getSessionToken()).isNotEqualTo(response.getPlayerId());
        // base64url of 32 bytes, no padding = 43 chars
        assertThat(response.getSessionToken()).hasSize(43);
    }

    @Test
    void joinGame_mintsNewDistinctPlayerIdAndToken_notCreatorsSeat() {
        // The creator's seat already holds its own minted token; the joiner must receive a
        // brand-new, distinct identity AND a distinct token — never the creator's (AC-5, AC-7).
        CreateGameResponse created = gameService.createGame(GameMode.HUMAN);
        ArgumentCaptor<Game> captor = ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        Game waitingGame = captor.getValue();
        when(gameRepository.findById(waitingGame.getId())).thenReturn(Optional.of(waitingGame));

        JoinGameResponse joined = gameService.joinGame(waitingGame.getId(), null);

        assertThat(joined.getPlayerId()).isNotEqualTo(created.getPlayerId());
        assertThat(joined.getSessionToken()).isNotBlank();
        assertThat(joined.getSessionToken()).isNotEqualTo(created.getSessionToken());
        // The joiner owns its OWN seat with its OWN token; the creator's token cannot own it.
        assertThat(waitingGame.ownsSeat(joined.getPlayerId(), joined.getSessionToken())).isTrue();
        assertThat(waitingGame.ownsSeat(joined.getPlayerId(), created.getSessionToken())).isFalse();
    }

    @Test
    void joinGame_onComputerGame_returnsGeneric404_seatNonTransferable() {
        // A COMPUTER game has its single human seat plus a tokenless computer seat (playerB filled),
        // so a join attempt collapses to the generic not-joinable 404 — the seat never transfers (AC-10).
        CreateGameResponse created = gameService.createGame(GameMode.COMPUTER);
        ArgumentCaptor<Game> captor = ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        Game computerGame = captor.getValue();
        when(gameRepository.findById(computerGame.getId())).thenReturn(Optional.of(computerGame));

        assertThatThrownBy(() -> gameService.joinGame(computerGame.getId(), null))
                .isInstanceOf(GameException.class)
                .extracting(e -> ((GameException) e).getErrorCode())
                .isEqualTo("GAME_NOT_FOUND");
    }

    // =========================================================================
    // Game timestamps (AC-17)
    // =========================================================================

    @Test
    void game_createdAt_isSetOnConstruct() {
        Instant before = Instant.now();
        Game game = new Game("G1", new Player("p1", "G1"));
        Instant after = Instant.now();

        assertThat(game.getCreatedAt()).isNotNull();
        assertThat(game.getCreatedAt()).isAfterOrEqualTo(before);
        assertThat(game.getCreatedAt()).isBeforeOrEqualTo(after);
    }

    @Test
    void game_createdAt_isSetOnGameModeConstructor() {
        Instant before = Instant.now();
        Game game = new Game("G2", new Player("p2", "G2"), GameMode.COMPUTER);
        Instant after = Instant.now();

        assertThat(game.getCreatedAt()).isNotNull();
        assertThat(game.getCreatedAt()).isAfterOrEqualTo(before);
        assertThat(game.getCreatedAt()).isBeforeOrEqualTo(after);
    }

    @Test
    void game_finishedAt_isNullBeforeFinishGame() {
        Game game = new Game("G3", new Player("p3", "G3"));

        assertThat(game.getFinishedAt()).isNull();
    }

    @Test
    void game_finishedAt_isSetWhenFinishGameCalled() {
        Game game = new Game("G4", new Player("p4", "G4"));
        Player playerB = new Player("p4b", "G4");
        game.addPlayerB(playerB);
        game.startGame();

        Instant before = Instant.now();
        game.finishGame("p4");
        Instant after = Instant.now();

        assertThat(game.getFinishedAt()).isNotNull();
        assertThat(game.getFinishedAt()).isAfterOrEqualTo(before);
        assertThat(game.getFinishedAt()).isBeforeOrEqualTo(after);
    }

    @Test
    void game_createGame_savedGameHasCreatedAt() {
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN);

        ArgumentCaptor<Game> captor = ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        assertThat(captor.getValue().getCreatedAt()).isNotNull();
    }

    // =========================================================================
    // Move recording (AC-19, AC-20)
    // =========================================================================

    @Test
    void fireShot_humanMiss_recordsOneMoveWithCorrectXY() {
        Game game = buildInProgressHumanGame();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        // Fire at a cell known to be empty (no ship)
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        gameService.fireShot(game.getId(), game.getPlayerA().getId(), HUMAN_TOKEN, target);

        ArgumentCaptor<Move> captor = ArgumentCaptor.forClass(Move.class);
        verify(moveRepository, atLeastOnce()).save(captor.capture());

        // Find the human's move
        Move humanMove = captor.getAllValues().stream()
                .filter(m -> m.getPlayerId().equals(game.getPlayerA().getId()))
                .findFirst()
                .orElseThrow();

        // x = col, y = row (architecture §2.2)
        assertThat(humanMove.getX()).isEqualTo(target.getCol());
        assertThat(humanMove.getY()).isEqualTo(target.getRow());
        assertThat(humanMove.getResult()).isEqualTo(MoveResult.MISS);
        assertThat(humanMove.getGameId()).isEqualTo(game.getId());
        assertThat(humanMove.getCreatedAt()).isNotNull();
    }

    @Test
    void fireShot_humanHit_recordsMoveWithHitResult() {
        Game game = buildInProgressHumanGame();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        Coordinate target = findShipCell(game.getPlayerB().getBoard());
        // Make sure target is not the last cell (to avoid WIN→SUNK path in this test)
        // We'll just check we get a HIT or SUNK result; either is valid
        gameService.fireShot(game.getId(), game.getPlayerA().getId(), HUMAN_TOKEN, target);

        ArgumentCaptor<Move> captor = ArgumentCaptor.forClass(Move.class);
        verify(moveRepository, atLeastOnce()).save(captor.capture());

        Move humanMove = captor.getAllValues().stream()
                .filter(m -> m.getPlayerId().equals(game.getPlayerA().getId()))
                .findFirst()
                .orElseThrow();

        assertThat(humanMove.getResult()).isIn(MoveResult.HIT, MoveResult.SUNK);
    }

    @Test
    void fireShot_winningShot_moveResultIsSunk_notWin() {
        // AC-19: WIN is normalised to SUNK before persisting
        Game game = buildInProgressHumanGame();
        sinkAllShipsExceptLastCell(game.getPlayerB().getBoard());
        Coordinate lastCell = findLastUnsunkCell(game.getPlayerB().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        gameService.fireShot(game.getId(), game.getPlayerA().getId(), HUMAN_TOKEN, lastCell);

        ArgumentCaptor<Move> captor = ArgumentCaptor.forClass(Move.class);
        verify(moveRepository, atLeastOnce()).save(captor.capture());

        Move winningMove = captor.getAllValues().stream()
                .filter(m -> m.getPlayerId().equals(game.getPlayerA().getId()))
                .findFirst()
                .orElseThrow();

        // Must be SUNK — never WIN (AC-19)
        assertThat(winningMove.getResult()).isEqualTo(MoveResult.SUNK);
    }

    @Test
    void fireShot_computerMode_computerMoveRecordedWithSentinelPlayerId() {
        // AC-20: computer shots use the COMPUTER- sentinel as playerId
        Game game = buildInProgressComputerGame();
        String humanId = game.getPlayerA().getId();
        String computerId = game.getPlayerB().getId();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        gameService.fireShot(game.getId(), humanId, HUMAN_TOKEN, target);

        ArgumentCaptor<Move> captor = ArgumentCaptor.forClass(Move.class);
        verify(moveRepository, atLeastOnce()).save(captor.capture());

        List<Move> allMoves = captor.getAllValues();
        // Should have at least two moves: human shot + computer shot
        assertThat(allMoves).hasSizeGreaterThanOrEqualTo(2);

        Move computerMove = allMoves.stream()
                .filter(m -> m.getPlayerId().equals(computerId))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No computer move found"));

        assertThat(computerMove.getPlayerId()).startsWith("COMPUTER-");
        assertThat(computerMove.getResult()).isIn(MoveResult.MISS, MoveResult.HIT, MoveResult.SUNK);
    }

    @Test
    void fireShot_createdAtMatchesShotFiredAt() {
        // AC-19: Move.createdAt is sourced from Shot.firedAt — not a second Instant.now()
        Game game = buildInProgressHumanGame();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        Instant before = Instant.now();
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        gameService.fireShot(game.getId(), game.getPlayerA().getId(), HUMAN_TOKEN, target);
        Instant after = Instant.now();

        ArgumentCaptor<Move> captor = ArgumentCaptor.forClass(Move.class);
        verify(moveRepository, atLeastOnce()).save(captor.capture());

        Move humanMove = captor.getAllValues().stream()
                .filter(m -> m.getPlayerId().equals(game.getPlayerA().getId()))
                .findFirst()
                .orElseThrow();

        // createdAt must fall within the window the test fired
        assertThat(humanMove.getCreatedAt()).isAfterOrEqualTo(before);
        assertThat(humanMove.getCreatedAt()).isBeforeOrEqualTo(after);
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private Game buildWaitingGame() {
        Player playerA = new Player("host-player", "GAME01");
        return new Game("GAME01", playerA, GameMode.HUMAN);
    }

    private Game buildInProgressHumanGame() {
        String gameId = "HUMAN-TEST-1";
        Player playerA = new Player("human-a", gameId, HUMAN_TOKEN);
        Game game = new Game(gameId, playerA, GameMode.HUMAN);

        Player playerB = new Player("human-b", gameId, "tok-b");
        game.addPlayerB(playerB);

        placeAllShips(game.getPlayerA().getBoard());
        placeAllShips(game.getPlayerB().getBoard());
        game.getPlayerA().confirmReady();
        game.getPlayerB().confirmReady();
        game.startGame();
        return game;
    }

    private Game buildInProgressComputerGame() {
        String gameId = "COMP-TEST-1";
        Player humanPlayer = new Player("human-player", gameId, HUMAN_TOKEN);
        Game game = new Game(gameId, humanPlayer, GameMode.COMPUTER);

        String computerId = "COMPUTER-sentinel-001";
        Player computerPlayer = new Player(computerId, gameId, null);
        computerPlayerService.placeShipsRandomly(computerPlayer.getBoard());
        computerPlayer.confirmReady();
        game.addPlayerB(computerPlayer);

        placeAllShips(game.getPlayerA().getBoard());
        game.getPlayerA().confirmReady();
        game.startGame();
        return game;
    }

    private void placeAllShips(Board board) {
        board.placeShip(new Ship(ShipType.CARRIER,
                Board.computeCells(ShipType.CARRIER, new Coordinate(0, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
        board.placeShip(new Ship(ShipType.BATTLESHIP,
                Board.computeCells(ShipType.BATTLESHIP, new Coordinate(1, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
        board.placeShip(new Ship(ShipType.CRUISER,
                Board.computeCells(ShipType.CRUISER, new Coordinate(2, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
        board.placeShip(new Ship(ShipType.SUBMARINE,
                Board.computeCells(ShipType.SUBMARINE, new Coordinate(3, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
        board.placeShip(new Ship(ShipType.DESTROYER,
                Board.computeCells(ShipType.DESTROYER, new Coordinate(4, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
    }

    /** Finds a cell with no ship (safe miss target). */
    private Coordinate findEmptyCell(Board board) {
        for (int row = 9; row >= 0; row--) {
            for (int col = 9; col >= 0; col--) {
                Coordinate c = new Coordinate(row, col);
                if (board.shipAt(c).isEmpty()) {
                    return c;
                }
            }
        }
        throw new IllegalStateException("No empty cell found on board");
    }

    /** Finds the first cell occupied by any ship (safe hit target for non-sink scenarios). */
    private Coordinate findShipCell(Board board) {
        for (Ship ship : board.getShips()) {
            if (!ship.getCells().isEmpty()) {
                return ship.getCells().get(0);
            }
        }
        throw new IllegalStateException("No ship cell found");
    }

    /** Pre-hits all cells of every ship except the very last un-hit cell. */
    private void sinkAllShipsExceptLastCell(Board board) {
        java.util.List<Ship> ships = new java.util.ArrayList<>(board.getShips());
        for (int s = 0; s < ships.size() - 1; s++) {
            ships.get(s).getCells().forEach(ships.get(s)::recordHit);
        }
        Ship lastShip = ships.get(ships.size() - 1);
        java.util.List<Coordinate> cells = lastShip.getCells();
        for (int i = 0; i < cells.size() - 1; i++) {
            lastShip.recordHit(cells.get(i));
        }
    }

    /** Returns the single remaining un-hit cell after {@link #sinkAllShipsExceptLastCell}. */
    private Coordinate findLastUnsunkCell(Board board) {
        for (Ship ship : board.getShips()) {
            if (!ship.isSunk()) {
                for (Coordinate cell : ship.getCells()) {
                    if (!ship.getHits().contains(cell)) {
                        return cell;
                    }
                }
            }
        }
        throw new IllegalStateException("No un-sunk cell found");
    }
}
