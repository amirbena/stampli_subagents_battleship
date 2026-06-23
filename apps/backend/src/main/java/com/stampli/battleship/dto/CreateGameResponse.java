package com.stampli.battleship.dto;

public class CreateGameResponse {
    private final String gameId;
    private final String playerId;
    private final String status;
    private final String gameMode;

    public CreateGameResponse(String gameId, String playerId, String status, String gameMode) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
        this.gameMode = gameMode;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
    public String getGameMode() { return gameMode; }
}
