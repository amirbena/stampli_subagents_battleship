import { useState, useEffect, useCallback, useRef } from 'react';
import { getGameState } from '../api/gameApi';
import type { GameStateResponse } from '../types/game';

const POLL_INTERVAL_MS = 2000;

interface UseGamePollingResult {
  gameState: GameStateResponse | null;
  error: string | null;
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
  const [isLoading, setIsLoading] = useState(false);
  // Use a ref so the cleanup function always cancels the correct interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const state = await getGameState(gameId, playerId);
      setGameState(state);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load game state');
    }
  }, [gameId, playerId]);

  /**
   * Manually trigger a fetch outside the polling interval (e.g. immediately
   * after firing). Returns the in-flight promise so callers can await the
   * authoritative state before clearing optimistic/pending UI.
   */
  const refresh = useCallback(() => fetchState(), [fetchState]);

  useEffect(() => {
    if (!enabled || !gameId || !playerId) return;

    // Fetch immediately on mount so the UI isn't blank for the first 2 seconds
    setIsLoading(true);
    fetchState().finally(() => setIsLoading(false));

    intervalRef.current = setInterval(() => {
      void fetchState();
    }, POLL_INTERVAL_MS);

    return () => {
      // Always cancel the interval on cleanup to prevent stale updates after unmount
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, gameId, playerId, fetchState]);

  return { gameState, error, isLoading, refresh };
}
