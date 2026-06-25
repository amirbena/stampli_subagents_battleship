package com.stampli.battleship.dto;

import java.time.Instant;

/**
 * Response shape for {@code POST /players} (201) and {@code GET /players/{playerId}} (200).
 * <p>
 * SECURITY (AC-21): contains ONLY {@code playerId}, {@code displayName}, and {@code createdAt}.
 * No board state, game history, move history, or ship positions are included.
 * <p>
 * {@code createdAt} serialises as an ISO-8601 string via Jackson's default
 * {@code JavaTimeModule} configuration (WRITE_DATES_AS_TIMESTAMPS=false confirmed in
 * application.yml — see jackson config note).
 */
public class PlayerResponse {

    private final String playerId;
    private final String displayName;
    private final Instant createdAt;

    public PlayerResponse(String playerId, String displayName, Instant createdAt) {
        this.playerId = playerId;
        this.displayName = displayName;
        this.createdAt = createdAt;
    }

    public String getPlayerId() {
        return playerId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
