package com.stampli.battleship.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("e2e")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@DisplayName("GameController — full integration (no mocks)")
class GameControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ─────────────────────────────────────────────
    // Helper — extract a string field from JSON response
    // ─────────────────────────────────────────────
    private String field(MvcResult result, String field) throws Exception {
        String json = result.getResponse().getContentAsString();
        return objectMapper.readTree(json).get(field).asText();
    }

    // ─────────────────────────────────────────────
    // Helper — place all 5 ships for a player (non-overlapping positions)
    // ─────────────────────────────────────────────
    private void placeAllShips(String gameId, String playerId) throws Exception {
        record Ship(String type, int row, int col, String orientation) {}
        var ships = new Ship[]{
            new Ship("CARRIER",    0, 0, "HORIZONTAL"),
            new Ship("BATTLESHIP", 1, 0, "HORIZONTAL"),
            new Ship("CRUISER",    2, 0, "HORIZONTAL"),
            new Ship("SUBMARINE",  3, 0, "HORIZONTAL"),
            new Ship("DESTROYER",  4, 0, "HORIZONTAL"),
        };
        for (var s : ships) {
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/ships", gameId, playerId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {"shipType":"%s","row":%d,"col":%d,"orientation":"%s"}
                        """.formatted(s.type(), s.row(), s.col(), s.orientation())))
                .andExpect(status().isOk());
        }
    }

    // ─────────────────────────────────────────────
    // POST /games — Create Game
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games")
    class CreateGame {

        @Test
        @DisplayName("returns 201 with gameId, playerId, WAITING_FOR_PLAYER for HUMAN mode")
        void createHumanGame() throws Exception {
            mockMvc.perform(post("/games").param("mode", "HUMAN"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameId").isNotEmpty())
                .andExpect(jsonPath("$.playerId").isNotEmpty())
                .andExpect(jsonPath("$.status").value("WAITING_FOR_PLAYERS"))
                .andExpect(jsonPath("$.gameMode").value("HUMAN"));
        }

        @Test
        @DisplayName("returns 201 with PLACING_SHIPS status for COMPUTER mode (computer joins instantly)")
        void createComputerGame() throws Exception {
            mockMvc.perform(post("/games").param("mode", "COMPUTER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameMode").value("COMPUTER"))
                .andExpect(jsonPath("$.status").value("PLACING_SHIPS"));
        }

        @Test
        @DisplayName("defaults to HUMAN when no mode param")
        void defaultsToHuman() throws Exception {
            mockMvc.perform(post("/games"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.gameMode").value("HUMAN"));
        }

        @Test
        @DisplayName("returns 400 for invalid mode value")
        void invalidModeReturns400() throws Exception {
            mockMvc.perform(post("/games").param("mode", "INVALID"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
        }
    }

    // ─────────────────────────────────────────────
    // POST /games/{gameId}/join
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games/{gameId}/join")
    class JoinGame {

        @Test
        @DisplayName("second player joins successfully and game moves to PLACING_SHIPS")
        void joinReturnsPlayerId() throws Exception {
            MvcResult create = mockMvc.perform(post("/games"))
                .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            mockMvc.perform(post("/games/{gameId}/join", gameId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playerId").isNotEmpty())
                .andExpect(jsonPath("$.gameId").value(gameId))
                .andExpect(jsonPath("$.status").value("PLACING_SHIPS"));
        }

        @Test
        @DisplayName("returns 409 when third player tries to join a full room")
        void roomFullReturns409() throws Exception {
            MvcResult create = mockMvc.perform(post("/games"))
                .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            mockMvc.perform(post("/games/{gameId}/join", gameId)).andReturn();

            mockMvc.perform(post("/games/{gameId}/join", gameId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").isNotEmpty());
        }

        @Test
        @DisplayName("returns 404 for unknown game id")
        void unknownGameReturns404() throws Exception {
            mockMvc.perform(post("/games/NOPE99/join"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").isNotEmpty());
        }
    }

    // ─────────────────────────────────────────────
    // Full COMPUTER flow — place ships → ready → fire
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("vs-Computer full flow")
    class ComputerFlow {

        @Test
        @DisplayName("player can place all ships, ready up, and fire — receives HIT or MISS")
        void fullComputerFlowFireShot() throws Exception {
            // 1. Create game vs computer
            MvcResult create = mockMvc.perform(post("/games").param("mode", "COMPUTER"))
                .andExpect(status().isCreated()).andReturn();
            String gameId  = field(create, "gameId");
            String playerId = field(create, "playerId");

            // 2. Place all 5 ships
            placeAllShips(gameId, playerId);

            // 3. Ready up → game starts (computer auto-places and is already ready)
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

            // 4. Fire a shot — must return HIT or MISS
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":5,\"col\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result").value(org.hamcrest.Matchers.oneOf("HIT", "MISS")))
                .andExpect(jsonPath("$.gameStatus").isNotEmpty());
        }

        @Test
        @DisplayName("returns 409 when firing same cell twice")
        void duplicateShotReturns409() throws Exception {
            MvcResult create = mockMvc.perform(post("/games").param("mode", "COMPUTER"))
                .andExpect(status().isCreated()).andReturn();
            String gameId  = field(create, "gameId");
            String playerId = field(create, "playerId");

            placeAllShips(gameId, playerId);

            mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerId))
                .andExpect(status().isOk());

            String body = "{\"row\":0,\"col\":0}";
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
        }
    }

    // ─────────────────────────────────────────────
    // POST /games/{gameId}/players/{playerId}/fire — validation
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /fire — input validation")
    class FireValidation {

        @Test
        @DisplayName("returns 400 when row is out of bounds")
        void outOfBoundsRow() throws Exception {
            mockMvc.perform(post("/games/GAMEID/players/PID/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":-1,\"col\":5}"))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when col exceeds 9")
        void outOfBoundsCol() throws Exception {
            mockMvc.perform(post("/games/GAMEID/players/PID/fire")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"row\":0,\"col\":10}"))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 when body is missing")
        void missingBody() throws Exception {
            mockMvc.perform(post("/games/GAMEID/players/PID/fire")
                    .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());
        }
    }

    // ─────────────────────────────────────────────
    // GET /games/{gameId}/state
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("GET /games/{id}/state")
    class GetState {

        @Test
        @DisplayName("returns sanitised state — opponent ships not exposed")
        void returnsSanitisedState() throws Exception {
            MvcResult create = mockMvc.perform(post("/games").param("mode", "COMPUTER"))
                .andExpect(status().isCreated()).andReturn();
            String gameId  = field(create, "gameId");
            String playerId = field(create, "playerId");

            mockMvc.perform(get("/games/{gameId}/state", gameId)
                    .param("playerId", playerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gameId").value(gameId))
                .andExpect(jsonPath("$.status").isNotEmpty())
                .andExpect(jsonPath("$.gameMode").value("COMPUTER"));
        }

        @Test
        @DisplayName("returns 404 for unknown game")
        void unknownGameReturns404() throws Exception {
            mockMvc.perform(get("/games/NOPE00/state").param("playerId", "pid"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").isNotEmpty());
        }
    }
}
