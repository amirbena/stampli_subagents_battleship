package com.stampli.battleship.controller;

import com.stampli.battleship.domain.GameMode;
import com.stampli.battleship.domain.GameStatus;
import com.stampli.battleship.dto.CreateGameResponse;
import com.stampli.battleship.dto.JoinGameResponse;
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

import static org.mockito.ArgumentMatchers.any;
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
 * Web-layer tests for the session-identity belonging contract: header binding
 * ({@code X-Session-Token} / {@code X-Player-Id}), mint responses carrying the token,
 * read responses never carrying it, 403 on bad token for actions, and generic 404 for
 * non-owner restore/state. Service is mocked.
 */
@WebMvcTest(GameController.class)
class GameControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameService gameService;

    private static final String GAME_ID = "GAME01";
    private static final String PLAYER_ID = "player-a";
    private static final String TOKEN = "session-token-abc";
    private static final String SESSION_HEADER = "X-Session-Token";
    private static final String PLAYER_HEADER = "X-Player-Id";

    // --- create / join mint responses carry sessionToken ---

    @Test
    void createReturns201WithSessionTokenInBody() throws Exception {
        when(gameService.createGame(any(GameMode.class), any()))
                .thenReturn(new CreateGameResponse(GAME_ID, PLAYER_ID, "WAITING_FOR_PLAYERS", "HUMAN", TOKEN));

        mockMvc.perform(post("/games"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.playerId").value(PLAYER_ID))
                .andExpect(jsonPath("$.sessionToken").value(TOKEN));
    }

    @Test
    void joinReturns200WithSessionTokenInBody() throws Exception {
        when(gameService.joinGame(anyString(), any()))
                .thenReturn(new JoinGameResponse(GAME_ID, "player-b", "PLACING_SHIPS", "joiner-token"));

        mockMvc.perform(post("/games/{gameId}/join", GAME_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value("player-b"))
                .andExpect(jsonPath("$.sessionToken").value("joiner-token"));
    }

    @Test
    void joinReturnsGeneric404WhenNotJoinable() throws Exception {
        // Full / already-started / missing all collapse to the same generic 404 (no seat-state leak).
        when(gameService.joinGame(anyString(), any()))
                .thenThrow(new GameException("Game not found or not joinable", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/games/{gameId}/join", GAME_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    // --- pause ---

    @Test
    void pauseReturns200WithPauseResumeBody() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenReturn(new PauseResumeResponse(GAME_ID, GameStatus.PAUSED, GameStatus.IN_PROGRESS));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.status").value("PAUSED"))
                .andExpect(jsonPath("$.previousStatus").value("IN_PROGRESS"));
    }

    @Test
    void pauseReturns403WhenTokenNotAuthorized() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenThrow(new GameException("Not authorized for this seat", "NOT_AUTHORIZED", HttpStatus.FORBIDDEN));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_AUTHORIZED"));
    }

    @Test
    void pauseReturns404WhenGameNotFound() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    @Test
    void pauseReturns409WhenWrongPhase() throws Exception {
        when(gameService.pauseGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenThrow(new GameException("Cannot pause", "WRONG_PHASE", HttpStatus.CONFLICT));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/pause", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WRONG_PHASE"));
    }

    // --- resume ---

    @Test
    void resumeReturns200WithRestoredStatusBody() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenReturn(new PauseResumeResponse(GAME_ID, GameStatus.IN_PROGRESS, GameStatus.PAUSED));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.previousStatus").value("PAUSED"));
    }

    @Test
    void resumeReturns409WhenWrongPhase() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenThrow(new GameException("Not paused", "WRONG_PHASE", HttpStatus.CONFLICT));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("WRONG_PHASE"));
    }

    @Test
    void resumeReturns404WhenGameNotFound() throws Exception {
        when(gameService.resumeGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/resume", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    // --- stop ---

    @Test
    void stopReturns204AndNoBody() throws Exception {
        doNothing().when(gameService).stopGame(GAME_ID, PLAYER_ID, TOKEN);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));
        verify(gameService).stopGame(GAME_ID, PLAYER_ID, TOKEN);
    }

    @Test
    void stopReturns204WhenGameAlreadyAbsentIdempotent() throws Exception {
        // Service treats a missing game as already-stopped — no exception, controller returns 204
        doNothing().when(gameService).stopGame(anyString(), anyString(), anyString());

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", "GONE99", PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isNoContent());
    }

    @Test
    void stopReturns403WhenTokenNotAuthorized() throws Exception {
        doThrow(new GameException("Not authorized for this seat", "NOT_AUTHORIZED", HttpStatus.FORBIDDEN))
                .when(gameService).stopGame(GAME_ID, PLAYER_ID, TOKEN);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/stop", GAME_ID, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_AUTHORIZED"));
    }

    // --- restore-by-code (belonging required; both modes) ---

    @Test
    void restoreReturns200WithSessionPointerAndNoTokenInBody() throws Exception {
        when(gameService.restoreGame(GAME_ID, PLAYER_ID, TOKEN))
                .thenReturn(new RestoreGameResponse(GAME_ID, PLAYER_ID, "COMPUTER", "IN_PROGRESS"));

        mockMvc.perform(get("/games/{code}/restore", GAME_ID)
                        .header(PLAYER_HEADER, PLAYER_ID)
                        .header(SESSION_HEADER, TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(GAME_ID))
                .andExpect(jsonPath("$.playerId").value(PLAYER_ID))
                .andExpect(jsonPath("$.gameMode").value("COMPUTER"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                // The belonging secret must never be echoed by a read response.
                .andExpect(jsonPath("$.sessionToken").doesNotExist());
    }

    @Test
    void restoreReturns404WhenNotOwnerOrUnknown() throws Exception {
        // Foreign caller / unknown code / terminal game all surface the same generic 404.
        when(gameService.restoreGame(anyString(), any(), any()))
                .thenThrow(new GameException("Game not found or not joinable", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(get("/games/{code}/restore", "GONE99")
                        .header(PLAYER_HEADER, PLAYER_ID)
                        .header(SESSION_HEADER, "wrong"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }

    // --- state (belonging required; non-owner → 404) ---

    @Test
    void stateReturns404ForNonOwner() throws Exception {
        when(gameService.getGameState(GAME_ID, PLAYER_ID, "wrong"))
                .thenThrow(new GameException("Game not found or not joinable", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

        mockMvc.perform(get("/games/{gameId}/state", GAME_ID)
                        .param("playerId", PLAYER_ID)
                        .header(SESSION_HEADER, "wrong"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
    }
}
