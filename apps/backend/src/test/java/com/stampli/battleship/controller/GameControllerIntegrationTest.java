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
    // Helper — set up a started HUMAN-vs-HUMAN game with both fleets placed.
    // Both players use identical, deterministic placement (ships in rows 0–4),
    // so opponent ship cells are known and HIT/MISS targets are predictable.
    // playerA always takes the first turn once the game starts.
    // ─────────────────────────────────────────────
    private record HumanGame(String gameId, String playerA, String playerB) {}

    private HumanGame startHumanGame() throws Exception {
        MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
            .andExpect(status().isCreated()).andReturn();
        String gameId = field(create, "gameId");
        String playerA = field(create, "playerId");

        MvcResult join = mockMvc.perform(post("/games/{gameId}/join", gameId))
            .andExpect(status().isOk()).andReturn();
        String playerB = field(join, "playerId");

        placeAllShips(gameId, playerA);
        placeAllShips(gameId, playerB);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerA))
            .andExpect(status().isOk());
        mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        return new HumanGame(gameId, playerA, playerB);
    }

    private void fire(String gameId, String playerId, int row, int col) throws Exception {
        mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"row\":%d,\"col\":%d}".formatted(row, col)))
            .andExpect(status().isOk());
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

    // ─────────────────────────────────────────────
    // GET /state — opponentBoard.hits contract (non-sunk hit reveal)
    //
    // Fleet layout (both players, deterministic): all ships rows 0–4, horizontal.
    //   CARRIER (size 5) occupies (0,0),(0,1),(0,2),(0,3),(0,4)
    // A single hit on (0,0) damages but does NOT sink the CARRIER.
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("GET /state — opponentBoard.hits")
    class OpponentBoardHits {

        @Test
        @DisplayName("AC-7: a non-sinking HIT appears in opponentBoard.hits with exactly that coordinate")
        void nonSunkHitAppearsInHits() throws Exception {
            HumanGame g = startHumanGame();

            // playerA fires (0,0) — hits CARRIER but does not sink it
            fire(g.gameId(), g.playerA(), 0, 0);

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA()))
                .andExpect(status().isOk())
                // exactly one hit, and it is (0,0)
                .andExpect(jsonPath("$.opponentBoard.hits", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.opponentBoard.hits[0].row").value(0))
                .andExpect(jsonPath("$.opponentBoard.hits[0].col").value(0));
        }

        @Test
        @DisplayName("AC-11 SECURITY: un-hit cells of the not-yet-sunk ship are absent from hits AND ships")
        void unHitShipCellsNotLeaked() throws Exception {
            HumanGame g = startHumanGame();

            // hit only (0,0) of the 5-cell CARRIER → cells (0,1)..(0,4) remain un-hit & hidden
            fire(g.gameId(), g.playerA(), 0, 0);

            MvcResult state = mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA()))
                .andExpect(status().isOk())
                // ship is not sunk, so no ships are exposed on the opponent board at all
                .andExpect(jsonPath("$.opponentBoard.ships", org.hamcrest.Matchers.hasSize(0)))
                .andReturn();

            // No un-hit CARRIER cell (0,1)..(0,4) may appear anywhere in opponentBoard JSON.
            // hits holds exactly [(0,0)]; the only "0" coordinate present must be col 0.
            String opponentJson =
                objectMapper.readTree(state.getResponse().getContentAsString())
                    .get("opponentBoard").toString();
            for (int col = 1; col <= 4; col++) {
                String leaked = "{\"row\":0,\"col\":" + col + "}";
                org.junit.jupiter.api.Assertions.assertFalse(
                    opponentJson.contains(leaked),
                    "un-hit ship cell " + leaked + " leaked in opponentBoard: " + opponentJson);
            }
        }

        @Test
        @DisplayName("AC-7: a MISS appears in missedShots and NOT in hits")
        void missGoesToMissedShotsNotHits() throws Exception {
            HumanGame g = startHumanGame();

            // A hits (0,0) → turn to B; B misses to return turn to A; A misses (9,9)
            fire(g.gameId(), g.playerA(), 0, 0);
            fire(g.gameId(), g.playerB(), 9, 0); // empty cell → MISS, turn returns to A
            fire(g.gameId(), g.playerA(), 9, 9); // empty cell → MISS

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA()))
                .andExpect(status().isOk())
                // the miss is recorded in missedShots
                .andExpect(jsonPath("$.opponentBoard.missedShots", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.opponentBoard.missedShots[0].row").value(9))
                .andExpect(jsonPath("$.opponentBoard.missedShots[0].col").value(9))
                // hits still holds only the earlier (0,0) HIT — the miss is NOT here
                .andExpect(jsonPath("$.opponentBoard.hits", org.hamcrest.Matchers.hasSize(1)))
                .andExpect(jsonPath("$.opponentBoard.hits[0].row").value(0))
                .andExpect(jsonPath("$.opponentBoard.hits[0].col").value(0));
        }

        @Test
        @DisplayName("myBoard.hits is an empty array (own-board hits flow via ships[].hits)")
        void myBoardHitsIsEmpty() throws Exception {
            HumanGame g = startHumanGame();

            fire(g.gameId(), g.playerA(), 0, 0);

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myBoard.hits").isArray())
                .andExpect(jsonPath("$.myBoard.hits", org.hamcrest.Matchers.hasSize(0)));
        }
    }
}
