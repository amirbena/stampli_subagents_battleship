package com.stampli.battleship.service;

import com.stampli.battleship.domain.PlayerProfile;
import com.stampli.battleship.repository.PlayerRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PlayerService} — validation logic (AC-02–AC-05, AC-10),
 * and profile retrieval (AC-08).
 */
@ExtendWith(MockitoExtension.class)
class PlayerServiceTest {

    @Mock
    private PlayerRepository playerRepository;

    private PlayerService playerService;

    @BeforeEach
    void setUp() {
        playerService = new PlayerService(playerRepository);
    }

    // -------------------------------------------------------------------------
    // createPlayer — validation (AC-02)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_nullDisplayName_throws400_DISPLAY_NAME_REQUIRED() {
        assertThatThrownBy(() -> playerService.createPlayer(null))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_REQUIRED");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(400);
                });
    }

    @Test
    void createPlayer_emptyDisplayName_throws400_DISPLAY_NAME_REQUIRED() {
        assertThatThrownBy(() -> playerService.createPlayer(""))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_REQUIRED");
                });
    }

    @Test
    void createPlayer_whitespaceOnlyDisplayName_throws400_DISPLAY_NAME_REQUIRED() {
        assertThatThrownBy(() -> playerService.createPlayer("   "))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_REQUIRED");
                });
    }

    // -------------------------------------------------------------------------
    // createPlayer — validation (AC-03)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_displayNameExactly30Chars_succeeds() {
        String exactly30 = "A".repeat(30);
        PlayerProfile profile = playerService.createPlayer(exactly30);

        assertThat(profile.getDisplayName()).isEqualTo(exactly30);
    }

    @Test
    void createPlayer_displayName31Chars_throws400_DISPLAY_NAME_TOO_LONG() {
        String tooLong = "A".repeat(31);
        assertThatThrownBy(() -> playerService.createPlayer(tooLong))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_TOO_LONG");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(400);
                });
    }

    @Test
    void createPlayer_trimmedLengthOver30_throws400_DISPLAY_NAME_TOO_LONG() {
        // 31 chars core + surrounding whitespace — after trim still > 30
        String tooLong = "  " + "B".repeat(31) + "  ";
        assertThatThrownBy(() -> playerService.createPlayer(tooLong))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_TOO_LONG");
                });
    }

    // -------------------------------------------------------------------------
    // createPlayer — validation (AC-04)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_displayNameWithInvalidChars_throws400_DISPLAY_NAME_INVALID_CHARS() {
        assertThatThrownBy(() -> playerService.createPlayer("Alice@Wonderland"))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_INVALID_CHARS");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(400);
                });
    }

    @Test
    void createPlayer_displayNameWithExclamationMark_throws400_DISPLAY_NAME_INVALID_CHARS() {
        assertThatThrownBy(() -> playerService.createPlayer("Player!"))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_INVALID_CHARS");
                });
    }

    @Test
    void createPlayer_displayNameWithPeriod_throws400_DISPLAY_NAME_INVALID_CHARS() {
        assertThatThrownBy(() -> playerService.createPlayer("john.doe"))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("DISPLAY_NAME_INVALID_CHARS");
                });
    }

    // -------------------------------------------------------------------------
    // createPlayer — allowed charset (AC-04 complements)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_displayNameWithLettersAndDigits_succeeds() {
        PlayerProfile profile = playerService.createPlayer("Alice123");
        assertThat(profile.getDisplayName()).isEqualTo("Alice123");
    }

    @Test
    void createPlayer_displayNameWithSpaceHyphenUnderscore_succeeds() {
        PlayerProfile profile = playerService.createPlayer("A_B-C D");
        assertThat(profile.getDisplayName()).isEqualTo("A_B-C D");
    }

    // -------------------------------------------------------------------------
    // createPlayer — happy path (AC-05)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_validName_returnsProfileWithGeneratedUuid() {
        PlayerProfile profile = playerService.createPlayer("Alex");

        assertThat(profile.getId()).isNotNull().isNotBlank();
        assertThat(profile.getDisplayName()).isEqualTo("Alex");
        assertThat(profile.getCreatedAt()).isNotNull();
    }

    @Test
    void createPlayer_validName_trimmedDisplayNameStored() {
        PlayerProfile profile = playerService.createPlayer("  Bob  ");

        assertThat(profile.getDisplayName()).isEqualTo("Bob");
    }

    @Test
    void createPlayer_validName_savesProfileToRepository() {
        playerService.createPlayer("Carol");

        ArgumentCaptor<PlayerProfile> captor = ArgumentCaptor.forClass(PlayerProfile.class);
        verify(playerRepository).save(captor.capture());
        assertThat(captor.getValue().getDisplayName()).isEqualTo("Carol");
    }

    // -------------------------------------------------------------------------
    // createPlayer — no dedup (AC-10)
    // -------------------------------------------------------------------------

    @Test
    void createPlayer_sameNameTwice_producesTwoDistinctIds() {
        PlayerProfile first = playerService.createPlayer("Dave");
        PlayerProfile second = playerService.createPlayer("Dave");

        assertThat(first.getId()).isNotEqualTo(second.getId());
    }

    @Test
    void createPlayer_sameNameTwice_repositorySavedTwice() {
        playerService.createPlayer("Eve");
        playerService.createPlayer("Eve");

        // save() called exactly twice — no find-by-name dedup attempted
        verify(playerRepository, times(2)).save(any(PlayerProfile.class));
        verify(playerRepository, never()).findById(any());
    }

    // -------------------------------------------------------------------------
    // getPlayer — retrieval (AC-07)
    // -------------------------------------------------------------------------

    @Test
    void getPlayer_existingId_returnsProfile() {
        PlayerProfile profile = new PlayerProfile("uuid-1", "Frank", java.time.Instant.now());
        when(playerRepository.findById("uuid-1")).thenReturn(Optional.of(profile));

        PlayerProfile result = playerService.getPlayer("uuid-1");

        assertThat(result).isSameAs(profile);
    }

    // -------------------------------------------------------------------------
    // getPlayer — not found (AC-08)
    // -------------------------------------------------------------------------

    @Test
    void getPlayer_unknownId_throws404_PLAYER_NOT_FOUND() {
        when(playerRepository.findById("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> playerService.getPlayer("ghost"))
                .isInstanceOf(GameException.class)
                .satisfies(ex -> {
                    GameException ge = (GameException) ex;
                    assertThat(ge.getErrorCode()).isEqualTo("PLAYER_NOT_FOUND");
                    assertThat(ge.getHttpStatus().value()).isEqualTo(404);
                });
    }
}
