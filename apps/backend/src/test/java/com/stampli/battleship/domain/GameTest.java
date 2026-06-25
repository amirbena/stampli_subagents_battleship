package com.stampli.battleship.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-domain unit tests for {@link Game} pause/resume transitions.
 * No Spring context — Game is plain Java.
 */
class GameTest {

    private static final String GAME_ID = "GAME01";

    private Game newWaitingGame() {
        return new Game(GAME_ID, new Player("player-a", GAME_ID));
    }

    private Game gameInStatus(GameStatus target) {
        Game game = newWaitingGame();
        switch (target) {
            case WAITING_FOR_PLAYERS:
                break;
            case PLACING_SHIPS:
                game.addPlayerB(new Player("player-b", GAME_ID));
                break;
            case IN_PROGRESS:
                game.addPlayerB(new Player("player-b", GAME_ID));
                game.startGame();
                break;
            case FINISHED:
                game.addPlayerB(new Player("player-b", GAME_ID));
                game.startGame();
                game.finishGame("player-a");
                break;
            case PAUSED:
                game.pause();
                break;
        }
        return game;
    }

    // --- pause() from each legal status ---

    @Test
    void pauseFromWaitingForPlayersRecordsPriorPhaseAndSetsPaused() {
        Game game = gameInStatus(GameStatus.WAITING_FOR_PLAYERS);
        game.pause();
        assertThat(game.getStatus()).isEqualTo(GameStatus.PAUSED);
        assertThat(game.getStatusBeforePause()).isEqualTo(GameStatus.WAITING_FOR_PLAYERS);
    }

    @Test
    void pauseFromPlacingShipsRecordsPriorPhaseAndSetsPaused() {
        Game game = gameInStatus(GameStatus.PLACING_SHIPS);
        game.pause();
        assertThat(game.getStatus()).isEqualTo(GameStatus.PAUSED);
        assertThat(game.getStatusBeforePause()).isEqualTo(GameStatus.PLACING_SHIPS);
    }

    @Test
    void pauseFromInProgressRecordsPriorPhaseAndSetsPaused() {
        Game game = gameInStatus(GameStatus.IN_PROGRESS);
        game.pause();
        assertThat(game.getStatus()).isEqualTo(GameStatus.PAUSED);
        assertThat(game.getStatusBeforePause()).isEqualTo(GameStatus.IN_PROGRESS);
    }

    // --- pause() rejection ---

    @Test
    void pauseFromPausedIsRejected() {
        Game game = gameInStatus(GameStatus.PAUSED);
        assertThatThrownBy(game::pause).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void pauseFromFinishedIsRejected() {
        Game game = gameInStatus(GameStatus.FINISHED);
        assertThatThrownBy(game::pause).isInstanceOf(IllegalStateException.class);
    }

    // --- resume() ---

    @Test
    void resumeRestoresInProgressAndClearsStatusBeforePause() {
        Game game = gameInStatus(GameStatus.IN_PROGRESS);
        game.pause();
        game.resume();
        assertThat(game.getStatus()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(game.getStatusBeforePause()).isNull();
    }

    @Test
    void resumeRestoresPlacingShipsAndClearsStatusBeforePause() {
        Game game = gameInStatus(GameStatus.PLACING_SHIPS);
        game.pause();
        game.resume();
        assertThat(game.getStatus()).isEqualTo(GameStatus.PLACING_SHIPS);
        assertThat(game.getStatusBeforePause()).isNull();
    }

    @Test
    void resumeWhenNotPausedIsRejected() {
        Game game = gameInStatus(GameStatus.IN_PROGRESS);
        assertThatThrownBy(game::resume).isInstanceOf(IllegalStateException.class);
    }
}
