import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBelongingProbe } from './useBelongingProbe';
import * as gameApi from '../api/gameApi';
import { GameNotFoundError, NotAuthorizedError } from '../api/gameApi';
import type { ActiveGamePointer, GameStateResponse, GameStatus } from '../types/game';

const ACTIVE_GAME_KEY = 'battleship_active_game';
const PLAYER_ID_KEY = 'battleship_player_id';

const TOKEN = 'seat-token-abc';
const POINTER: ActiveGamePointer = {
  gameId: 'g-123',
  playerId: 'p-1',
  gameMode: 'COMPUTER',
  sessionToken: TOKEN,
};

function stateWith(status: GameStatus): GameStateResponse {
  return {
    gameId: 'g-123',
    status,
    currentTurnPlayerId: null,
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: false,
    opponentReady: false,
    gameMode: 'COMPUTER',
  };
}

function seedPointer() {
  window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(POINTER));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useBelongingProbe — eligible (resumable seat)', () => {
  it('returns "eligible" and preserves the pointer for a non-terminal owned seat', async () => {
    seedPointer();
    const spy = vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('IN_PROGRESS'));

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('eligible');
    // The per-seat token is sent on the owner-gated state probe.
    expect(spy).toHaveBeenCalledWith('g-123', 'p-1', TOKEN);
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).not.toBeNull();
  });

  it('treats PAUSED as eligible without flipping the game (no resume call)', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('PAUSED'));
    const resumeSpy = vi.spyOn(gameApi, 'resumeGame');

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('eligible');
    expect(resumeSpy).not.toHaveBeenCalled();
  });
});

describe('useBelongingProbe — cleared (stale/foreign/terminal)', () => {
  it('returns "cleared" and quiet-clears on a 404 GameNotFoundError (AC-13)', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new GameNotFoundError('g-123'));

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('cleared');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it('returns "cleared" and quiet-clears on a 403 NotAuthorizedError (foreign belonging)', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new NotAuthorizedError('g-123'));

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('cleared');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it('returns "cleared" and quiet-clears on a FINISHED (terminal) status (AC-12)', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('FINISHED'));

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('cleared');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});

describe('useBelongingProbe — transient (no downgrade)', () => {
  it('returns "transient" and PRESERVES the pointer on a 5xx/network error', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useBelongingProbe());

    let outcome = '';
    await act(async () => {
      outcome = await result.current.probe(POINTER);
    });

    expect(outcome).toBe('transient');
    // A connectivity blip must never clear belonging.
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).not.toBeNull();
  });

  it('never throws — a rejected probe always resolves to an outcome string', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBelongingProbe());

    await act(async () => {
      await expect(result.current.probe(POINTER)).resolves.toBe('transient');
    });
  });
});

describe('useBelongingProbe — identity preservation (AC-10)', () => {
  it('a quiet-clear leaves battleship_player_id intact', async () => {
    seedPointer();
    window.localStorage.setItem(PLAYER_ID_KEY, JSON.stringify('identity-uuid'));
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new GameNotFoundError('g-123'));

    const { result } = renderHook(() => useBelongingProbe());

    await act(async () => {
      await result.current.probe(POINTER);
    });

    expect(JSON.parse(window.localStorage.getItem(PLAYER_ID_KEY) ?? 'null')).toBe('identity-uuid');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
