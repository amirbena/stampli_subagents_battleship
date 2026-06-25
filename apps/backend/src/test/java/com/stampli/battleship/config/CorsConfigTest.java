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
 * @WebMvcTest for CorsConfig — verifies that the strict port range (3000–3030 inclusive)
 * is enforced: ports within the range are allowed, ports outside are blocked,
 * and non-localhost origins are always blocked.
 *
 * Uses @WebMvcTest so only the web layer (DispatcherServlet + CorsConfig) is loaded.
 * GameService and ComputerPlayerService are mocked because GameController depends on them
 * and @WebMvcTest will fail to start without beans for all @RestController dependencies.
 */
@WebMvcTest(GameController.class)
@Import(CorsConfig.class)
@TestPropertySource(properties = {
        "battleship.cors.min-port=3000",
        "battleship.cors.max-port=3030"
})
@DisplayName("CorsConfig — strict port range 3000–3030")
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

    @Test
    @DisplayName("Preflight from http://localhost:3031 is blocked — port is outside the 3000–3030 range")
    void preflightFromLocalhostPort3031_isBlocked() throws Exception {
        // Port 3031 is one above the configured max-port=3030.
        // Previously this would have been allowed by the open-ended [*] wildcard —
        // the strict explicit list must reject it.
        mockMvc.perform(
                options("/games")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3031")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
        )
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
