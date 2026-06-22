package com.stampli.battleship.service;

import com.stampli.battleship.domain.Board;
import com.stampli.battleship.domain.Coordinate;
import com.stampli.battleship.domain.Orientation;
import com.stampli.battleship.domain.ShipType;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Validates ship placement requests before they are applied to a {@link Board}.
 * <p>
 * Extracted from {@link GameService} so placement rules can be tested and
 * extended independently of the main game flow.
 */
@Service
public class PlacementValidationService {

    /**
     * Validates that a ship can be placed at the given anchor with the given orientation.
     * <p>
     * Checks two rules in order:
     * <ol>
     *   <li>All computed cells must lie within the 10×10 board boundary (0–9).</li>
     *   <li>No computed cell may overlap a cell already occupied by another ship.</li>
     * </ol>
     *
     * @param board       the player's current board state
     * @param shipType    the ship being placed (determines size)
     * @param anchor      top-left (HORIZONTAL) or top (VERTICAL) starting cell
     * @param orientation placement direction
     * @throws GameException 400 if any cell is out of bounds or overlaps an existing ship
     */
    public void validate(Board board, ShipType shipType, Coordinate anchor, Orientation orientation) {
        List<Coordinate> cells = Board.computeCells(shipType, anchor, orientation);

        for (Coordinate c : cells) {
            if (!c.isValid()) {
                throw new GameException(
                        "Ship placement is out of bounds",
                        "INVALID_PLACEMENT",
                        HttpStatus.BAD_REQUEST
                );
            }
        }

        for (Coordinate c : cells) {
            if (board.shipAt(c).isPresent()) {
                throw new GameException(
                        "Ship placement overlaps with an existing ship",
                        "INVALID_PLACEMENT",
                        HttpStatus.BAD_REQUEST
                );
            }
        }
    }

    /**
     * Ensures the same {@link ShipType} is not placed twice on one board.
     * Each player may have exactly one of each ship type.
     *
     * @param board    the player's current board state
     * @param shipType the ship type to check
     * @throws GameException 400 if the ship type is already on the board
     */
    public void validateNotAlreadyPlaced(Board board, ShipType shipType) {
        boolean alreadyPlaced = board.getShips().stream()
                .anyMatch(s -> s.getType() == shipType);
        if (alreadyPlaced) {
            throw new GameException(
                    "Ship type " + shipType + " is already placed",
                    "ALREADY_PLACED",
                    HttpStatus.BAD_REQUEST
            );
        }
    }
}
