package com.stampli.battleship.config;

import com.stampli.battleship.controller.GameController;
import com.stampli.battleship.service.ComputerPlayerService;
import com.stampli.battleship.service.GameService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * @WebMvcTest for CorsConfig — verifies that allowedOriginPatterns(http://localhost:[*])
 * reflects any localhost port and blocks non-localhost origins.
 *
 * Uses @WebMvcTest so only the web layer (DispatcherServlet + CorsConfig) is loaded.
 * GameService and ComputerPlayerService are mocked because GameController depends on them
 * and @WebMvcTest will fail to start without beans for all @RestController dependencies.
 */
@WebMvcTest(GameController.class)
@Import(CorsConfig.class)
@TestPropertySource(properties = {
        "battleship.cors.allowed-origin-pattern=http://localhost:[*]"
})
@DisplayName("CorsConfig — allowedOriginPatterns")
class CorsConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameService gameService;

    @MockBean
    private ComputerPlayerService computerPlayerService;

    @Test
    @DisplayName("Preflight from http://localhost:3000 is allowed — Access-Control-Allow-Origin echoed back")
    void preflightFromLocalhostPort3000_isAllowed() throws Exception {
        mockMvc.perform(
                options("/games")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
                // Spring CORS sets 200 for preflight when origin is matched
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:3000"
                ));
    }

    @Test
    @DisplayName("Preflight from http://localhost:3030 is allowed — Access-Control-Allow-Origin echoed back")
    void preflightFromLocalhostPort3030_isAllowed() throws Exception {
        mockMvc.perform(
                options("/games")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3030")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN,
                        "http://localhost:3030"
                ));
    }

    @Test
    @DisplayName("Preflight from http://evil.example.com is blocked — no Access-Control-Allow-Origin header")
    void preflightFromEvilOrigin_isBlocked() throws Exception {
        // When the origin does not match the pattern, Spring omits the
        // Access-Control-Allow-Origin header entirely (no wildcard fallback).
        mockMvc.perform(
                options("/games")
                        .header(HttpHeaders.ORIGIN, "http://evil.example.com")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
