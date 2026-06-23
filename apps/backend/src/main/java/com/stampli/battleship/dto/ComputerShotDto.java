package com.stampli.battleship.dto;

public class ComputerShotDto {
    private final int row;
    private final int col;
    private final String result;
    private final String sunkShipType;
    private final String winnerId;
    private final String gameStatus;

    public ComputerShotDto(int row, int col, String result, String sunkShipType,
                           String winnerId, String gameStatus) {
        this.row = row;
        this.col = col;
        this.result = result;
        this.sunkShipType = sunkShipType;
        this.winnerId = winnerId;
        this.gameStatus = gameStatus;
    }

    public int getRow() { return row; }
    public int getCol() { return col; }
    public String getResult() { return result; }
    public String getSunkShipType() { return sunkShipType; }
    public String getWinnerId() { return winnerId; }
    public String getGameStatus() { return gameStatus; }
}
