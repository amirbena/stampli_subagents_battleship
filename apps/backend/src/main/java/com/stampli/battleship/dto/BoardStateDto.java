package com.stampli.battleship.dto;

import java.util.List;

public class BoardStateDto {
    private final List<ShipDto> ships;
    private final List<CellStateDto> missedShots;
    private final List<CellStateDto> hits;

    public BoardStateDto(List<ShipDto> ships, List<CellStateDto> missedShots, List<CellStateDto> hits) {
        this.ships = ships;
        this.missedShots = missedShots;
        this.hits = hits;
    }

    public List<ShipDto> getShips() { return ships; }
    public List<CellStateDto> getMissedShots() { return missedShots; }
    public List<CellStateDto> getHits() { return hits; }
}
