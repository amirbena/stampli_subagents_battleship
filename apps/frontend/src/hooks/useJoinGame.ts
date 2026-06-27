import { useCallback, useState } from 'react';
import { joinGame, GameNotFoundError } from '../api/gameApi';
import type { JoinGameResponse } from '../types/game';

export interface UseJoinGameResult {
  /**
   * Joins an existing human game by code as the SECOND player (Flow A2, AC-6c/AC-6d).
   * On a valid, joinable code resolves to the typed JoinGameResponse
   * ({gameId, playerId, status, sessionToken}) AND stores it in `data`; the payload
   * carries the joiner's DISTINCT identity + its OWN per-seat sessionToken (PR #58 —
   * never the creator's). The UI then writes the belonging pointer (useActiveGame
   * .setPointer) and routes by status — this hook does NOT write the pointer or navigate.
   *
   * On the generic not-joinable outcome (backend collapses missing/full/already-started
   * to a single 404 GAME_NOT_FOUND) it resolves to `null` and sets `notFound` — it does
   * NOT throw — so the UI shows the existing inline "not joinable" message and stays at
   * the entry point to retry (AC-6d). Transient 5xx/network errors set `error` and
   * re-throw so the UI can surface a retryable failure.
   *
   * @param code     the room code the second player entered (this code IS the gameId;
   *                 trimmed by the UI before calling)
   * @param playerId optional persistent player id (the UI passes player?.playerId from
   *                 usePlayerIdentity, exactly as the create flow does); omit for anonymous
   * @returns the join response on success, or null when not joinable
   * @throws Error on transient/5xx/network failures (not for 404 not-joinable)
   */
  join: (code: string, playerId?: string) => Promise<JoinGameResponse | null>;
  /** Last successful join response, or null before the first success. */
  data: JoinGameResponse | null;
  /** True while a join request is in flight. */
  isLoading: boolean;
  /** True when the most recent join resolved to an authoritative 404 not-joinable. */
  notFound: boolean;
  /** Transient/5xx/network error message from the last join, or null. */
  error: string | null;
}

/**
 * Join-by-code data layer for the second player (Flow A2, AC-6c/AC-6d). Wraps the
 * existing `joinGame` API with loading, a friendly `notFound` signal for the generic
 * 404 not-joinable case, and a separate transient `error`. Mirrors `useRestoreGame`.
 *
 * Belonging contract (PR #58): the joiner always gets a brand-new DISTINCT identity and
 * its own per-seat sessionToken from the mint response — this hook simply returns that
 * payload unchanged. It never inherits the creator's identity and never writes the
 * belonging pointer itself (that — and navigation — is the UI agent's job).
 *
 * Not-joinable vs transient is the key distinction the UI consumes: a 404 maps to the
 * existing inline "not joinable" feedback (stay at the entry point, no throw), while a
 * 5xx/network failure surfaces as a retryable error.
 */
export function useJoinGame(): UseJoinGameResult {
  const [data, setData] = useState<JoinGameResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (
    code: string,
    playerId?: string,
  ): Promise<JoinGameResponse | null> => {
    setIsLoading(true);
    setNotFound(false);
    setError(null);
    try {
      const response = await joinGame(code, playerId);
      setData(response);
      return response;
    } catch (e) {
      // 404 GAME_NOT_FOUND is an expected, friendly outcome (missing/full/already-started)
      // — flag it and resolve null (do not throw) so the UI shows the inline "not joinable"
      // message and stays at the entry point (AC-6d).
      if (e instanceof GameNotFoundError) {
        setNotFound(true);
        return null;
      }
      // Transient/5xx/network — surface a retryable error and re-throw for the caller.
      setError(e instanceof Error ? e.message : 'Failed to join game');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { join, data, isLoading, notFound, error };
}
