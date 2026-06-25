import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResumeGame } from './useResumeGame';
import * as gameApi from '../api/gameApi';
import { GameNotFoundError } from '../api/gameApi';
import type { ActiveGamePointer, GameStateResponse, GameStatus } from '../types/game';

const ACTIVE_GAME_KEY = 'battleship_active_game';
const PLAYER_ID_KEY = 'battleship_player_id';

const POINTER: ActiveGamePointer = { gameId: 'g-123', playerId: 'p-1', gameMode: 'HUMAN' };

function stateWith(status: GameStatus): GameStateResponse {
  return {
    gameId: 'g-123',
    status,
    currentTurnPlayerId: status === 'IN_PROGRESS' ? 'p-1' : null,
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: false,
    opponentReady: false,
    gameMode: 'HUMAN',
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

// ---------------------------------------------------------------------------
// Non-paused active game → state-only path (no resume call, AC-6 refresh case)
// ---------------------------------------------------------------------------

describe('non-paused active game', () => {
  it('routes via GET /state only and does NOT call resume', async () => {
    seedPointer();
    const getSpy = vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('IN_PROGRESS'));
    const resumeSpy = vi.spyOn(gameApi, 'resumeGame');

    const { result } = renderHook(() => useResumeGame());

    let state: GameStateResponse | null = stateWith('PAUSED');
    await act(async () => {
      state = await result.current.resume(POINTER);
    });

    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(resumeSpy).not.toHaveBeenCalled();
    expect(state).toEqual(stateWith('IN_PROGRESS'));
    // Pointer preserved for a live game.
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PAUSED → resume → re-GET /state path
// ---------------------------------------------------------------------------

describe('paused game', () => {
  it('calls resume then re-reads state and returns the restored phase', async () => {
    seedPointer();
    const getSpy = vi
      .spyOn(gameApi, 'getGameState')
      .mockResolvedValueOnce(stateWith('PAUSED')) // first read: still paused
      .mockResolvedValueOnce(stateWith('IN_PROGRESS')); // after resume flip
    const resumeSpy = vi
      .spyOn(gameApi, 'resumeGame')
      .mockResolvedValue({ gameId: 'g-123', status: 'IN_PROGRESS', previousStatus: 'PAUSED' });

    const { result } = renderHook(() => useResumeGame());

    let state: GameStateResponse | null = stateWith('PAUSED');
    await act(async () => {
      state = await result.current.resume(POINTER);
    });

    expect(resumeSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(state?.status).toBe('IN_PROGRESS');
  });
});

// ---------------------------------------------------------------------------
// 404 GAME_NOT_FOUND → clear pointer, return null (AC-13)
// ---------------------------------------------------------------------------

describe('stale game (404)', () => {
  it('clears the pointer and returns null when initial GET /state 404s', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new GameNotFoundError('g-123'));

    const { result } = renderHook(() => useResumeGame());

    let state: GameStateResponse | null = stateWith('IN_PROGRESS');
    await act(async () => {
      state = await result.current.resume(POINTER);
    });

    expect(state).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it('clears the pointer when resume itself 404s mid-sequence', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('PAUSED'));
    vi.spyOn(gameApi, 'resumeGame').mockRejectedValue(new GameNotFoundError('g-123'));

    const { result } = renderHook(() => useResumeGame());

    let state: GameStateResponse | null = stateWith('PAUSED');
    await act(async () => {
      state = await result.current.resume(POINTER);
    });

    expect(state).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FINISHED → clear pointer, return null, not resumable (AC-14)
// ---------------------------------------------------------------------------

describe('finished game', () => {
  it('clears the pointer and returns null', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockResolvedValue(stateWith('FINISHED'));

    const { result } = renderHook(() => useResumeGame());

    let state: GameStateResponse | null = stateWith('FINISHED');
    await act(async () => {
      state = await result.current.resume(POINTER);
    });

    expect(state).toBeNull();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Transient/5xx → propagate, keep pointer (mirror usePlayerIdentity)
// ---------------------------------------------------------------------------

describe('transient failure', () => {
  it('propagates the error and does NOT clear the pointer on a 5xx/network error', async () => {
    seedPointer();
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useResumeGame());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.resume(POINTER).catch((e: unknown) => e);
    });

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
    // Pointer survives a transient blip so the session is not dropped.
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-10: resume's pointer clears never touch identity key
// ---------------------------------------------------------------------------

describe('identity preservation (AC-10)', () => {
  it('clearing on 404 leaves battleship_player_id intact', async () => {
    seedPointer();
    window.localStorage.setItem(PLAYER_ID_KEY, JSON.stringify('identity-uuid'));
    vi.spyOn(gameApi, 'getGameState').mockRejectedValue(new GameNotFoundError('g-123'));

    const { result } = renderHook(() => useResumeGame());

    await act(async () => {
      await result.current.resume(POINTER);
    });

    expect(JSON.parse(window.localStorage.getItem(PLAYER_ID_KEY) ?? 'null')).toBe('identity-uuid');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
