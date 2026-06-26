package com.stampli.battleship.service;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link RandomizedComputerMoveDelay}.
 * Exercises the delay range logic directly via {@code nextDelayMillis()} so the suite
 * never incurs the real multi-second sleep performed by {@code await()}.
 */
class RandomizedComputerMoveDelayTest {

    private final RandomizedComputerMoveDelay delay = new RandomizedComputerMoveDelay();

    @RepeatedTest(200)
    void nextDelayMillis_isWithinOneToThreeSeconds() {
        long millis = delay.nextDelayMillis();

        assertThat(millis)
                .isGreaterThanOrEqualTo(RandomizedComputerMoveDelay.MIN_DELAY_MILLIS)
                .isLessThanOrEqualTo(RandomizedComputerMoveDelay.MAX_DELAY_MILLIS);
    }

    @Test
    void boundsAreOneToThreeSeconds() {
        assertThat(RandomizedComputerMoveDelay.MIN_DELAY_MILLIS).isEqualTo(1000L);
        assertThat(RandomizedComputerMoveDelay.MAX_DELAY_MILLIS).isEqualTo(3000L);
    }

    @Test
    void nextDelayMillis_variesAcrossCalls() {
        // The pause should feel natural, not a fixed predictable beat. Across many draws we
        // expect more than one distinct value (probability of all-equal is negligible).
        long first = delay.nextDelayMillis();
        boolean sawDifferent = false;
        for (int i = 0; i < 100; i++) {
            if (delay.nextDelayMillis() != first) {
                sawDifferent = true;
                break;
            }
        }
        assertThat(sawDifferent).isTrue();
    }
}
