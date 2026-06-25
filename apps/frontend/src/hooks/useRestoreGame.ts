import { useCallback, useState } from 'react';
import { restoreGameByCode, GameNotFoundError } from '../api/gameApi';
import type { RestoreGameResponse } from '../types/game';

export interface UseRestoreGameResult {
  /**
   * Submits a room code to restore a COMPUTER game. On success resolves to the typed
   * RestoreGameResponse ({gameId, playerId, gameMode, status}) AND stores it in `data`;
   * the UI then writes the active-session pointer and routes by status. On an
   * authoritative 404 it resolves to `null` and sets `notFound` (friendly inline signal,
   * AC-9) — it does NOT throw for the not-found case. Transient 5xx/network errors set
   * `error` and re-throw so the UI can surface a retryable failure. The hook never navigates.
   *
   * @param code raw code (trimmed by the UI before calling)
   * @returns the restore response on success, or null when the code is not found
   * @throws Error on transient/5xx/network failures (not for 404 not-found)
   */
  submit: (code: string) => Promise<RestoreGameResponse | null>;
  /** Last successful restore response, or null before the first success. */
  data: RestoreGameResponse | null;
  /** True while a restore request is in flight. */
  isLoading: boolean;
  /** True when the most recent submit resolved to an authoritative 404 not-found. */
  notFound: boolean;
  /** Transient/5xx/network error message from the last submit, or null. */
  error: string | null;
}

/**
 * Restore-by-code data hook (AC-8/AC-9). Wraps `restoreGameByCode` with loading,
 * a friendly `notFound` signal for the 404 case, and a separate transient `error`.
 *
 * Not-found vs transient is the key distinction the UI consumes: a 404 maps to the
 * inline "Game not found or no longer available" message (stay on main, no throw),
 * while a 5xx/network failure surfaces as a retryable error. Navigation and pointer
 * writes are the UI agent's job — this hook only resolves the data.
 */
export function useRestoreGame(): UseRestoreGameResult {
  const [data, setData] = useState<RestoreGameResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (code: string): Promise<RestoreGameResponse | null> => {
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const response = await restoreGameByCode(code);
      setData(response);
      return response;
    } catch (e) {
      // 404 GAME_NOT_FOUND is an expected, friendly outcome — flag it and resolve null
      // (do not throw) so the UI shows the inline message and stays on main (AC-9).
      if (e instanceof GameNotFoundError) {
        setNotFound(true);
        return null;
      }
      // Transient/5xx/network — surface a retryable error and re-throw for the caller.
      setError(e instanceof Error ? e.message : 'Failed to restore game');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { submit, data, isLoading, notFound, error };
}
