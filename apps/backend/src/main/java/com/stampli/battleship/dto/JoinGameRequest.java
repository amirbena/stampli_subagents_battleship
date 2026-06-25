package com.stampli.battleship.dto;

/**
 * Request body for {@code POST /games/{gameId}/join}.
 * <p>
 * {@code playerId} is optional (AC-23 backward compat): absent or blank → backend
 * generates a UUID for the anonymous path as before; present → backend uses it
 * verbatim after validating the Player profile exists (OQ-3).
 */
public class JoinGameRequest {
    private String gameId;
    private String playerId;

    public String getGameId() { return gameId; }
    public void setGameId(String gameId) { this.gameId = gameId; }

    public String getPlayerId() { return playerId; }
    public void setPlayerId(String playerId) { this.playerId = playerId; }
}
