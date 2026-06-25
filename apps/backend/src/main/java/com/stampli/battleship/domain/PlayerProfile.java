package com.stampli.battleship.domain;

import java.time.Instant;

/**
 * Persistent identity record for a named guest player.
 * <p>
 * Kept separate from the game-session {@link Player} class (which carries a {@link Board}
 * and lives inside one {@link Game}). {@code PlayerProfile} is the stable identity that
 * outlives any single game session; the two are linked only by sharing the same UUID string.
 * <p>
 * Pure Java — no Spring annotations (CLAUDE.md invariant).
 */
public final class PlayerProfile {

    private final String id;          // server-generated UUID
    private final String displayName; // trimmed, 1–30 chars, validated charset
    private final Instant createdAt;  // server-assigned at creation; never modified

    public PlayerProfile(String id, String displayName, Instant createdAt) {
        this.id = id;
        this.displayName = displayName;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
