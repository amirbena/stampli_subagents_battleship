package com.stampli.battleship.repository;

import com.stampli.battleship.domain.Game;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory {@link GameRepository} implementation backed by a {@link ConcurrentHashMap}.
 * <p>
 * Active when {@code SPRING_PROFILES_ACTIVE=default} (or no profile is set).
 * To switch to persistent storage, implement {@code JpaGameRepository} or
 * {@code RedisGameRepository} with the appropriate {@code @Profile} annotation —
 * no domain or service changes required.
 */
@Repository
public class InMemoryGameRepository implements GameRepository {

    private final ConcurrentHashMap<String, Game> store = new ConcurrentHashMap<>();

    /**
     * Persists or replaces a game by its ID.
     *
     * @param game the game to save
     */
    @Override
    public void save(Game game) {
        store.put(game.getId(), game);
    }

    /**
     * Looks up a game by its room code / UUID.
     *
     * @param gameId the game identifier
     * @return an {@link Optional} containing the game, or empty if not found
     */
    @Override
    public Optional<Game> findById(String gameId) {
        return Optional.ofNullable(store.get(gameId));
    }

    /**
     * Removes a game from the store. Used for cleanup after a game ends.
     *
     * @param gameId the game to delete
     */
    @Override
    public void delete(String gameId) {
        store.remove(gameId);
    }

    /**
     * Returns an immutable snapshot of all active games.
     *
     * @return list of all games currently in memory
     */
    @Override
    public List<Game> findAll() {
        return List.copyOf(store.values());
    }
}
