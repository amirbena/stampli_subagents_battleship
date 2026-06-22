package com.stampli.battleship.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public class FireShotRequest {
    @Min(0) @Max(9)
    private int row;

    @Min(0) @Max(9)
    private int col;

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }
    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }
}
