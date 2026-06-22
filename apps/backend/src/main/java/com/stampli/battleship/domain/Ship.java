package com.stampli.battleship.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class Ship {
    private final ShipType type;
    private final List<Coordinate> cells;
    private final Orientation orientation;
    private final Set<Coordinate> hits;

    public Ship(ShipType type, List<Coordinate> cells, Orientation orientation) {
        this.type = type;
        this.cells = List.copyOf(cells);
        this.orientation = orientation;
        this.hits = new HashSet<>();
    }

    public ShipType getType() {
        return type;
    }

    public List<Coordinate> getCells() {
        return cells;
    }

    public Orientation getOrientation() {
        return orientation;
    }

    public Set<Coordinate> getHits() {
        return Set.copyOf(hits);
    }

    public boolean isSunk() {
        return hits.size() == cells.size();
    }

    public boolean occupies(Coordinate c) {
        return cells.contains(c);
    }

    public void recordHit(Coordinate c) {
        hits.add(c);
    }
}
