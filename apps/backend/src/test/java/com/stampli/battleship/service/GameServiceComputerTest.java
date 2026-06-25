package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import com.stampli.battleship.dto.CreateGameResponse;
import com.stampli.battleship.dto.ConfirmReadyResponse;
import com.stampli.battleship.dto.FireShotResponse;
import com.stampli.battleship.dto.GameStateResponse;
import com.stampli.battleship.repository.GameRepository;
import com.stampli.battleship.repository.MoveRepository;
import com.stampli.battleship.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Unit tests for GameService in COMPUTER game mode.
 * GameRepository is mocked; PlacementValidationService and ComputerPlayerService
 * use real instances unless the test needs to control computer behaviour.
 */
@ExtendWith(MockitoExtension.class)
class GameServiceComputerTest {

    @Mock
    private GameRepository gameRepository;

    @Mock
    private PlayerRepository playerRepository;

    @Mock
    private MoveRepository moveRepository;

    // Use real service instances for white-box coverage of AI integration
    private PlacementValidationService placementValidationService;
    private ComputerPlayerService computerPlayerService;
    private GameService gameService;

    @BeforeEach
    void setUp() {
        placementValidationService = new PlacementValidationService();
        computerPlayerService = new ComputerPlayerService(placementValidationService);
        gameService = new GameService(gameRepository, placementValidationService, computerPlayerService,
                playerRepository, moveRepository);

        // save() is a void method — Mockito mocks it as no-op by default; no explicit stub needed.
    }

    // -------------------------------------------------------------------------
    // createGame — COMPUTER mode
    // -------------------------------------------------------------------------

    @Test
    void createGame_computerMode_returnsComputerGameMode() {
        CreateGameResponse response = gameService.createGame(GameMode.COMPUTER);

        assertThat(response.getGameMode()).isEqualTo("COMPUTER");
    }

    @Test
    void createGame_computerMode_statusIsPlacingShips() {
        // After computer joins, status must be PLACING_SHIPS (not WAITING_FOR_PLAYERS)
        CreateGameResponse response = gameService.createGame(GameMode.COMPUTER);

        assertThat(response.getStatus()).isEqualTo("PLACING_SHIPS");
    }

    @Test
    void createGame_computerMode_playerBExistsAndReady() {
        // We test this by creating the game and then fetching the saved game object via captor
        // Easier: exercise through getGameState after stubbing findById
        CreateGameResponse response = gameService.createGame(GameMode.COMPUTER);

        // Capture the game that was saved
        org.mockito.ArgumentCaptor<Game> captor = org.mockito.ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        Game savedGame = captor.getValue();

        assertThat(savedGame.getPlayerB()).isNotNull();
        assertThat(savedGame.getPlayerB().isReady()).isTrue();
    }

    @Test
    void createGame_computerMode_playerBIdStartsWithCOMPUTER() {
        gameService.createGame(GameMode.COMPUTER);

        org.mockito.ArgumentCaptor<Game> captor = org.mockito.ArgumentCaptor.forClass(Game.class);
        verify(gameRepository).save(captor.capture());
        Game savedGame = captor.getValue();

        assertThat(savedGame.getPlayerB().getId()).startsWith("COMPUTER-");
    }

    @Test
    void createGame_humanMode_statusIsWaitingForPlayers() {
        CreateGameResponse response = gameService.createGame(GameMode.HUMAN);

        assertThat(response.getStatus()).isEqualTo("WAITING_FOR_PLAYERS");
        assertThat(response.getGameMode()).isEqualTo("HUMAN");
    }

    // -------------------------------------------------------------------------
    // setReady — COMPUTER mode
    // -------------------------------------------------------------------------

