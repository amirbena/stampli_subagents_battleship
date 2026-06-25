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

import java.time.Instant;
import java.time.format.DateTimeFormatter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for {@code PlayerController} — {@code POST /players} and
 * {@code GET /players/{playerId}}.
 *
 * <p>Tests run against the full Spring context with H2 in-memory storage (e2e profile).
 * No mocks. Each test method gets a fresh context via {@code @DirtiesContext}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("e2e")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@DisplayName("PlayerController — full integration (no mocks)")
class PlayerControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Perform POST /players and return the parsed response tree. */
    private JsonNode createPlayerJson(String displayName) throws Exception {
        MvcResult result = mockMvc.perform(post("/players")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"%s\"}".formatted(displayName)))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    // -------------------------------------------------------------------------
    // POST /players
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("POST /players")
    class CreatePlayer {

        @Test
        @DisplayName("AC-05: valid name returns 201 with playerId, displayName, and createdAt")
        void happyPath201() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"Alex\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.playerId").isNotEmpty())
                    .andExpect(jsonPath("$.displayName").value("Alex"))
                    .andExpect(jsonPath("$.createdAt").isNotEmpty());
        }

        @Test
        @DisplayName("createdAt serialises as ISO-8601 string, not an epoch number")
        void createdAtIsIso8601String() throws Exception {
            JsonNode body = createPlayerJson("TestPlayer");
            String createdAtRaw = body.get("createdAt").asText();

            // Must parse without error as an ISO-8601 Instant (e.g. "2026-06-25T06:48:00Z")
            Instant parsed = DateTimeFormatter.ISO_INSTANT.parse(createdAtRaw, Instant::from);
            assertThat(parsed).isNotNull();

            // Must NOT be a plain number (epoch seconds/millis)
            assertThat(createdAtRaw).matches(".*T.*");
        }

        @Test
        @DisplayName("response contains ONLY playerId, displayName, createdAt — no board/ship/history fields (AC-21)")
        void responseHasOnlyThreeFields() throws Exception {
            JsonNode body = createPlayerJson("SafePlayer");

            // Assert the three expected fields are present
            assertThat(body.has("playerId")).isTrue();
            assertThat(body.has("displayName")).isTrue();
            assertThat(body.has("createdAt")).isTrue();

            // Assert no leaking fields
            assertThat(body.has("board")).isFalse();
            assertThat(body.has("ships")).isFalse();
            assertThat(body.has("shotHistory")).isFalse();
            assertThat(body.has("gameId")).isFalse();
            assertThat(body.has("ready")).isFalse();
            assertThat(body.has("moves")).isFalse();
            assertThat(body.has("history")).isFalse();
            assertThat(body.size()).isEqualTo(3);
        }

        @Test
        @DisplayName("displayName is stored trimmed (EC-04)")
        void displayNameIsTrimmed() throws Exception {
            JsonNode body = createPlayerJson("  Alice  ");
            // The response displayName should be the trimmed value
            assertThat(body.get("displayName").asText()).isEqualTo("Alice");
        }

        // --- Validation failures ---

        @Test
        @DisplayName("AC-02: empty displayName returns 400 DISPLAY_NAME_REQUIRED")
        void emptyDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Display name is required"))
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_REQUIRED"));
        }

        @Test
        @DisplayName("AC-02: blank displayName (whitespace-only) returns 400 DISPLAY_NAME_REQUIRED")
        void blankDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"   \"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Display name is required"))
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_REQUIRED"));
        }

        @Test
        @DisplayName("AC-02: null displayName field returns 400 DISPLAY_NAME_REQUIRED")
        void nullDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":null}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Display name is required"))
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_REQUIRED"));
        }

        @Test
        @DisplayName("AC-03: displayName exceeding 30 chars returns 400 DISPLAY_NAME_TOO_LONG")
        void tooLongDisplayNameReturns400() throws Exception {
            String longName = "A".repeat(31); // 31 chars — one over the limit
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"%s\"}".formatted(longName)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("Display name must be 30 characters or fewer"))
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_TOO_LONG"));
        }

        @Test
        @DisplayName("AC-03: exactly 30 chars is accepted (boundary — not too long)")
        void exactlyThirtyCharsAccepted() throws Exception {
            String exactly30 = "A".repeat(30);
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"%s\"}".formatted(exactly30)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.displayName").value(exactly30));
        }

        @Test
        @DisplayName("AC-04: displayName with invalid characters returns 400 DISPLAY_NAME_INVALID_CHARS")
        void invalidCharsDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"Alice@123\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value(
                            "Display name may only contain letters, numbers, spaces, hyphens, and underscores"))
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_INVALID_CHARS"));
        }

        @Test
        @DisplayName("AC-04: displayName with emoji returns 400 DISPLAY_NAME_INVALID_CHARS")
        void emojiDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"Alex😀\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_INVALID_CHARS"));
        }

        @Test
        @DisplayName("AC-04: displayName with angle brackets returns 400 DISPLAY_NAME_INVALID_CHARS")
        void angleBracketDisplayNameReturns400() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"<script>\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("DISPLAY_NAME_INVALID_CHARS"));
        }

        @Test
        @DisplayName("AC-04: allowed chars — letters, digits, space, hyphen, underscore — all accepted")
        void allowedCharSetAccepted() throws Exception {
            mockMvc.perform(post("/players")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"displayName\":\"Alex 42_best-player\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.displayName").value("Alex 42_best-player"));
        }

        @Test
        @DisplayName("AC-10: two calls with the same displayName create two distinct playerIds (no dedup)")
        void sameDisplayNameTwoDistinctIds() throws Exception {
            JsonNode first  = createPlayerJson("Alice");
            JsonNode second = createPlayerJson("Alice");

            String id1 = first.get("playerId").asText();
            String id2 = second.get("playerId").asText();

            assertThat(id1).isNotBlank();
            assertThat(id2).isNotBlank();
            assertThat(id1).isNotEqualTo(id2);
        }
    }

    // -------------------------------------------------------------------------
    // GET /players/{playerId}
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("GET /players/{playerId}")
    class GetPlayer {

        @Test
        @DisplayName("returns 200 with playerId, displayName, and createdAt for existing player")
        void happyPath200() throws Exception {
            // Create a player first
            JsonNode created = createPlayerJson("Bob");
            String playerId  = created.get("playerId").asText();

            mockMvc.perform(get("/players/{playerId}", playerId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.playerId").value(playerId))
                    .andExpect(jsonPath("$.displayName").value("Bob"))
                    .andExpect(jsonPath("$.createdAt").isNotEmpty());
        }

        @Test
        @DisplayName("GET returns the same createdAt value as the POST response")
        void createdAtConsistentBetweenCreateAndGet() throws Exception {
            JsonNode created     = createPlayerJson("Charlie");
            String playerId      = created.get("playerId").asText();
            String createdAtPost = created.get("createdAt").asText();

            MvcResult getResult = mockMvc.perform(get("/players/{playerId}", playerId))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode fetched        = objectMapper.readTree(getResult.getResponse().getContentAsString());
            String createdAtGet     = fetched.get("createdAt").asText();

            assertThat(createdAtGet).isEqualTo(createdAtPost);
        }

        @Test
        @DisplayName("AC-21: response contains ONLY playerId, displayName, createdAt — no board/ship/history")
        void responseHasOnlyThreeFields() throws Exception {
            JsonNode created = createPlayerJson("Dana");
            String playerId  = created.get("playerId").asText();

            MvcResult getResult = mockMvc.perform(get("/players/{playerId}", playerId))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode body = objectMapper.readTree(getResult.getResponse().getContentAsString());

            assertThat(body.has("playerId")).isTrue();
            assertThat(body.has("displayName")).isTrue();
            assertThat(body.has("createdAt")).isTrue();

            // AC-21: no board state or history fields
            assertThat(body.has("board")).isFalse();
            assertThat(body.has("ships")).isFalse();
            assertThat(body.has("shotHistory")).isFalse();
            assertThat(body.has("gameId")).isFalse();
            assertThat(body.has("ready")).isFalse();
            assertThat(body.has("moves")).isFalse();
            assertThat(body.has("history")).isFalse();
            assertThat(body.size()).isEqualTo(3);
        }

        @Test
        @DisplayName("createdAt in GET response serialises as ISO-8601 string")
        void createdAtIsIso8601String() throws Exception {
            JsonNode created = createPlayerJson("Eve");
            String playerId  = created.get("playerId").asText();

            MvcResult getResult = mockMvc.perform(get("/players/{playerId}", playerId))
                    .andExpect(status().isOk())
                    .andReturn();
            JsonNode body        = objectMapper.readTree(getResult.getResponse().getContentAsString());
            String createdAtRaw  = body.get("createdAt").asText();

            Instant parsed = DateTimeFormatter.ISO_INSTANT.parse(createdAtRaw, Instant::from);
            assertThat(parsed).isNotNull();
            assertThat(createdAtRaw).matches(".*T.*");
        }

        @Test
        @DisplayName("returns 404 PLAYER_NOT_FOUND for unknown playerId")
        void unknownPlayerIdReturns404() throws Exception {
            mockMvc.perform(get("/players/unknown-uuid-that-does-not-exist"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("Player not found"))
                    .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
        }

        @Test
        @DisplayName("returns 404 for a well-formed UUID that was never registered")
        void validUuidNotFoundReturns404() throws Exception {
            String fakeId = "00000000-0000-0000-0000-000000000000";
            mockMvc.perform(get("/players/{playerId}", fakeId))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("PLAYER_NOT_FOUND"));
        }
    }
}
