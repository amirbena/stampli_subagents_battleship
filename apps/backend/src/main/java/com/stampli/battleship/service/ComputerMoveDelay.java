package com.stampli.battleship.service;

/**
 * Seam for the "thinking" pause the computer takes before firing back in COMPUTER mode.
 * <p>
 * Extracted behind an interface so unit tests can inject a no-op double and avoid real
 * multi-second sleeps. The production implementation ({@link RandomizedComputerMoveDelay})
 * waits a short randomized human-like duration; tests verify it is invoked on the
 * computer-fires path and skipped otherwise, without actually sleeping.
 */
public interface ComputerMoveDelay {

    /**
     * Blocks the current thread for a short, human-like "thinking" duration before the
     * computer takes its shot. Implementations choose the exact duration.
     */
    void await();
}
