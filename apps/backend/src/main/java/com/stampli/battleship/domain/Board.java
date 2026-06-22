package com.stampli.battleship.domain;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

public class Board {
    private final List<Ship> ships;
    private final Set<Coordinate> missedShots;

    public Board() {
        this.ships = new ArrayList<>();
        this.missedShots = new HashSet<>();
    }

    public Optional<Ship> shipAt(Coordinate c) {
        return ships.stream()
                .filter(s -> s.occupies(c))
                .findFirst();
    }

    public boolean allShipsSunk() {
        return !ships.isEmpty() && ships.stream().allMatch(Ship::isSunk);
    }

    public boolean hasAllShipsPlaced() {
        Set<ShipType> placed = new HashSet<>();
        for (Ship s : ships) {
            placed.add(s.getType());
        }
        return placed.containsAll(Set.of(ShipType.values()));
    }

    public boolean isValidPlacement(ShipType type, Coordinate anchor, Orientation orientation) {
        List<Coordinate> cells = computeCells(type, anchor, orientation);
        if (cells == null) return false;

        for (Coordinate c : cells) {
            if (!c.isValid()) return false;
            if (shipAt(c).isPresent()) return false;
        }
        return true;
    }

    public void placeShip(Ship ship) {
        ships.add(ship);
    }

    public void removeShip(Ship ship) {
        ships.remove(ship);
    }

    public List<Ship> getShips() {
        return List.copyOf(ships);
    }

    public Set<Coordinate> getMissedShots() {
        return Set.copyOf(missedShots);
    }

    public void recordMiss(Coordinate c) {
        missedShots.add(c);
    }

    public static List<Coordinate> computeCells(ShipType type, Coordinate anchor, Orientation orientation) {
        List<Coordinate> cells = new ArrayList<>();
        for (int i = 0; i < type.getSize(); i++) {
            int row = orientation == Orientation.VERTICAL ? anchor.getRow() + i : anchor.getRow();
            int col = orientation == Orientation.HORIZONTAL ? anchor.getCol() + i : anchor.getCol();
            cells.add(new Coordinate(row, col));
        }
        return cells;
    }
}
