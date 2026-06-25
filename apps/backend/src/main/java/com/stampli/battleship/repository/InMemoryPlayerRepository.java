package com.stampli.battleship.repository;

import com.stampli.battleship.domain.PlayerProfile;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@link PlayerRepository} implementation backed by a {@link ConcurrentHashMap}.
 * <p>
 * Active when {@code SPRING_PROFILES_ACTIVE=default} (or no profile is set).
 * To switch to persistent storage, implement {@code JpaPlayerRepository}
 * with the appropriate {@code @Profile} annotation — no domain or service
 * changes required (CLAUDE.md scalability rule).
 */
@Repository
public class InMemoryPlayerRepository implements PlayerRepository {

    private final ConcurrentHashMap<String, PlayerProfile> store = new ConcurrentHashMap<>();

    @Override
    public void save(PlayerProfile player) {
        store.put(player.getId(), player);
    }

    @Override
    public Optional<PlayerProfile> findById(String playerId) {
        return Optional.ofNullable(store.get(playerId));
    }

    @Override
    public List<PlayerProfile> findAll() {
        return List.copyOf(store.values());
    }
}
