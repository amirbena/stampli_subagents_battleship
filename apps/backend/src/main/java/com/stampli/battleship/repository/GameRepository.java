package com.stampli.battleship.repository;

import com.stampli.battleship.domain.Game;

import java.util.List;
import java.util.Optional;

public interface GameRepository {
    void save(Game game);
    Optional<Game> findById(String gameId);
    void delete(String gameId);
    List<Game> findAll();
}
