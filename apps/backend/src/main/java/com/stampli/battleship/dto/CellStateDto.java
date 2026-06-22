package com.stampli.battleship.dto;

public class CellStateDto {
    private final int row;
    private final int col;

    public CellStateDto(int row, int col) {
        this.row = row;
        this.col = col;
    }

    public int getRow() { return row; }
    public int getCol() { return col; }
}
