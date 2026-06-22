package com.stampli.battleship.dto;

public class CreateGameResponse {
    private final String gameId;
    private final String playerId;
    private final String status;

    public CreateGameResponse(String gameId, String playerId, String status) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
}
