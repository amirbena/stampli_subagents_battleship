import { useCallback, useState } from 'react';
import type { ActiveGamePointer, GameStateResponse } from '../types/game';
import { getGameState, resumeGame, GameNotFoundError, NotAuthorizedError } from '../api/gameApi';
import { useActiveGame } from './useActiveGame';

export interface UseResumeGameResult {
  /**
   * Runs the resume sequence for the given active-game pointer and returns the
   * resolved player-scoped state to route by phase, or `null` when the game is
   * not resumable (stale 404 or FINISHED) — in which case the active-game pointer
   * has already been cleared. The hook never navigates; the UI routes off the result.
   *
   * @returns GameStateResponse when resumable; null when stale/finished (pointer cleared).
   * @throws Error on transient/5xx failures (pointer left intact so the session survives).
   */
  resume: (pointer: ActiveGamePointer) => Promise<GameStateResponse | null>;
  /** True while a resume sequence is in flight (UI may show a brief loading state). */
  isResuming: boolean;
}

/**
 * Resume-sequence hook implementing the smallest-safe rule (architecture §3.2 / §5.3).
 *
 * Sequence:
 *   1. GET /state.
 *   2. If status === 'PAUSED' → POST resume (flip to prior phase) → re-GET /state.
 *      Otherwise skip resume (avoids a needless 409 on the refresh-without-pause case).
 *   3. Resolve:
 *        - FINISHED      → clear pointer, return null (not resumable, AC-14).
 *        - 404 anywhere  → clear pointer, return null (stale/stopped, AC-13).
 *        - otherwise     → return the resolved GameStateResponse.
 *
 * Pointer-clear policy mirrors usePlayerIdentity: clear ONLY on authoritative
 * GAME_NOT_FOUND (404), NOT_AUTHORIZED (403 — stale/foreign belonging, AC-13), or
 * FINISHED. Transient/5xx errors propagate as a thrown Error and leave the pointer
 * intact so a connectivity blip never drops the session (no belonging downgrade).
 * The hook does NOT navigate — the UI consumes the returned state to route.
 *
 * The per-seat `sessionToken` is read from the pointer and sent on every gated call
 * (state + resume). A pointer without a token (legacy/typed-code) fails the backend's
 * ownsSeat check and returns the generic 404 → quiet-clear, exactly as intended.
 */
export function useResumeGame(): UseResumeGameResult {
  const { clear } = useActiveGame();
  const [isResuming, setIsResuming] = useState(false);

  const resume = useCallback(
    async (pointer: ActiveGamePointer): Promise<GameStateResponse | null> => {
      const { gameId, playerId, sessionToken } = pointer;
      setIsResuming(true);
      try {
        // Step 1: read current state. A 404 (missing OR non-owner) means this browser
        // can no longer prove belonging to the remembered game.
        let state: GameStateResponse;
        try {
          state = await getGameState(gameId, playerId, sessionToken);
        } catch (err) {
          // 404 (game gone / not owned) or 403 (token rejected) → stale belonging.
          if (err instanceof GameNotFoundError || err instanceof NotAuthorizedError) {
            clear();
            return null;
          }
          throw err; // transient/5xx — keep pointer, let caller surface the error
        }

        // Step 2: only flip a genuinely PAUSED game, then re-read its restored state.
        if (state.status === 'PAUSED') {
          try {
            await resumeGame(gameId, playerId, sessionToken);
            state = await getGameState(gameId, playerId, sessionToken);
          } catch (err) {
            // A game that vanished mid-sequence (404) or rejected the token (403) is
            // stale/foreign belonging → clear and bail.
            if (err instanceof GameNotFoundError || err instanceof NotAuthorizedError) {
              clear();
              return null;
            }
            throw err;
          }
        }

        // Step 3: a FINISHED game is terminal — clear so the modal never re-triggers (AC-14).
        if (state.status === 'FINISHED') {
          clear();
          return null;
        }

        return state;
      } finally {
        setIsResuming(false);
      }
    },
    [clear],
  );

  return { resume, isResuming };
}
