package com.stampli.battleship.domain;

/**
 * Persistence-safe result of a single shot, used in {@link Move} records.
 * <p>
 * Intentionally separate from {@link ShotResult}: {@code ShotResult.WIN} is an
 * internal game-engine signal and must never be persisted. Normalise WIN → SUNK
 * before constructing a {@code Move}. Having a dedicated enum makes that invariant
 * structural rather than reliant on a comment.
 */
public enum MoveResult {
    MISS,
    HIT,
    SUNK
}
