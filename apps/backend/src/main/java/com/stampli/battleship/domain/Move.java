package com.stampli.battleship.domain;

import java.time.Instant;

/**
 * Persistent audit record for a single shot fired during a game.
 * <p>
 * Both human and computer shots are recorded. Computer moves use the
 * {@code "COMPUTER-<uuid>"} sentinel as {@code playerId} (AC-20).
 * <p>
 * Coordinate convention: {@code x = col} (horizontal), {@code y = row} (vertical)
 * — standard screen convention. The mapping from {@link Coordinate} is performed
 * once, in the service layer when constructing a {@code Move} from a {@link Shot}.
 * <p>
 * {@link MoveResult#SUNK} is used when the winning shot sinks the last ship
 * ({@link ShotResult#WIN} is normalised to {@code SUNK} before saving — AC-19).
 * <p>
 * Pure Java — no Spring annotations (CLAUDE.md invariant).
 */
public final class Move {

    private final String id;         // server-generated UUID
    private final String gameId;     // references Game.id
    private final String playerId;   // PlayerProfile.id OR "COMPUTER-..." sentinel
    private final int x;             // column (Coordinate.col), 0–9
    private final int y;             // row (Coordinate.row), 0–9
    private final MoveResult result; // MISS | HIT | SUNK (WIN normalised to SUNK)
    private final Instant createdAt; // sourced from Shot.firedAt

    public Move(String id, String gameId, String playerId,
                int x, int y, MoveResult result, Instant createdAt) {
        this.id = id;
        this.gameId = gameId;
        this.playerId = playerId;
        this.x = x;
        this.y = y;
        this.result = result;
        this.createdAt = createdAt;
    }

    public String getId() {
        return id;
    }

    public String getGameId() {
        return gameId;
    }

    public String getPlayerId() {
        return playerId;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public MoveResult getResult() {
        return result;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
