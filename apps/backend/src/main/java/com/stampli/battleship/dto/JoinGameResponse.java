package com.stampli.battleship.dto;

public class JoinGameResponse {
    private final String gameId;
    private final String playerId;
    private final String status;
    // Per-seat belonging secret, minted ONCE here for the joining seat. Only mint responses
    // carry it; it is never echoed by any read DTO.
    private final String sessionToken;

    public JoinGameResponse(String gameId, String playerId, String status, String sessionToken) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
        this.sessionToken = sessionToken;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
    public String getSessionToken() { return sessionToken; }
}
