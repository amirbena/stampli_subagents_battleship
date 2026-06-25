package com.stampli.battleship.repository;

import com.stampli.battleship.domain.Move;

import java.util.List;

/**
 * Repository contract for shot/move audit records.
 * <p>
 * Services depend on this interface only. {@code InMemoryMoveRepository} is the
 * default; a {@code JpaMoveRepository} can be substituted via {@code @Profile}
 * with zero service changes (CLAUDE.md scalability rule).
 */
public interface MoveRepository {

    void save(Move move);

    /**
     * Returns all moves for a specific game. Forward-looking: supports future
     * leaderboard/stats read endpoints without requiring a schema change.
     *
     * @param gameId the game whose moves to retrieve
     * @return all recorded moves for the game, in insertion order (no guarantee at v1)
     */
    List<Move> findByGameId(String gameId);

    List<Move> findAll();
}
