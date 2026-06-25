package com.stampli.battleship.service;

import com.stampli.battleship.domain.Game;
import com.stampli.battleship.domain.GameStatus;
import com.stampli.battleship.domain.Player;
import com.stampli.battleship.dto.PauseResumeResponse;
import com.stampli.battleship.repository.GameRepository;
import com.stampli.battleship.repository.MoveRepository;
import com.stampli.battleship.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Service-layer unit tests for pause/resume/stop with a mocked repository.
 */
@ExtendWith(MockitoExtension.class)
class GamePauseResumeStopServiceTest {

    @Mock private GameRepository gameRepository;
    @Mock private PlacementValidationService placementValidationService;
    @Mock private ComputerPlayerService computerPlayerService;
    @Mock private PlayerRepository playerRepository;
    @Mock private MoveRepository moveRepository;

    @InjectMocks private GameService gameService;

    private static final String GAME_ID = "GAME01";
    private static final String PLAYER_A_ID = "player-a";
    private static final String PLAYER_B_ID = "player-b";
    private static final String OUTSIDER_ID = "outsider";

    private Game inProgressGame;

    @BeforeEach
    void setUp() {
        inProgressGame = new Game(GAME_ID, new Player(PLAYER_A_ID, GAME_ID));
        inProgressGame.addPlayerB(new Player(PLAYER_B_ID, GAME_ID));
        inProgressGame.startGame();
    }

    // --- pauseGame ---

    @Test
    void pauseGameHappyPathReturnsPausedAndPriorStatusAndSaves() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        PauseResumeResponse response = gameService.pauseGame(GAME_ID, PLAYER_A_ID);

        assertThat(response.getGameId()).isEqualTo(GAME_ID);
        assertThat(response.getStatus()).isEqualTo(GameStatus.PAUSED);
        assertThat(response.getPreviousStatus()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(inProgressGame.getStatus()).isEqualTo(GameStatus.PAUSED);
        verify(gameRepository).save(inProgressGame);
    }

    @Test
    void pauseGameByNonParticipantThrowsPlayerNotInGame() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        assertThatThrownBy(() -> gameService.pauseGame(GAME_ID, OUTSIDER_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("PLAYER_NOT_IN_GAME");
        verify(gameRepository, never()).save(inProgressGame);
    }

    @Test
    void pauseGameNotFoundThrowsGameNotFound() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gameService.pauseGame(GAME_ID, PLAYER_A_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("GAME_NOT_FOUND");
    }

    @Test
    void pauseGameWhenAlreadyPausedThrowsWrongPhase() {
        inProgressGame.pause();
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        assertThatThrownBy(() -> gameService.pauseGame(GAME_ID, PLAYER_A_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("WRONG_PHASE");
    }

    // --- resumeGame ---

    @Test
    void resumeGameHappyPathRestoresPriorPhaseAndSaves() {
        inProgressGame.pause();
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        PauseResumeResponse response = gameService.resumeGame(GAME_ID, PLAYER_A_ID);

        assertThat(response.getGameId()).isEqualTo(GAME_ID);
        assertThat(response.getStatus()).isEqualTo(GameStatus.IN_PROGRESS);
        assertThat(response.getPreviousStatus()).isEqualTo(GameStatus.PAUSED);
        assertThat(inProgressGame.getStatus()).isEqualTo(GameStatus.IN_PROGRESS);
        verify(gameRepository).save(inProgressGame);
    }

    @Test
    void resumeGameByNonParticipantThrowsPlayerNotInGame() {
        inProgressGame.pause();
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        assertThatThrownBy(() -> gameService.resumeGame(GAME_ID, OUTSIDER_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("PLAYER_NOT_IN_GAME");
    }

    @Test
    void resumeGameNotFoundThrowsGameNotFound() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> gameService.resumeGame(GAME_ID, PLAYER_A_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("GAME_NOT_FOUND");
    }

    @Test
    void resumeGameWhenNotPausedThrowsWrongPhase() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        assertThatThrownBy(() -> gameService.resumeGame(GAME_ID, PLAYER_A_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("WRONG_PHASE");
    }

    // --- stopGame ---

    @Test
    void stopGameWhenPresentValidatesOwnerAndDeletes() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        gameService.stopGame(GAME_ID, PLAYER_A_ID);

        verify(gameRepository).delete(GAME_ID);
    }

    @Test
    void stopGameByNonParticipantThrowsPlayerNotInGameAndDoesNotDelete() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.of(inProgressGame));

        assertThatThrownBy(() -> gameService.stopGame(GAME_ID, OUTSIDER_ID))
                .isInstanceOf(GameException.class)
                .extracting("errorCode").isEqualTo("PLAYER_NOT_IN_GAME");
        verify(gameRepository, never()).delete(GAME_ID);
    }

    @Test
    void stopGameWhenAbsentIsIdempotentNoOp() {
        when(gameRepository.findById(GAME_ID)).thenReturn(Optional.empty());

        gameService.stopGame(GAME_ID, PLAYER_A_ID);

        verify(gameRepository, never()).delete(GAME_ID);
    }
}
