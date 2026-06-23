package com.stampli.battleship.dto;

public class GameStateResponse {
    private final String gameId;
    private final String status;
    private final String currentTurnPlayerId;
    private final String winnerId;
    private final BoardStateDto myBoard;
    private final BoardStateDto opponentBoard;
    private final boolean myReady;
    private final boolean opponentReady;
    private final String gameMode;

    public GameStateResponse(String gameId, String status, String currentTurnPlayerId,
                             String winnerId, BoardStateDto myBoard, BoardStateDto opponentBoard,
                             boolean myReady, boolean opponentReady) {
        this(gameId, status, currentTurnPlayerId, winnerId, myBoard, opponentBoard,
                myReady, opponentReady, null);
    }

    public GameStateResponse(String gameId, String status, String currentTurnPlayerId,
                             String winnerId, BoardStateDto myBoard, BoardStateDto opponentBoard,
                             boolean myReady, boolean opponentReady, String gameMode) {
        this.gameId = gameId;
        this.status = status;
        this.currentTurnPlayerId = currentTurnPlayerId;
        this.winnerId = winnerId;
        this.myBoard = myBoard;
        this.opponentBoard = opponentBoard;
        this.myReady = myReady;
        this.opponentReady = opponentReady;
        this.gameMode = gameMode;
    }

    public String getGameId() { return gameId; }
    public String getStatus() { return status; }
    public String getCurrentTurnPlayerId() { return currentTurnPlayerId; }
    public String getWinnerId() { return winnerId; }
    public BoardStateDto getMyBoard() { return myBoard; }
    public BoardStateDto getOpponentBoard() { return opponentBoard; }
    public boolean isMyReady() { return myReady; }
    public boolean isOpponentReady() { return opponentReady; }
    public String getGameMode() { return gameMode; }
}
