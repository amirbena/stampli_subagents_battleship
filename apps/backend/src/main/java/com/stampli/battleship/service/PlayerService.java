package com.stampli.battleship.service;

import com.stampli.battleship.domain.PlayerProfile;
import com.stampli.battleship.repository.PlayerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Service for creating and retrieving persistent player identity records.
 * <p>
 * Validation is centralised here (not in DTOs or domain objects) so rules are
 * unit-testable in isolation and produce the exact error codes required by the
 * API contract (AC-02–AC-05).
 * <p>
 * {@code POST /players} always creates a new record — no deduplication by
 * display name (AC-10). Display name is a non-unique human-readable label; identity
 * is resolved exclusively by {@code playerId}.
 */
@Service
public class PlayerService {

    private static final int MAX_DISPLAY_NAME_LENGTH = 30;
    private static final Pattern ALLOWED_CHARS = Pattern.compile("^[A-Za-z0-9 _-]+$");

    private final PlayerRepository playerRepository;

    public PlayerService(PlayerRepository playerRepository) {
        this.playerRepository = playerRepository;
    }

    /**
     * Validates {@code rawDisplayName}, creates a new {@link PlayerProfile}, persists it,
     * and returns it. Always creates — no dedup (AC-10).
     *
     * @param rawDisplayName the display name supplied by the client (may be null / untrimmed)
     * @return the newly created {@code PlayerProfile}
     * @throws GameException 400 DISPLAY_NAME_REQUIRED if empty after trim (AC-02)
     * @throws GameException 400 DISPLAY_NAME_TOO_LONG if trimmed length &gt; 30 (AC-03)
     * @throws GameException 400 DISPLAY_NAME_INVALID_CHARS if trimmed value fails charset check (AC-04)
     */
    public PlayerProfile createPlayer(String rawDisplayName) {
        // 1. Trim (handle null → treat as empty)
        String trimmed = (rawDisplayName == null) ? "" : rawDisplayName.trim();

        // 2. Required check (AC-02)
        if (trimmed.isEmpty()) {
            throw new GameException("Display name is required",
                    "DISPLAY_NAME_REQUIRED", HttpStatus.BAD_REQUEST);
        }

        // 3. Length check (AC-03)
        if (trimmed.length() > MAX_DISPLAY_NAME_LENGTH) {
            throw new GameException("Display name must be 30 characters or fewer",
                    "DISPLAY_NAME_TOO_LONG", HttpStatus.BAD_REQUEST);
        }

        // 4. Charset check (AC-04)
        if (!ALLOWED_CHARS.matcher(trimmed).matches()) {
            throw new GameException(
                    "Display name may only contain letters, numbers, spaces, hyphens, and underscores",
                    "DISPLAY_NAME_INVALID_CHARS", HttpStatus.BAD_REQUEST);
        }

        // 5. Create, save, and return (AC-05)
        PlayerProfile profile = new PlayerProfile(
                UUID.randomUUID().toString(),
                trimmed,
                Instant.now()
        );
        playerRepository.save(profile);
        return profile;
    }

    /**
     * Retrieves a player profile by ID.
     *
     * @param playerId the UUID of the player
     * @return the {@code PlayerProfile}
     * @throws GameException 404 PLAYER_NOT_FOUND if no profile exists for the given ID
     */
    public PlayerProfile getPlayer(String playerId) {
        return playerRepository.findById(playerId)
                .orElseThrow(() -> new GameException(
                        "Player not found", "PLAYER_NOT_FOUND", HttpStatus.NOT_FOUND));
    }
}
