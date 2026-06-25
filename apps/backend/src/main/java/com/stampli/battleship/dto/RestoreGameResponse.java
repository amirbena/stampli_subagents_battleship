package com.stampli.battleship.dto;

/**
 * Response for restore-by-code (GET /games/{code}/restore).
 * <p>
 * Carries only the session pointer fields the client needs to rehydrate its
 * local game pointer; it deliberately contains NO board or ship data. Board
 * rendering stays on the single hidden-data-safe {@code getGameState} path, so
 * restore never has to reason about opponent ship visibility.
 */
public class RestoreGameResponse {
    private final String gameId;
    private final String playerId;
    private final String gameMode;
    private final String status;

    public RestoreGameResponse(String gameId, String playerId, String gameMode, String status) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.gameMode = gameMode;
        this.status = status;
    }

    public String getGameId() { return gameId; }
    public String getPlayerId() { return playerId; }
    public String getGameMode() { return gameMode; }
    public String getStatus() { return status; }
}
