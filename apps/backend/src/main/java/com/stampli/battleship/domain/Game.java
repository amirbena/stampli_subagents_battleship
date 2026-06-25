package com.stampli.battleship.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

public class Game {
    private final String id;
    private GameStatus status;
    private final Player playerA;
    private Player playerB;
    private String currentTurnPlayerId;
    private String winnerPlayerId;
    private final List<Shot> shotHistory;
    private final GameMode gameMode;
    private final Instant createdAt;  // set in constructor (AC-17)
    private Instant finishedAt;       // null until finishGame() is called (AC-17)

    public Game(String id, Player playerA) {
        this(id, playerA, GameMode.HUMAN);
    }

    public Game(String id, Player playerA, GameMode gameMode) {
        this.id = id;
        this.playerA = playerA;
        this.gameMode = gameMode;
        this.status = GameStatus.WAITING_FOR_PLAYERS;
        this.shotHistory = new ArrayList<>();
        this.createdAt = Instant.now();
    }

    public void addPlayerB(Player playerB) {
        this.playerB = playerB;
        this.status = GameStatus.PLACING_SHIPS;
    }

    public void startGame() {
        this.status = GameStatus.IN_PROGRESS;
        this.currentTurnPlayerId = playerA.getId();
    }

    public void finishGame(String winnerPlayerId) {
        this.status = GameStatus.FINISHED;
        this.winnerPlayerId = winnerPlayerId;
        this.currentTurnPlayerId = null;
        this.finishedAt = Instant.now();
    }

    public String getId() {
        return id;
    }

    public GameStatus getStatus() {
        return status;
    }

    public Player getPlayerA() {
        return playerA;
    }

    public Player getPlayerB() {
        return playerB;
    }

    public String getCurrentTurnPlayerId() {
        return currentTurnPlayerId;
    }

    public void setCurrentTurnPlayerId(String playerId) {
        this.currentTurnPlayerId = playerId;
    }

    public String getWinnerPlayerId() {
        return winnerPlayerId;
    }

    public GameMode getGameMode() {
        return gameMode;
    }

    public List<Shot> getShotHistory() {
        return List.copyOf(shotHistory);
    }

    public void addShot(Shot shot) {
        shotHistory.add(shot);
    }

    public Player getPlayer(String playerId) {
        if (playerA != null && playerA.getId().equals(playerId)) return playerA;
        if (playerB != null && playerB.getId().equals(playerId)) return playerB;
        return null;
    }

    public Player getOpponent(String playerId) {
        if (playerA != null && playerA.getId().equals(playerId)) return playerB;
        if (playerB != null && playerB.getId().equals(playerId)) return playerA;
        return null;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }
}
