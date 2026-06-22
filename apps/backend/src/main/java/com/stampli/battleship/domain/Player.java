package com.stampli.battleship.domain;

public class Player {
    private final String id;
    private final String gameId;
    private boolean ready;
    private final Board board;

    public Player(String id, String gameId) {
        this.id = id;
        this.gameId = gameId;
        this.ready = false;
        this.board = new Board();
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
}
