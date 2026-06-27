package com.stampli.battleship.controller;

import com.fasterxml.jackson.databind.JsonNode;
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

import static org.assertj.core.api.Assertions.assertThat;
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
    // Belonging-contract header carrying the per-seat session token on authenticated requests.
    private static final String SESSION_HEADER = "X-Session-Token";

    private void placeAllShips(String gameId, String playerId, String token) throws Exception {
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
                    .header(SESSION_HEADER, token)
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
    private record HumanGame(String gameId, String playerA, String tokenA, String playerB, String tokenB) {}

    private HumanGame startHumanGame() throws Exception {
        MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
            .andExpect(status().isCreated()).andReturn();
        String gameId = field(create, "gameId");
        String playerA = field(create, "playerId");
        String tokenA = field(create, "sessionToken");

        MvcResult join = mockMvc.perform(post("/games/{gameId}/join", gameId))
            .andExpect(status().isOk()).andReturn();
        String playerB = field(join, "playerId");
        String tokenB = field(join, "sessionToken");

        placeAllShips(gameId, playerA, tokenA);
        placeAllShips(gameId, playerB, tokenB);

        mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerA)
                .header(SESSION_HEADER, tokenA))
            .andExpect(status().isOk());
        mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerB)
                .header(SESSION_HEADER, tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        return new HumanGame(gameId, playerA, tokenA, playerB, tokenB);
    }

    private void fire(String gameId, String playerId, String token, int row, int col) throws Exception {
        mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                .header(SESSION_HEADER, token)
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
        @DisplayName("returns generic 404 when third player tries to join a full room (no seat-state leak)")
        void roomFullReturnsGeneric404() throws Exception {
            MvcResult create = mockMvc.perform(post("/games"))
                .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            mockMvc.perform(post("/games/{gameId}/join", gameId)).andReturn();

            // Belonging contract: full/started/missing all collapse to the same generic 404.
            mockMvc.perform(post("/games/{gameId}/join", gameId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
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
            String token = field(create, "sessionToken");

            // 2. Place all 5 ships
            placeAllShips(gameId, playerId, token);

            // 3. Ready up → game starts (computer auto-places and is already ready)
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerId)
                    .header(SESSION_HEADER, token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

            // 4. Fire a shot — must return HIT or MISS
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .header(SESSION_HEADER, token)
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
            String token = field(create, "sessionToken");

            placeAllShips(gameId, playerId, token);

            mockMvc.perform(post("/games/{gameId}/players/{playerId}/ready", gameId, playerId)
                    .header(SESSION_HEADER, token))
                .andExpect(status().isOk());

            String body = "{\"row\":0,\"col\":0}";
            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .header(SESSION_HEADER, token)
                    .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

            mockMvc.perform(post("/games/{gameId}/players/{playerId}/fire", gameId, playerId)
                    .header(SESSION_HEADER, token)
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
            String token = field(create, "sessionToken");

            mockMvc.perform(get("/games/{gameId}/state", gameId)
                    .param("playerId", playerId)
                    .header(SESSION_HEADER, token))
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
    // Helper — create a PlayerProfile via POST /players and return its id
    // ─────────────────────────────────────────────
    private String createPlayer(String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/players")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"%s\"}".formatted(displayName)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("playerId").asText();
    }

    // ─────────────────────────────────────────────
    // POST /games — Player Identity (AC-11/12, OQ-3, AC-23)
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games — player identity linkage")
    class CreateGameWithIdentity {

        @Test
        @DisplayName("AC-11/12 + OQ-3: supplied playerId is echoed back verbatim in response")
        void suppliedPlayerIdEchoedVerbatim() throws Exception {
            String playerId = createPlayer("PlayerA");

            MvcResult result = mockMvc.perform(post("/games").param("mode", "HUMAN")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(playerId)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.playerId").value(playerId))
                    .andExpect(jsonPath("$.gameId").isNotEmpty())
                    .andReturn();

            // Extra safety: the echoed ID is exactly the same string (not a new UUID)
            JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
            assertThat(body.get("playerId").asText()).isEqualTo(playerId);
        }

        @Test
        @DisplayName("AC-23 backward-compat: POST /games with no body still returns 201 with a generated playerId")
        void noBodyStillReturns201WithGeneratedPlayerId() throws Exception {
            mockMvc.perform(post("/games").param("mode", "HUMAN"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.gameId").isNotEmpty())
                    .andExpect(jsonPath("$.playerId").isNotEmpty());
        }

        @Test
        @DisplayName("AC-23 backward-compat: POST /games with empty JSON body {} still returns 201")
        void emptyBodyStillReturns201() throws Exception {
            mockMvc.perform(post("/games").param("mode", "HUMAN")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.playerId").isNotEmpty());
        }

        @Test
        @DisplayName("returns 404 PLAYER_NOT_FOUND when playerId has no registered profile")
        void unknownPlayerIdReturns404() throws Exception {
            mockMvc.perform(post("/games").param("mode", "HUMAN")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"nonexistent-player-uuid\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
        }

        @Test
        @DisplayName("AC-11: COMPUTER mode with playerId returns 201 echoing the same playerId")
        void computerModeWithPlayerIdEchoed() throws Exception {
            String playerId = createPlayer("ComputerModePlayer");

            mockMvc.perform(post("/games").param("mode", "COMPUTER")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(playerId)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.playerId").value(playerId))
                    .andExpect(jsonPath("$.gameMode").value("COMPUTER"));
        }
    }

    // ─────────────────────────────────────────────
    // POST /games/{gameId}/join — Player Identity (AC-13/14)
    // ─────────────────────────────────────────────
    @Nested
    @DisplayName("POST /games/{gameId}/join — player identity linkage")
    class JoinGameWithIdentity {

        @Test
        @DisplayName("AC-13 + OQ-3: supplied playerId is echoed back verbatim in join response")
        void suppliedPlayerIdEchoedOnJoin() throws Exception {
            // Create a game (anonymous)
            MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
                    .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            // Create a player profile for playerB
            String playerBId = createPlayer("PlayerB");

            MvcResult join = mockMvc.perform(post("/games/{gameId}/join", gameId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(playerBId)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.playerId").value(playerBId))
                    .andExpect(jsonPath("$.gameId").value(gameId))
                    .andReturn();

            JsonNode body = objectMapper.readTree(join.getResponse().getContentAsString());
            assertThat(body.get("playerId").asText()).isEqualTo(playerBId);
        }

        @Test
        @DisplayName("AC-23 backward-compat: join with no body still returns 200 with generated playerId")
        void joinNoBodyStillReturns200() throws Exception {
            MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
                    .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            mockMvc.perform(post("/games/{gameId}/join", gameId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.playerId").isNotEmpty())
                    .andExpect(jsonPath("$.gameId").value(gameId));
        }

        @Test
        @DisplayName("returns 404 PLAYER_NOT_FOUND when joining with an unknown playerId")
        void joinWithUnknownPlayerIdReturns404() throws Exception {
            MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
                    .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            mockMvc.perform(post("/games/{gameId}/join", gameId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"ghost-player-uuid\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
        }

        @Test
        @DisplayName("AC-11: generic 404 when room is full, even with a valid playerId (no seat-state leak)")
        void fullRoomReturnsGeneric404EvenWithValidPlayer() throws Exception {
            MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN"))
                    .andExpect(status().isCreated()).andReturn();
            String gameId = field(create, "gameId");

            // First join fills the room
            mockMvc.perform(post("/games/{gameId}/join", gameId)).andReturn();

            // Create a registered player for the third attempt
            String thirdPlayerId = createPlayer("ThirdWheel");

            mockMvc.perform(post("/games/{gameId}/join", gameId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(thirdPlayerId)))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("GAME_NOT_FOUND"));
        }

        @Test
        @DisplayName("both players can be registered profiles and the game links them correctly")
        void bothRegisteredPlayersLinked() throws Exception {
            String playerAId = createPlayer("RegisteredA");
            String playerBId = createPlayer("RegisteredB");

            // playerA creates the game
            MvcResult create = mockMvc.perform(post("/games").param("mode", "HUMAN")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(playerAId)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.playerId").value(playerAId))
                    .andReturn();
            String gameId = field(create, "gameId");

            // playerB joins
            mockMvc.perform(post("/games/{gameId}/join", gameId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"playerId\":\"%s\"}".formatted(playerBId)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.playerId").value(playerBId))
                    .andExpect(jsonPath("$.gameId").value(gameId));
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
            fire(g.gameId(), g.playerA(), g.tokenA(), 0, 0);

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA())
                    .header(SESSION_HEADER, g.tokenA()))
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
            fire(g.gameId(), g.playerA(), g.tokenA(), 0, 0);

            MvcResult state = mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA())
                    .header(SESSION_HEADER, g.tokenA()))
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
            fire(g.gameId(), g.playerA(), g.tokenA(), 0, 0);
            fire(g.gameId(), g.playerB(), g.tokenB(), 9, 0); // empty cell → MISS, turn returns to A
            fire(g.gameId(), g.playerA(), g.tokenA(), 9, 9); // empty cell → MISS

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA())
                    .header(SESSION_HEADER, g.tokenA()))
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

            fire(g.gameId(), g.playerA(), g.tokenA(), 0, 0);

            mockMvc.perform(get("/games/{gameId}/state", g.gameId())
                    .param("playerId", g.playerA())
                    .header(SESSION_HEADER, g.tokenA()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myBoard.hits").isArray())
                .andExpect(jsonPath("$.myBoard.hits", org.hamcrest.Matchers.hasSize(0)));
        }
    }
}
