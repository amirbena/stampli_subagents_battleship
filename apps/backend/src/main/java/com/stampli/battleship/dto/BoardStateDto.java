package com.stampli.battleship.dto;

import java.util.List;

public class BoardStateDto {
    private final List<ShipDto> ships;
    private final List<CellStateDto> missedShots;

    public BoardStateDto(List<ShipDto> ships, List<CellStateDto> missedShots) {
        this.ships = ships;
        this.missedShots = missedShots;
    }

    public List<ShipDto> getShips() { return ships; }
    public List<CellStateDto> getMissedShots() { return missedShots; }
}
