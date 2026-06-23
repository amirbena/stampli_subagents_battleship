package com.stampli.battleship.service;

import com.stampli.battleship.domain.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Handles all AI/computer player actions: random fleet placement and shot selection.
 */
@Service
public class ComputerPlayerService {

    private static final int MAX_PLACEMENT_ATTEMPTS = 200;
    private static final ShipType[] SHIP_ORDER = {
            ShipType.CARRIER, ShipType.BATTLESHIP, ShipType.CRUISER,
            ShipType.SUBMARINE, ShipType.DESTROYER
    };

    private final PlacementValidationService placementValidationService;
    private final Random random = new Random();

    public ComputerPlayerService(PlacementValidationService placementValidationService) {
        this.placementValidationService = placementValidationService;
    }

    /**
     * Randomly places all ships on the given board, retrying up to 200 times per ship.
     *
     * @param board the board to place ships on (must be empty)
     */
    public void placeShipsRandomly(Board board) {
        Orientation[] orientations = Orientation.values();

        for (ShipType shipType : SHIP_ORDER) {
            boolean placed = false;
            int attempts = 0;
            while (!placed) {
                attempts++;
                int row = random.nextInt(10);
                int col = random.nextInt(10);
                Orientation orientation = orientations[random.nextInt(orientations.length)];
                Coordinate anchor = new Coordinate(row, col);

                if (board.isValidPlacement(shipType, anchor, orientation)) {
                    List<Coordinate> cells = Board.computeCells(shipType, anchor, orientation);
                    board.placeShip(new Ship(shipType, cells, orientation));
                    placed = true;
                }

                // Safety valve: after 200 attempts, keep trying (a valid placement always exists)
                if (attempts >= MAX_PLACEMENT_ATTEMPTS && !placed) {
                    attempts = 0; // reset and continue until placed
                }
            }
        }
    }

    /**
     * Selects a random untried coordinate for the computer to fire at.
     *
     * @param game             the current game
     * @param computerPlayerId the computer's player id
     * @return an untried coordinate, or null if all cells have been tried (game should already be over)
     */
    public Coordinate selectShot(Game game, String computerPlayerId) {
        Set<Coordinate> alreadyShot = game.getShotHistory().stream()
                .filter(s -> s.getPlayerId().equals(computerPlayerId))
                .map(Shot::getCoordinate)
                .collect(Collectors.toSet());

        List<Coordinate> remaining = new ArrayList<>();
        for (int row = 0; row < 10; row++) {
            for (int col = 0; col < 10; col++) {
                Coordinate c = new Coordinate(row, col);
                if (!alreadyShot.contains(c)) {
                    remaining.add(c);
                }
            }
        }

        if (remaining.isEmpty()) {
            return null;
        }

        return remaining.get(random.nextInt(remaining.size()));
    }
}
