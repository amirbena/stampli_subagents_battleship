package com.stampli.battleship.domain;

public class Player {
    private final String id;
    private final String gameId;
    private boolean ready;
    private final Board board;
    // Per-seat belonging secret. Set once when the seat is minted (create/join), never mutated.
    // Distinct from the non-secret {@code id}; it is the only proof of seat ownership and is
    // never placed into any read DTO. The computer AI seat may carry null (it never authenticates).
    private final String sessionToken;

    public Player(String id, String gameId) {
        this(id, gameId, null);
    }

    public Player(String id, String gameId, String sessionToken) {
        this.id = id;
        this.gameId = gameId;
        this.ready = false;
        this.board = new Board();
        this.sessionToken = sessionToken;
    }

    public String getId() {
        return id;
    }

    public String getGameId() {
        return gameId;
    }

    public boolean isReady() {
        return ready;
    }

    public void confirmReady() {
        this.ready = true;
    }

    public Board getBoard() {
        return board;
    }

    public String getSessionToken() {
        return sessionToken;
    }
}
