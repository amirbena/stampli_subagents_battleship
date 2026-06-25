package com.stampli.battleship.dto;

import com.stampli.battleship.domain.GameStatus;

/**
 * Response body for {@code POST .../pause} and {@code POST .../resume}.
 * <p>
 * Carries no board data — only the lifecycle status transition. Mirrors the
 * frontend {@code PauseResumeResponse} type in {@code types/game.ts}.
 * <ul>
 *   <li>pause:  {@code status = PAUSED},                {@code previousStatus = <prior phase>}</li>
 *   <li>resume: {@code status = <restored prior phase>}, {@code previousStatus = PAUSED}</li>
 * </ul>
 * {@link GameStatus} serialises to its enum name (e.g. {@code "PAUSED"}) via Jackson,
 * matching the frontend {@code GameStatus} union strings.
 */
public class PauseResumeResponse {
    private final String gameId;
    private final GameStatus status;
    private final GameStatus previousStatus;

    public PauseResumeResponse(String gameId, GameStatus status, GameStatus previousStatus) {
        this.gameId = gameId;
        this.status = status;
        this.previousStatus = previousStatus;
    }

    public String getGameId() { return gameId; }
    public GameStatus getStatus() { return status; }
    public GameStatus getPreviousStatus() { return previousStatus; }
}
