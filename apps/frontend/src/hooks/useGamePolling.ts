import { useState, useEffect, useCallback, useRef } from 'react';
import { getGameState, GameNotFoundError } from '../api/gameApi';
import type { GameStateResponse } from '../types/game';

const POLL_INTERVAL_MS = 2000;

interface UseGamePollingResult {
  gameState: GameStateResponse | null;
  error: string | null;
  /**
   * Authoritative "game gone" flag (AC-3/AC-4). True ONLY when the backend returned
   * 404 GAME_NOT_FOUND (server restart, prior Stop, or released game) — never on a
   * transient 5xx/network blip. The Game page consumes this to clear the active-session
   * pointer and redirect to '/'. Transient errors set `error` but leave this false, so a
   * connectivity blip never triggers recovery. The hook itself never navigates.
   */
  gameGone: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Polls the backend every 2 seconds for the current game state.
 *
 * Only one interval is ever active at a time — the effect cleans up on unmount
 * or when any dependency changes, preventing double-polling on re-renders.
 *
 * To switch from polling to WebSocket push in the future, replace only this hook.
 * All components that consume `gameState` remain unchanged.
 *
 * @param gameId   the room to poll (null = polling disabled)
 * @param playerId identifies which player's view to fetch (null = polling disabled)
 * @param enabled  set to false to pause polling (e.g. when game is FINISHED)
 * @returns current game state, last error message, initial loading flag, and manual refresh fn
 */
export function useGamePolling(
  gameId: string | null,
  playerId: string | null,
  enabled: boolean = true,
): UseGamePollingResult {
  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sticky once the backend authoritatively 404s — distinct from transient `error`.
  const [gameGone, setGameGone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Use a ref so the cleanup function always cancels the correct interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // `silent` excludes the call from the global HTTP loader. Background polls pass
  // silent=true (no flicker every 2s); the initial load and manual refresh() pass
  // silent=false so the user sees the loader for those user-relevant fetches (D1).
  const fetchState = useCallback(async (silent: boolean) => {
    if (!gameId || !playerId) return;
    try {
      const state = await getGameState(gameId, playerId, silent);
      setGameState(state);
      setError(null);
    } catch (e) {
      // An authoritative 404 (GameNotFoundError) is the "game gone" signal the page
      // uses to clear the pointer + redirect (AC-3/AC-4). Transient 5xx/network errors
      // only set `error` and leave `gameGone` false so a blip never triggers recovery.
      if (e instanceof GameNotFoundError) {
        setGameGone(true);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load game state');
      }
    }
  }, [gameId, playerId]);

  /**
   * Manually trigger a fetch outside the polling interval (e.g. immediately
   * after firing). Returns the in-flight promise so callers can await the
   * authoritative state before clearing optimistic/pending UI.
   */
  const refresh = useCallback(() => fetchState(false), [fetchState]);

  useEffect(() => {
    if (!enabled || !gameId || !playerId) return;

    // Fetch immediately on mount so the UI isn't blank for the first 2 seconds.
    // Initial load is NOT silent — the user should see the global loader for it.
    setIsLoading(true);
    fetchState(false).finally(() => setIsLoading(false));

    // Background poll IS silent — excluded from the global loader to avoid 2s flicker.
    intervalRef.current = setInterval(() => {
      void fetchState(true);
    }, POLL_INTERVAL_MS);

    return () => {
      // Always cancel the interval on cleanup to prevent stale updates after unmount
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, gameId, playerId, fetchState]);

  return { gameState, error, gameGone, isLoading, refresh };
}
