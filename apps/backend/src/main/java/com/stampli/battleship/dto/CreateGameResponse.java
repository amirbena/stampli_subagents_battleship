package com.stampli.battleship.dto;

public class CreateGameResponse {
    private final String gameId;
    private final String playerId;
    private final String status;
    private final String gameMode;
    // Per-seat belonging secret, minted ONCE here for the creator's seat. This is the only
    // response that ever carries it; it must never appear in any read DTO.
    private final String sessionToken;

    public CreateGameResponse(String gameId, String playerId, String status, String gameMode,
                              String sessionToken) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.status = status;
        this.gameMode = gameMode;
        this.sessionToken = sessionToken;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getStatus() { return status; }
    public String getGameMode() { return gameMode; }
    public String getSessionToken() { return sessionToken; }
}
