package com.stampli.battleship.repository;

import com.stampli.battleship.domain.PlayerProfile;

import java.util.List;
import java.util.Optional;

/**
 * Repository contract for persistent player identity records.
 * <p>
 * Services depend on this interface only — never on the implementation —
 * so an {@code InMemoryPlayerRepository} can be swapped for
 * {@code JpaPlayerRepository} via {@code @Profile} with zero service changes
 * (CLAUDE.md scalability rule).
 * <p>
 * No {@code findByDisplayName} — display name is a non-unique label;
 * identity is resolved exclusively by ID (AC-10).
 */
public interface PlayerRepository {

    void save(PlayerProfile player);

    Optional<PlayerProfile> findById(String playerId);

    List<PlayerProfile> findAll();
}
