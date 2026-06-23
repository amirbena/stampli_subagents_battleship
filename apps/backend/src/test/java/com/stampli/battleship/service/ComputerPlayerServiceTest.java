package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for ComputerPlayerService.
 * Uses real PlacementValidationService — no Spring context required.
 */
class ComputerPlayerServiceTest {

    private ComputerPlayerService computerPlayerService;

    private static final String GAME_ID = "TEST01";
    private static final String COMPUTER_ID = "COMPUTER-abc";

    @BeforeEach
    void setUp() {
        PlacementValidationService placementValidationService = new PlacementValidationService();
        computerPlayerService = new ComputerPlayerService(placementValidationService);
    }

    // -------------------------------------------------------------------------
    // placeShipsRandomly
    // -------------------------------------------------------------------------

    @Test
    void placeShipsRandomly_placesAllFiveShips() {
        Board board = new Board();
        computerPlayerService.placeShipsRandomly(board);

        assertThat(board.getShips()).hasSize(5);
    }

    @Test
    void placeShipsRandomly_allShipsValid_noOverlap() {
        Board board = new Board();
        computerPlayerService.placeShipsRandomly(board);

        Set<Coordinate> occupiedCells = new HashSet<>();
        for (Ship ship : board.getShips()) {
            for (Coordinate cell : ship.getCells()) {
                boolean added = occupiedCells.add(cell);
                assertThat(added)
                        .as("Cell (%d,%d) is occupied by more than one ship", cell.getRow(), cell.getCol())
                        .isTrue();
            }
        }
    }

    @Test
    void placeShipsRandomly_allShipsWithinBounds() {
        Board board = new Board();
        computerPlayerService.placeShipsRandomly(board);

        for (Ship ship : board.getShips()) {
            for (Coordinate cell : ship.getCells()) {
                assertThat(cell.getRow())
                        .as("Row out of bounds for ship %s", ship.getType())
                        .isBetween(0, 9);
                assertThat(cell.getCol())
                        .as("Col out of bounds for ship %s", ship.getType())
                        .isBetween(0, 9);
            }
        }
    }

    // -------------------------------------------------------------------------
    // selectShot
    // -------------------------------------------------------------------------

    @Test
    void selectShot_returnsUntargetedCell() {
        // Seed the game with a few computer shots
        Player playerA = new Player("human", GAME_ID);
        Player computer = new Player(COMPUTER_ID, GAME_ID);
        Game game = new Game(GAME_ID, playerA, GameMode.COMPUTER);
        game.addPlayerB(computer);

        // Record 3 computer shots
        game.addShot(new Shot(COMPUTER_ID, new Coordinate(0, 0), ShotResult.MISS));
        game.addShot(new Shot(COMPUTER_ID, new Coordinate(1, 1), ShotResult.MISS));
        game.addShot(new Shot(COMPUTER_ID, new Coordinate(2, 2), ShotResult.MISS));

        Coordinate selected = computerPlayerService.selectShot(game, COMPUTER_ID);

        assertThat(selected).isNotNull();
        assertThat(selected).isNotIn(
                new Coordinate(0, 0), new Coordinate(1, 1), new Coordinate(2, 2)
        );
    }

    @Test
    void selectShot_neverRepeatsWithManyShots() {
        Player playerA = new Player("human", GAME_ID);
        Player computer = new Player(COMPUTER_ID, GAME_ID);
        Game game = new Game(GAME_ID, playerA, GameMode.COMPUTER);
        game.addPlayerB(computer);

        Set<Coordinate> selected = new HashSet<>();
        // Select 99 shots (well within the 100-cell grid)
        for (int i = 0; i < 99; i++) {
            // Add previously selected shots to history
            for (Coordinate c : selected) {
                // Only add if not already in history
                boolean alreadyRecorded = game.getShotHistory().stream()
                        .filter(s -> s.getPlayerId().equals(COMPUTER_ID))
                        .anyMatch(s -> s.getCoordinate().equals(c));
                if (!alreadyRecorded) {
                    game.addShot(new Shot(COMPUTER_ID, c, ShotResult.MISS));
                }
            }
            Coordinate coord = computerPlayerService.selectShot(game, COMPUTER_ID);
            assertThat(coord).isNotNull();
            boolean isNew = selected.add(coord);
            assertThat(isNew)
                    .as("selectShot returned already-selected coordinate %s at iteration %d", coord, i)
                    .isTrue();
        }
        assertThat(selected).hasSize(99);
    }

    @Test
    void selectShot_validCoordinate() {
        Player playerA = new Player("human", GAME_ID);
        Player computer = new Player(COMPUTER_ID, GAME_ID);
        Game game = new Game(GAME_ID, playerA, GameMode.COMPUTER);
        game.addPlayerB(computer);

        Coordinate coord = computerPlayerService.selectShot(game, COMPUTER_ID);

        assertThat(coord).isNotNull();
        assertThat(coord.getRow()).isBetween(0, 9);
        assertThat(coord.getCol()).isBetween(0, 9);
    }
}
