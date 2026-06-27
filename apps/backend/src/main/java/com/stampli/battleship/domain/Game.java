package com.stampli.battleship.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
    // Remembers the phase the game was in when paused, so resume() can restore it exactly.
    // null unless status == PAUSED.
    private GameStatus statusBeforePause;

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

    /**
     * Pauses the game. Legal only from an active, non-terminal phase
     * (WAITING_FOR_PLAYERS, PLACING_SHIPS, or IN_PROGRESS). Records the current
     * phase in {@code statusBeforePause} so resume() can restore it exactly.
     *
     * @throws IllegalStateException if the game is already PAUSED or FINISHED
     */
    public void pause() {
        if (status != GameStatus.WAITING_FOR_PLAYERS
                && status != GameStatus.PLACING_SHIPS
                && status != GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cannot pause a game in status " + status);
        }
        this.statusBeforePause = this.status;
        this.status = GameStatus.PAUSED;
    }

    /**
     * Resumes a paused game, restoring the phase it was in when paused and
     * clearing {@code statusBeforePause}.
     *
     * @throws IllegalStateException if the game is not currently PAUSED
     */
    public void resume() {
        if (status != GameStatus.PAUSED) {
            throw new IllegalStateException("Cannot resume a game in status " + status);
        }
        this.status = this.statusBeforePause;
        this.statusBeforePause = null;
    }

    public GameStatus getStatusBeforePause() {
        return statusBeforePause;
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

    /**
     * Proves seat belonging: the caller owns the {@code playerId} seat iff the supplied
     * {@code sessionToken} matches the secret minted for that seat. A non-secret playerId
     * alone is never sufficient. Comparison is constant-time ({@link MessageDigest#isEqual})
     * to avoid a timing oracle on the secret. The computer AI seat (null token) can never
     * be owned by any caller.
     *
     * @return true only if the seat exists, has a non-null token, and the token matches
     */
    public boolean ownsSeat(String playerId, String sessionToken) {
        Player p = getPlayer(playerId);
        if (p == null || p.getSessionToken() == null || sessionToken == null) {
            return false;
        }
        return MessageDigest.isEqual(
                p.getSessionToken().getBytes(StandardCharsets.UTF_8),
                sessionToken.getBytes(StandardCharsets.UTF_8));
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
