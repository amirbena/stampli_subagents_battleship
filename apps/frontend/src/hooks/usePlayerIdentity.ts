import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerResponse } from '../types/game';
import { createPlayer as apiCreatePlayer, getPlayer, PlayerNotFoundError } from '../api/playerApi';
import { useLocalStorage } from './useLocalStorage';

/** Key under which the persistent player UUID is stored in localStorage. */
const PLAYER_ID_KEY = 'battleship_player_id';

export type PlayerIdentityStatus = 'loading' | 'identified' | 'needs-name';

export interface UsePlayerIdentityResult {
  /** Resolved player profile once status === 'identified'. Null otherwise. */
  player: PlayerResponse | null;
  /**
   * Current identity-resolution status:
   * - 'loading'     — a GET /players/{id} is in flight (localStorage ID exists, validation pending)
   * - 'identified'  — player profile confirmed; game-start buttons may be enabled
   * - 'needs-name'  — no ID in storage or 404 from backend; name-entry UI must be shown
   */
  status: PlayerIdentityStatus;
  /**
   * True while a localStorage ID exists but the GET /players validation has not yet resolved.
   * The UI may use this to enable game-start buttons optimistically before the GET settles,
   * downgrading only if the backend returns 404 (product-spec §UX: returning visit must be instant).
   */
  isOptimistic: boolean;
  /**
   * Creates a new player profile via POST /players, writes the returned playerId to
   * localStorage, and transitions status to 'identified'. Throws on validation or
   * network errors — callers should catch and display the error message.
   *
   * @param displayName raw display name (validation performed by the backend)
   */
  createPlayer: (displayName: string) => Promise<void>;
  /** Last error message from getPlayer or createPlayer (null when no error). */
  error: string | null;
}

/**
 * Orchestrates the guest-identity resolution flow on every page load.
 *
 * Resolution rule (product-spec §Identity Resolution Rule):
 * 1. Read `battleship_player_id` from localStorage.
 * 2. If present → GET /players/{id}:
 *    - 200 → status = 'identified', isOptimistic promoted to confirmed.
 *    - 404 → clear localStorage, status = 'needs-name' (server restarted or ID invalid).
 *    - Network/5xx error → keep localStorage, status = 'identified' (optimistic stays).
 * 3. If absent → status = 'needs-name' immediately.
 *
 * Optimistic enable: as soon as an ID is found in localStorage, `isOptimistic` is true
 * so the UI can enable game-start buttons before the GET resolves. Only a 404 downgrades
 * to needs-name; transient errors preserve the optimistic state (product-spec §UX).
 */
export function usePlayerIdentity(): UsePlayerIdentityResult {
  const [storedPlayerId, setStoredPlayerId] = useLocalStorage<string | null>(
    PLAYER_ID_KEY,
    null,
  );
  const [player, setPlayer] = useState<PlayerResponse | null>(null);
  const [status, setStatus] = useState<PlayerIdentityStatus>(() =>
    // Derive initial status synchronously from localStorage so the UI
    // never flashes 'needs-name' on a returning visit.
    storedPlayerId ? 'loading' : 'needs-name',
  );
  const [error, setError] = useState<string | null>(null);

  // isOptimistic is true while we have a localStorage ID but GET has not yet confirmed it.
  const isOptimistic = status === 'loading' && storedPlayerId !== null;

  // Ref to guard against state updates after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resolve identity on mount (and whenever storedPlayerId changes after a createPlayer call).
  useEffect(() => {
    if (!storedPlayerId) {
      setStatus('needs-name');
      setPlayer(null);
      return;
    }

    // ID is in localStorage — start optimistic load.
    setStatus('loading');

    let cancelled = false;

    void (async () => {
      try {
        const profile = await getPlayer(storedPlayerId);
        if (!cancelled && mountedRef.current) {
          setPlayer(profile);
          setStatus('identified');
          setError(null);
        }
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          if (err instanceof PlayerNotFoundError) {
            // Backend has no record for this ID (server restarted or invalid).
            // Clear localStorage and fall back to name-entry.
            setStoredPlayerId(null);
            setPlayer(null);
            setStatus('needs-name');
          } else {
            // Transient network or 5xx error — keep the optimistic state so the
            // user is not forced to re-enter their name due to a connectivity blip.
            setStatus('identified');
            setError((err as Error).message);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // Re-run only when the stored ID changes (mount + post-createPlayer write).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedPlayerId]);

  const createPlayer = useCallback(
    async (displayName: string): Promise<void> => {
      setError(null);
      const profile = await apiCreatePlayer(displayName);
      // Write the returned UUID to localStorage — this triggers the useEffect above
      // to run getPlayer, but since we already have the profile, we short-circuit
      // by setting state directly here before the effect fires.
      if (mountedRef.current) {
        setStoredPlayerId(profile.playerId);
        setPlayer(profile);
        setStatus('identified');
      }
    },
    // setStoredPlayerId is stable (from useState), so this dep array is correct.
    [setStoredPlayerId],
  );

  return { player, status, isOptimistic, createPlayer, error };
}
