package com.stampli.battleship.dto;

import com.stampli.battleship.domain.Orientation;
import com.stampli.battleship.domain.ShipType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class PlaceShipRequest {
    @NotNull
    private ShipType shipType;

    @Min(0) @Max(9)
    private int row;

    @Min(0) @Max(9)
    private int col;

    @NotNull
    private Orientation orientation;

    public ShipType getShipType() { return shipType; }
    public void setShipType(ShipType shipType) { this.shipType = shipType; }
    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }
    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }
    public Orientation getOrientation() { return orientation; }
    public void setOrientation(Orientation orientation) { this.orientation = orientation; }
}
