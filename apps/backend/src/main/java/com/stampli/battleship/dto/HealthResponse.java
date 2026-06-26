package com.stampli.battleship.dto;

/**
 * Response shape for {@code GET /health} (200).
 * <p>
 * Used by local startup scripts to verify that the process listening on the
 * configured backend port is actually this application's backend (identity check),
 * not just any process holding the port.
 * <p>
 * SECURITY: contains ONLY a static {@code status} and a static {@code service}
 * identifier. No game, board, ship, player, or session state is included — the
 * endpoint has no data collaborators, so it cannot leak hidden information.
 */
public class HealthResponse {

    private final String status;
    private final String service;

    public HealthResponse(String status, String service) {
        this.status = status;
        this.service = service;
    }

    public String getStatus() {
        return status;
    }

    public String getService() {
        return service;
    }
}
