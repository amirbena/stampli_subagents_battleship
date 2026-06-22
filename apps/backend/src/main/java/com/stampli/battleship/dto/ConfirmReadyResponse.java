package com.stampli.battleship.dto;

public class ConfirmReadyResponse {
    private final String gameId;
    private final String playerId;
    private final String status;
    private final String message;
    private final String currentTurnPlayerId;

    public ConfirmReadyResponse(String gameId, String playerId, String status, String message, String currentTurnPlayerId) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
        this.message = message;
        this.currentTurnPlayerId = currentTurnPlayerId;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
    public String getMessage() { return message; }
    public String getCurrentTurnPlayerId() { return currentTurnPlayerId; }
}
