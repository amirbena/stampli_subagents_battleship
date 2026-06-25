package com.stampli.battleship.repository;

import com.stampli.battleship.domain.Move;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-memory {@link MoveRepository} implementation backed by a {@link ConcurrentHashMap}
 * keyed by {@code Move.id}.
 * <p>
 * {@code findByGameId} uses a stream filter — acceptable at v1 volumes (≤100 moves/game).
 * A future JPA implementation can index on {@code gameId} without any service changes.
 */
@Repository
public class InMemoryMoveRepository implements MoveRepository {

    private final ConcurrentHashMap<String, Move> store = new ConcurrentHashMap<>();

    @Override
    public void save(Move move) {
        store.put(move.getId(), move);
    }

    @Override
    public List<Move> findByGameId(String gameId) {
        return store.values().stream()
                .filter(m -> m.getGameId().equals(gameId))
                .collect(Collectors.toList());
    }

    @Override
    public List<Move> findAll() {
        return List.copyOf(store.values());
    }
}
