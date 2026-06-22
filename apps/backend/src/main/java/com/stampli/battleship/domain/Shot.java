package com.stampli.battleship.domain;

import java.time.Instant;

public final class Shot {
    private final String playerId;
    private final Coordinate coordinate;
    private final ShotResult result;
    private final Instant firedAt;

    public Shot(String playerId, Coordinate coordinate, ShotResult result) {
        this.playerId = playerId;
        this.coordinate = coordinate;
        this.result = result;
        this.firedAt = Instant.now();
    }

    public String getPlayerId() {
        return playerId;
    }

    public Coordinate getCoordinate() {
        return coordinate;
    }

    public ShotResult getResult() {
        return result;
    }

    public Instant getFiredAt() {
        return firedAt;
    }
}
