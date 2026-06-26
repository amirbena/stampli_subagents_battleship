package com.stampli.battleship.controller;

import com.stampli.battleship.dto.HealthResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Liveness/identity endpoint for local startup verification.
 * <p>
 * Reachable at {@code GET /api/v1/health} (controller mapping {@code /health}
 * under the global {@code /api/v1} context-path). Local startup scripts probe
 * this to decide whether an existing backend on the configured port can be
 * reused instead of starting a duplicate.
 * <p>
 * Returns a constant body with no collaborators (no service, repository,
 * datasource, or Redis), so it answers as soon as the web context is up —
 * independent of database/Redis health — and leaks no game state. The
 * {@code service} field is the identity token the scripts match on; HTTP 200
 * alone is intentionally not treated as sufficient by the callers.
 */
@RestController
@RequestMapping("/health")
public class HealthController {

    private static final HealthResponse HEALTH =
            new HealthResponse("UP", "battleship-backend");

    @GetMapping
    public ResponseEntity<HealthResponse> health() {
        return ResponseEntity.ok(HEALTH);
    }
}
