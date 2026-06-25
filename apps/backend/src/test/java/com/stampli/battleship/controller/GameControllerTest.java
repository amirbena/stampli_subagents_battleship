package com.stampli.battleship.controller;

import com.stampli.battleship.domain.GameStatus;
import com.stampli.battleship.dto.PauseResumeResponse;
import com.stampli.battleship.dto.RestoreGameResponse;
import com.stampli.battleship.service.GameException;
import com.stampli.battleship.service.GameService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web-layer tests for the pause/resume/stop endpoints. Service is mocked;
 * asserts HTTP status, JSON body shape, and error-code mapping.
 */
@WebMvcTest(GameController.class)
class GameControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameService gameService;

    private static final String GAME_ID = "GAME01";
    private static final String PLAYER_ID = "player-a";

    // --- pause ---

    @Test
    void pauseReturns200WithPauseResumeBody() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID))
                .thenReturn(new PauseResumeResponse(GAME_ID, GameStatus.PAUSED, GameStatus.IN_PROGRESS));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.status").value("PAUSED"))
                .andExpect(jsonPath("$.previousStatus").value("IN_PROGRESS"));
    }

    @Test
    void pauseReturns403WhenPlayerNotInGame() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID))
                .thenThrow(new GameException("Player not in game", "PLAYER_NOT_IN_GAME", HttpStatus.FORBIDDEN));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_IN_GAME"));
    }

    @Test
    void pauseReturns404WhenGameNotFound() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void pauseReturns409WhenWrongPhase() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID))
                .thenThrow(new GameException("Cannot pause", "WRONG_PHASE", HttpStatus.CONFLICT));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WRONG_PHASE"));
    }

    // --- resume ---

    @Test
    void resumeReturns200WithRestoredStatusBody() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID))
                .thenReturn(new PauseResumeResponse(GAME_ID, GameStatus.IN_PROGRESS, GameStatus.PAUSED));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.previousStatus").value("PAUSED"));
    }

    @Test
    void resumeReturns409WhenWrongPhase() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID))
                .thenThrow(new GameException("Not paused", "WRONG_PHASE", HttpStatus.CONFLICT));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WRONG_PHASE"));
    }

    @Test
    void resumeReturns404WhenGameNotFound() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    // --- stop ---

    @Test
    void stopReturns204AndNoBody() throws Exception {
        doNothing().when(gameService).stopGame(GAME_ID, PLAYER_ID);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", GAME_ID, PLAYER_ID))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(gameService).stopGame(GAME_ID, PLAYER_ID);
    }

    @Test
    void stopReturns204WhenGameAlreadyAbsentIdempotent() throws Exception {
        // Service treats a missing game as already-stopped — no exception, controller returns 204
        doNothing().when(gameService).stopGame(anyString(), anyString());

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", "GONE99", PLAYER_ID))
                .andExpect(status().isNoContent());
    }

    @Test
    void stopReturns403WhenPlayerNotInGame() throws Exception {
        doThrow(new GameException("Player not in game", "PLAYER_NOT_IN_GAME", HttpStatus.FORBIDDEN))
                .when(gameService).stopGame(GAME_ID, PLAYER_ID);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", GAME_ID, PLAYER_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PLAYER_NOT_IN_GAME"));
    }

    // --- restore-by-code ---

    @Test
    void restoreReturns200WithSessionPointerJsonShape() throws Exception {
        when(gameService.restoreGame(GAME_ID))
                .thenReturn(new RestoreGameResponse(GAME_ID, PLAYER_ID, "COMPUTER", "IN_PROGRESS"));

        mockMvc.perform(get("/games/{code}/restore", GAME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.playerId").value(PLAYER_ID))
                .andExpect(jsonPath("$.gameMode").value("COMPUTER"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }

    @Test
    void restoreReturns404WhenCodeUnknown() throws Exception {
        when(gameService.restoreGame("GONE99"))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(get("/games/{code}/restore", "GONE99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void restoreReturns404WhenGameNotComputer() throws Exception {
        // Non-computer (human) game is reported as the same uniform 404 — no type disclosure
        when(gameService.restoreGame(GAME_ID))
                .thenThrow(new GameException("Game not found: " + GAME_ID, "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(get("/games/{code}/restore", GAME_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }
}
