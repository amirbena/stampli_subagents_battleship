import { useCallback } from 'react';
import type { ActiveGamePointer } from '../types/game';
import { useLocalStorage } from './useLocalStorage';

/**
 * localStorage key holding the single active-game pointer.
 * Distinct from `battleship_player_id` (persistent identity) — the two keys
 * never collide and clearing one must never touch the other (AC-10).
 */
const ACTIVE_GAME_KEY = 'battleship_active_game';

export interface UseActiveGameResult {
  /**
   * The current active-game pointer, or null when there is no active session.
   * `null` (or an absent key) is the single "no session" signal read identically
   * by the route guard (RequireActiveSession) and the Home resume modal.
   */
  pointer: ActiveGamePointer | null;
  /**
   * Writes the active-game pointer. Called on game create/join so a later refresh,
   * tab close, or deep-link can find and resume the session.
   */
  setPointer: (pointer: ActiveGamePointer) => void;
  /**
   * Clears the active-game pointer (removes the localStorage key). Called on
   * No/Stop, in-game Stop, reaching FINISHED, and any GAME_NOT_FOUND (404) from
   * resume/state/pause. Never touches `battleship_player_id`.
   */
  clear: () => void;
}

/**
 * Single source of truth for "is there an active game session to resume?".
 *
 * Owns exactly one localStorage key (`battleship_active_game`) holding an
 * `ActiveGamePointer | null`. Both the route guard (RequireActiveSession) and the
 * Home resume modal read this same pointer, eliminating the redirect-loop /
 * blocked-resume class of bug. The pointer is a convenience pointer, not truth:
 * on any backend conflict (404) the caller clears it and the backend wins.
 *
 * The identity key `battleship_player_id` is owned by usePlayerIdentity and is
 * never read or written here (AC-10).
 */
export function useActiveGame(): UseActiveGameResult {
  const [pointer, setStored] = useLocalStorage<ActiveGamePointer | null>(
    ACTIVE_GAME_KEY,
    null,
  );

  const setPointer = useCallback(
    (next: ActiveGamePointer) => {
      setStored(next);
    },
    // setStored is stable (from useState), so this dep array is correct.
    [setStored],
  );

  const clear = useCallback(() => {
    // Passing null removes the key entirely (useLocalStorage contract), so the
    // next read returns null — a clean "no active session" with no stale blob.
    setStored(null);
  }, [setStored]);

  return { pointer, setPointer, clear };
}
