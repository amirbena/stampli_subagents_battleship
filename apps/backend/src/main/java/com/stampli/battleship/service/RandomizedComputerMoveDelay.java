package com.stampli.battleship.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;

/**
 * Default {@link ComputerMoveDelay} that pauses for a randomized human-like duration
 * (1–3 seconds) so the computer does not appear to fire back instantly.
 * <p>
 * The duration is re-randomized on every call so the pacing feels natural rather than a
 * fixed predictable beat. The delay is purely cosmetic timing — it never alters the shot
 * outcome, turn order, or any game rule.
 */
@Service
public class RandomizedComputerMoveDelay implements ComputerMoveDelay {

    private static final Logger log = LoggerFactory.getLogger(RandomizedComputerMoveDelay.class);

    /** Inclusive lower bound of the "thinking" pause, in milliseconds. */
    static final long MIN_DELAY_MILLIS = 1000L;
    /** Inclusive upper bound of the "thinking" pause, in milliseconds. */
    static final long MAX_DELAY_MILLIS = 3000L;

    /**
     * Returns a fresh randomized delay in the inclusive range
     * {@code [MIN_DELAY_MILLIS, MAX_DELAY_MILLIS]}. Pure (no sleep) so it is unit-testable
     * in isolation.
     *
     * @return delay in milliseconds within [1000, 3000]
     */
    long nextDelayMillis() {
        // origin inclusive, bound exclusive — so +1 to make MAX_DELAY_MILLIS reachable.
        return ThreadLocalRandom.current().nextLong(MIN_DELAY_MILLIS, MAX_DELAY_MILLIS + 1);
    }

    @Override
    public void await() {
        long millis = nextDelayMillis();
        log.debug("Computer thinking pause millis={}", millis);
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            // Preserve interrupt status and abort the pause early rather than swallowing it —
            // a shut-down/interrupt should not be masked by the cosmetic wait.
            Thread.currentThread().interrupt();
        }
    }
}
