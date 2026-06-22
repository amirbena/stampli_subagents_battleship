package com.stampli.battleship.dto;

import java.util.List;

public class ShipDto {
    private final String shipType;
    private final List<CellStateDto> cells;
    private final List<CellStateDto> hits;
    private final boolean sunk;

    public ShipDto(String shipType, List<CellStateDto> cells, List<CellStateDto> hits, boolean sunk) {
        this.shipType = shipType;
        this.cells = cells;
        this.hits = hits;
        this.sunk = sunk;
    }

    public String getShipType() { return shipType; }
    public List<CellStateDto> getCells() { return cells; }
    public List<CellStateDto> getHits() { return hits; }
    public boolean isSunk() { return sunk; }
}
