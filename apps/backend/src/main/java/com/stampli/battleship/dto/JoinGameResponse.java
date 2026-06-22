package com.stampli.battleship.dto;

public class JoinGameResponse {
    private final String gameId;
    private final String playerId;
    private final String status;

    public JoinGameResponse(String gameId, String playerId, String status) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
}
