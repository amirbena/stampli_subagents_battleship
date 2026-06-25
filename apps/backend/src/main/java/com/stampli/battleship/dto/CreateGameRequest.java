package com.stampli.battleship.dto;

/**
 * Optional request body for {@code POST /games}.
 * <p>
 * All fields are optional for backward compatibility (OQ-1 / AC-23).
 * When {@code playerId} is absent or blank, the backend generates a new UUID
 * for the anonymous path (existing behaviour preserved).
 */
public class CreateGameRequest {

    private String playerId;

    public String getPlayerId() {
        return playerId;
    }

    public void setPlayerId(String playerId) {
        this.playerId = playerId;
    }
}