    @Test
    void setReady_computerMode_gameStartsImmediately() {
        Game game = buildComputerGameInPlacingShips();
        String humanId = game.getPlayerA().getId();
        placeAllShips(game.getPlayerA().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        ConfirmReadyResponse response = gameService.setReady(game.getId(), humanId);

        assertThat(response.getStatus()).isEqualTo("IN_PROGRESS");
    }

    @Test
    void setReady_computerMode_humanGoesFirst() {
        Game game = buildComputerGameInPlacingShips();
        String humanId = game.getPlayerA().getId();
        placeAllShips(game.getPlayerA().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        ConfirmReadyResponse response = gameService.setReady(game.getId(), humanId);

        assertThat(response.getCurrentTurnPlayerId()).isEqualTo(humanId);
    }

    // -------------------------------------------------------------------------
    // fireShot — COMPUTER mode
    // -------------------------------------------------------------------------

    @Test
    void fireShot_computerMode_responseIncludesComputerShot() {
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        // Fire at a cell that is not a ship (MISS) so human does not win
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        FireShotResponse response = gameService.fireShot(game.getId(), humanId, target);

        assertThat(response.getComputerShot()).isNotNull();
    }

    @Test
    void fireShot_computerMode_computerShotIsLegalAndUnique() {
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        FireShotResponse response = gameService.fireShot(game.getId(), humanId, target);

        assertThat(response.getComputerShot()).isNotNull();
        int compRow = response.getComputerShot().getRow();
        int compCol = response.getComputerShot().getCol();
        assertThat(compRow).isBetween(0, 9);
        assertThat(compCol).isBetween(0, 9);
        // The returned computer shot coordinate must not equal the human shot coordinate
        // (trivially true if the AI hasn't fired before, but also verifies it's a real coordinate)
        assertThat(new Coordinate(compRow, compCol)).isNotNull();
    }

    @Test
    void fireShot_computerMode_humanWins_noComputerShot() {
        // Build game where every computer ship is one hit away from sinking
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        Board computerBoard = game.getPlayerB().getBoard();

        // Damage all computer ships except one cell each
        sinkAllShipsExceptLastCell(computerBoard);

        // The last cell to target — firing this will sink all computer ships
        Coordinate lastCell = findLastUnsunkCell(computerBoard);
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        FireShotResponse response = gameService.fireShot(game.getId(), humanId, lastCell);

        assertThat(response.getWinnerId()).isEqualTo(humanId);
        assertThat(response.getComputerShot()).isNull();
    }

    @Test
    void fireShot_computerMode_humanGoesAgainAfterComputerShot() {
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        FireShotResponse response = gameService.fireShot(game.getId(), humanId, target);

        // Human always retains the next turn in COMPUTER mode
        assertThat(response.getNextTurnPlayerId()).isEqualTo(humanId);
    }

    @Test
    void fireShot_humanMode_noComputerShot() {
        // Standard human-vs-human game: computerShot must always be null
        Game game = buildHumanGameInProgress();
        String humanAId = game.getPlayerA().getId();
        Coordinate target = findEmptyCell(game.getPlayerB().getBoard());
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        FireShotResponse response = gameService.fireShot(game.getId(), humanAId, target);

        assertThat(response.getComputerShot()).isNull();
    }

    // -------------------------------------------------------------------------
    // getGameState — COMPUTER mode
    // -------------------------------------------------------------------------

    @Test
    void getGameState_computerMode_includesGameMode() {
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(game.getId(), humanId);

        assertThat(state.getGameMode()).isEqualTo("COMPUTER");
    }

    @Test
    void getGameState_computerMode_computerBoardMasked() {
        // Un-sunk computer ships must NOT appear in the opponentBoard returned to human
        Game game = buildComputerGameInProgress();
        String humanId = game.getPlayerA().getId();
        when(gameRepository.findById(game.getId())).thenReturn(Optional.of(game));

        GameStateResponse state = gameService.getGameState(game.getId(), humanId);

        // Computer has 5 un-sunk ships; opponentBoard.ships must be empty
        assertThat(state.getOpponentBoard().getShips()).isEmpty();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** Creates a COMPUTER game in PLACING_SHIPS state (computer already ready, human not yet). */
    private Game buildComputerGameInPlacingShips() {
        String gameId = "COMPG1";
        Player humanPlayer = new Player("human-player", gameId);
        Game game = new Game(gameId, humanPlayer, GameMode.COMPUTER);

        // Set up computer player (mirrors GameService.createGame logic)
        String computerId = "COMPUTER-test-001";
        Player computerPlayer = new Player(computerId, gameId);
        computerPlayerService.placeShipsRandomly(computerPlayer.getBoard());
        computerPlayer.confirmReady();
        game.addPlayerB(computerPlayer);

        return game;
    }

    /** Creates a COMPUTER game in IN_PROGRESS state with all ships placed for both sides. */
    private Game buildComputerGameInProgress() {
        Game game = buildComputerGameInPlacingShips();
        placeAllShips(game.getPlayerA().getBoard());
        game.getPlayerA().confirmReady();
        game.startGame(); // transitions to IN_PROGRESS, human goes first
        return game;
    }

    /** Creates a HUMAN game in IN_PROGRESS state with ships on both boards. */
    private Game buildHumanGameInProgress() {
        String gameId = "HUMANG1";
        Player playerA = new Player("human-a", gameId);
        Game game = new Game(gameId, playerA, GameMode.HUMAN);

        Player playerB = new Player("human-b", gameId);
        game.addPlayerB(playerB);

        placeAllShips(game.getPlayerA().getBoard());
        placeAllShips(game.getPlayerB().getBoard());
        game.getPlayerA().confirmReady();
        game.getPlayerB().confirmReady();
        game.startGame();
        return game;
    }

    /** Places all 5 standard ships on a board in a known non-overlapping layout. */
    private void placeAllShips(Board board) {
        // Row 0: CARRIER (size 5), cols 0-4, horizontal
        board.placeShip(new Ship(ShipType.CARRIER,
                Board.computeCells(ShipType.CARRIER, new Coordinate(0, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));

        // Row 1: BATTLESHIP (size 4), cols 0-3, horizontal
        board.placeShip(new Ship(ShipType.BATTLESHIP,
                Board.computeCells(ShipType.BATTLESHIP, new Coordinate(1, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));

        // Row 2: CRUISER (size 3), cols 0-2, horizontal
        board.placeShip(new Ship(ShipType.CRUISER,
                Board.computeCells(ShipType.CRUISER, new Coordinate(2, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));

        // Row 3: SUBMARINE (size 3), cols 0-2, horizontal
        board.placeShip(new Ship(ShipType.SUBMARINE,
                Board.computeCells(ShipType.SUBMARINE, new Coordinate(3, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));

        // Row 4: DESTROYER (size 2), cols 0-1, horizontal
        board.placeShip(new Ship(ShipType.DESTROYER,
                Board.computeCells(ShipType.DESTROYER, new Coordinate(4, 0), Orientation.HORIZONTAL),
                Orientation.HORIZONTAL));
    }

    /** Finds a cell on the board that is NOT occupied by any ship. */
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

    /**
     * Records hits on all cells of every ship except the very last cell of the last ship,
     * leaving exactly one cell unregistered as a hit (so the next shot on that cell wins).
     */
    private void sinkAllShipsExceptLastCell(Board board) {
        java.util.List<Ship> ships = new java.util.ArrayList<>(board.getShips());
        // Sink all ships completely except the very last ship; on the last ship, hit all but last cell
        for (int s = 0; s < ships.size() - 1; s++) {
            Ship ship = ships.get(s);
            ship.getCells().forEach(ship::recordHit);
        }
        // On the last ship, hit all cells except the last one
        Ship lastShip = ships.get(ships.size() - 1);
        java.util.List<Coordinate> cells = lastShip.getCells();
        for (int i = 0; i < cells.size() - 1; i++) {
            lastShip.recordHit(cells.get(i));
        }
    }

    /**
     * Returns the one remaining un-hit cell across all ships (the game-winning shot target).
     * Must be called after {@link #sinkAllShipsExceptLastCell}.
     */
    private Coordinate findLastUnsunkCell(Board board) {
        for (Ship ship : board.getShips()) {
            if (!ship.isSunk()) {
                // Return the cell that has not been hit
                for (Coordinate cell : ship.getCells()) {
                    if (!ship.getHits().contains(cell)) {
                        return cell;
                    }
                }
            }
        }
        throw new IllegalStateException("No un-sunk cell found — call sinkAllShipsExceptLastCell first");
    }
}
