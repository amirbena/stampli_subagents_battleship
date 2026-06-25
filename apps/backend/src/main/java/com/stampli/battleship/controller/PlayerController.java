package com.stampli.battleship.controller;

import com.stampli.battleship.domain.PlayerProfile;
import com.stampli.battleship.dto.CreatePlayerRequest;
import com.stampli.battleship.dto.PlayerResponse;
import com.stampli.battleship.service.PlayerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for persistent player identity endpoints.
 * <p>
 * All responses are shaped as {@link PlayerResponse} — containing ONLY
 * {@code playerId}, {@code displayName}, and {@code createdAt} (AC-21).
 */
@RestController
@RequestMapping("/players")
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    /**
     * Creates a new player profile.
     *
     * @param request body containing {@code displayName}
     * @return 201 with {@link PlayerResponse}; 400 on validation failure
     */
    @PostMapping
    public ResponseEntity<PlayerResponse> createPlayer(
            @RequestBody CreatePlayerRequest request) {
        PlayerProfile profile = playerService.createPlayer(
                request != null ? request.getDisplayName() : null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toResponse(profile));
    }

    /**
     * Retrieves a player profile by ID.
     *
     * @param playerId path variable — the player's UUID
     * @return 200 with {@link PlayerResponse}; 404 if not found
     */
    @GetMapping("/{playerId}")
    public ResponseEntity<PlayerResponse> getPlayer(@PathVariable String playerId) {
        PlayerProfile profile = playerService.getPlayer(playerId);
        return ResponseEntity.ok(toResponse(profile));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private PlayerResponse toResponse(PlayerProfile profile) {
        return new PlayerResponse(profile.getId(), profile.getDisplayName(), profile.getCreatedAt());
    }
}
