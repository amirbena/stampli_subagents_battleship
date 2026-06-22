package com.stampli.battleship.dto;

import java.util.List;

public class PlaceShipResponse {
    private final String shipType;
    private final List<CellStateDto> cells;

    public PlaceShipResponse(String shipType, List<CellStateDto> cells) {
        this.shipType = shipType;
        this.cells = cells;
    }

    public String getShipType() { return shipType; }
    public List<CellStateDto> getCells() { return cells; }
}
