package com.stampli.battleship.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stampli.battleship.dto.*;
import com.stampli.battleship.domain.GameMode;
import com.stampli.battleship.service.ComputerPlayerService;
import com.stampli.battleship.service.GameException;
import com.stampli.battleship.service.GameService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(GameController.class)
@DisplayName("GameController — HTTP layer")
class GameControllerIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean GameService gameService;
    @MockBean ComputerPlayerService computerPlayerService;

    // ─────────────────────────────────────────────
    // POST /games — Create Game
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games")
    class CreateGame {

        @Test
        @DisplayName("returns 201 with gameId, playerId, status, gameMode for HUMAN mode")
        void createHumanGame() throws Exception {
            when(gameService.createGame(GameMode.HUMAN))
                .thenReturn(new CreateGameResponse("ABC123", "player-1", "WAITING_FOR_PLAYER", "HUMAN"));

            mockMvc.perform(post("/games").param("mode", "HUMAN"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameId").value("ABC123"))
                .andExpect(jsonPath("$.playerId").value("player-1"))
                .andExpect(jsonPath("$.status").value("WAITING_FOR_PLAYER"))
                .andExpect(jsonPath("$.gameMode").value("HUMAN"));
        }

        @Test
        @DisplayName("returns 201 with gameMode=COMPUTER when mode param is COMPUTER")
        void createComputerGame() throws Exception {
            when(gameService.createGame(GameMode.COMPUTER))
                .thenReturn(new CreateGameResponse("XYZ789", "player-1", "PLACING_SHIPS", "COMPUTER"));

            mockMvc.perform(post("/games").param("mode", "COMPUTER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameMode").value("COMPUTER"))
                .andExpect(jsonPath("$.status").value("PLACING_SHIPS"));
        }

        @Test
        @DisplayName("defaults to HUMAN mode when no mode param provided")
        void defaultsToHumanMode() throws Exception {
            when(gameService.createGame(GameMode.HUMAN))
                .thenReturn(new CreateGameResponse("DEF456", "player-1", "WAITING_FOR_PLAYER", "HUMAN"));

            mockMvc.perform(post("/games"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameMode").value("HUMAN"));
        }

        @Test
        @DisplayName("returns 400 when mode param is invalid")
        void invalidModeReturns400() throws Exception {
            mockMvc.perform(post("/games").param("mode", "INVALID"))
                .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────
    // POST /games/{gameId}/join
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games/{gameId}/join")
    class JoinGame {

        @Test
        @DisplayName("returns 200 with playerId on successful join")
        void joinReturnsPlayerId() throws Exception {
            when(gameService.joinGame("ABC123"))
                .thenReturn(new JoinGameResponse("ABC123", "player-2", "PLACING_SHIPS"));

            mockMvc.perform(post("/games/ABC123/join"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").value("player-2"))
                .andExpect(jsonPath("$.gameId").value("ABC123"));
        }

        @Test
        @DisplayName("returns 409 when room is full")
        void roomFullReturns409() throws Exception {
            when(gameService.joinGame("FULL99"))
                .thenThrow(new GameException("Game is full", "GAME_FULL", HttpStatus.CONFLICT));

            mockMvc.perform(post("/games/FULL99/join"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());
        }
    }

    // ─────────────────────────────────────────────
    // POST /games/{gameId}/players/{playerId}/fire
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games/{id}/players/{pid}/fire")
    class FireShot {

        @Test
        @DisplayName("returns 200 with shot result on valid coordinate")
        void validShotReturnsResult() throws Exception {
            FireShotResponse response = new FireShotResponse(3, 5, "HIT", null, "player-2", "IN_PROGRESS", null);
            when(gameService.fireShot(eq("ABC123"), eq("player-1"), any()))
                .thenReturn(response);

            mockMvc.perform(post("/games/ABC123/players/player-1/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":3,\"col\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value("HIT"));
        }

        @Test
        @DisplayName("returns 400 when row is out of bounds (< 0)")
        void outOfBoundsRowReturns400() throws Exception {
            mockMvc.perform(post("/games/ABC123/players/player-1/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":-1,\"col\":5}"))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when col exceeds 9")
        void outOfBoundsColReturns400() throws Exception {
            mockMvc.perform(post("/games/ABC123/players/player-1/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":0,\"col\":10}"))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when body is missing")
        void missingBodyReturns400() throws Exception {
            mockMvc.perform(post("/games/ABC123/players/player-1/fire")
                    .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 409 when it is not this player's turn")
        void wrongTurnReturns409() throws Exception {
            when(gameService.fireShot(eq("ABC123"), eq("player-2"), any()))
                .thenThrow(new GameException("Not your turn", "WRONG_TURN", HttpStatus.CONFLICT));

            mockMvc.perform(post("/games/ABC123/players/player-2/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":0,\"col\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());
        }
    }

    // ─────────────────────────────────────────────
    // GET /games/{gameId}/state
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("GET /games/{id}/state")
    class GetState {

        @Test
        @DisplayName("returns 200 with sanitised game state")
        void returnsGameState() throws Exception {
            GameStateResponse response = new GameStateResponse(
                "ABC123", "IN_PROGRESS", "player-1",
                null, null, null, false, false, "HUMAN");
            when(gameService.getGameState("ABC123", "player-1")).thenReturn(response);

            mockMvc.perform(get("/games/ABC123/state").param("playerId", "player-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value("ABC123"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
        }

        @Test
        @DisplayName("returns 404 when game does not exist")
        void unknownGameReturns404() throws Exception {
            when(gameService.getGameState("NOPE00", "player-1"))
                .thenThrow(new GameException("Game not found", "GAME_NOT_FOUND", HttpStatus.NOT_FOUND));

            mockMvc.perform(get("/games/NOPE00/state").param("playerId", "player-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
        }
    }
}
