import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGamePolling } from './useGamePolling';
import * as gameApi from '../api/gameApi';
import { GameNotFoundError } from '../api/gameApi';
import type { GameStateResponse } from '../types/game';

const TOKEN = 'seat-token-abc';

function state(): GameStateResponse {
  return {
    gameId: 'g-1',
    status: 'IN_PROGRESS',
    currentTurnPlayerId: 'p-1',
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: true,
    opponentReady: true,
    gameMode: 'COMPUTER',
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGamePolling — recovery-error distinction (AC-3/AC-4)', () => {
  it('sets gameGone=true on an authoritative GameNotFoundError (404)', async () => {
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new GameNotFoundError('g-1'));

    const { result } = renderHook(() => useGamePolling('g-1', 'p-1', TOKEN));

    await waitFor(() => expect(result.current.gameGone).toBe(true));
    // The error message is also surfaced, but gameGone is the authoritative signal.
    expect(result.current.error).toContain('g-1');
  });

  it('forwards the per-seat token to getGameState on every poll', async () => {
    const spy = vi.spyOn(gameApi, 'getGameState').mockResolvedValue(state());

    renderHook(() => useGamePolling('g-1', 'p-1', TOKEN));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    // (gameId, playerId, sessionToken, silent)
    expect(spy).toHaveBeenCalledWith('g-1', 'p-1', TOKEN, false);
  });

  it('does not poll when sessionToken is null/empty (no belonging)', async () => {
    const spy = vi.spyOn(gameApi, 'getGameState').mockResolvedValue(state());

    renderHook(() => useGamePolling('g-1', 'p-1', null));
    await act(async () => { await Promise.resolve(); });

    expect(spy).not.toHaveBeenCalled();
  });

  it('leaves gameGone=false on a transient 5xx/network error (only sets error)', async () => {
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useGamePolling('g-1', 'p-1', TOKEN));

    await waitFor(() => expect(result.current.error).toBe('Network Error'));
    expect(result.current.gameGone).toBe(false);
  });

  it('does not set gameGone on a successful poll', async () => {
    vi.spyOn(gameApi, 'getGameState').mockResolvedValue(state());

    const { result } = renderHook(() => useGamePolling('g-1', 'p-1', TOKEN));

    await waitFor(() => expect(result.current.gameState).not.toBeNull());
    expect(result.current.gameGone).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not poll when gameId or playerId is null', async () => {
    const spy = vi.spyOn(gameApi, 'getGameState').mockResolvedValue(state());

    renderHook(() => useGamePolling(null, 'p-1', TOKEN));
    await act(async () => { await Promise.resolve(); });

    expect(spy).not.toHaveBeenCalled();
  });
});
