import { useCallback } from 'react';
import { getGameState, GameNotFoundError, NotAuthorizedError } from '../api/gameApi';
import type { ActiveGamePointer } from '../types/game';
import { useActiveGame } from './useActiveGame';

/**
 * Outcome of a belonging probe (architecture §6.2 step 2):
 *  - 'eligible'  → belonging proven AND game non-terminal → the resume popup may show.
 *  - 'cleared'   → 404 (gone / not-owned) or 403 (token rejected) or terminal status:
 *                  the stale belonging record has been quietly cleared. No popup, clean
 *                  Home (AC-12, AC-13, Flow 5).
 *  - 'transient' → 5xx/network failure: the record is PRESERVED, no popup, retry allowed.
 *                  A connectivity blip never downgrades belonging (Error States).
 */
export type BelongingProbeOutcome = 'eligible' | 'cleared' | 'transient';

export interface UseBelongingProbeResult {
  /**
   * Read-only belonging probe for the resume-popup eligibility gate. Given the
   * browser's own belonging record, asks the backend (via the owner-gated GET /state,
   * sending the per-seat X-Session-Token) whether the seat is still resumable. It NEVER
   * mints, resumes, or writes a pointer — it only reads and, on an authoritative
   * not-owned/gone/terminal result, quiet-clears the stale belonging record.
   *
   * @param pointer the stored belonging record (must carry gameId, playerId, sessionToken)
   * @returns 'eligible' | 'cleared' | 'transient' — never throws
   */
  probe: (pointer: ActiveGamePointer) => Promise<BelongingProbeOutcome>;
}

/** Status values that are NOT resumable — a probe on these resolves to 'cleared'. */
const TERMINAL_STATUSES = new Set(['FINISHED']);

/**
 * Belonging-probe hook (architecture §6.2 step 2 — popup eligibility).
 *
 * The resume popup is gated on a *confirmed resumable* seat, not on the mere presence
 * of a stored pointer/token. This hook performs that confirmation with a single
 * owner-gated read:
 *
 *   1. GET /state with the pointer's sessionToken.
 *      - 404 (GameNotFoundError — game gone OR caller is not the owner) → quiet-clear → 'cleared'.
 *      - 403 (NotAuthorizedError — token rejected) → quiet-clear → 'cleared'.
 *      - 5xx/network (plain Error) → keep the record → 'transient' (no downgrade).
 *   2. On success, a terminal status (FINISHED) → quiet-clear → 'cleared' (AC-12);
 *      any resumable status → 'eligible'.
 *
 * The probe is intentionally non-mutating except for the AC-13 quiet-clear: it never
 * flips a PAUSED game (that is useResumeGame's job on the user's explicit confirm). It
 * also never navigates. The hook owns its own useActiveGame instance for the clear; the
 * caller may additionally clear its own instance defensively on 'cleared'.
 */
export function useBelongingProbe(): UseBelongingProbeResult {
  const { clear } = useActiveGame();

  const probe = useCallback(
    async (pointer: ActiveGamePointer): Promise<BelongingProbeOutcome> => {
      const { gameId, playerId, sessionToken } = pointer;
      try {
        const state = await getGameState(gameId, playerId, sessionToken);
        // A terminal game is not resumable — discard the stale belonging (AC-12).
        if (TERMINAL_STATUSES.has(state.status)) {
          clear();
          return 'cleared';
        }
        return 'eligible';
      } catch (err) {
        // 404 (gone/not-owned) or 403 (token rejected) → authoritative stale belonging.
        if (err instanceof GameNotFoundError || err instanceof NotAuthorizedError) {
          clear();
          return 'cleared';
        }
        // Transient 5xx/network — never downgrade belonging on a connectivity blip.
        return 'transient';
      }
    },
    [clear],
  );

  return { probe };
}
