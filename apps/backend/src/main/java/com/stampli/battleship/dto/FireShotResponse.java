package com.stampli.battleship.dto;

public class FireShotResponse {
    private final int row;
    private final int col;
    private final String result;
    private final String sunkShipType;
    private final String nextTurnPlayerId;
    private final String gameStatus;
    private final String winnerId;

    public FireShotResponse(int row, int col, String result, String sunkShipType,
                            String nextTurnPlayerId, String gameStatus, String winnerId) {
        this.row = row;
        this.col = col;
        this.result = result;
        this.sunkShipType = sunkShipType;
        this.nextTurnPlayerId = nextTurnPlayerId;
        this.gameStatus = gameStatus;
        this.winnerId = winnerId;
    }

    public int getRow() { return row; }
    public int getCol() { return col; }
    public String getResult() { return result; }
    public String getSunkShipType() { return sunkShipType; }
    public String getNextTurnPlayerId() { return nextTurnPlayerId; }
    public String getGameStatus() { return gameStatus; }
    public String getWinnerId() { return winnerId; }
}
