import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, __resetLoaderStore, pauseGame, resumeGame, stopGame, GameNotFoundError } from './gameApi';
import type { PauseResumeResponse } from '../types/game';

const pauseResp: PauseResumeResponse = {
  gameId: 'g-123',
  status: 'PAUSED',
  previousStatus: 'IN_PROGRESS',
};

const resumeResp: PauseResumeResponse = {
  gameId: 'g-123',
  status: 'IN_PROGRESS',
  previousStatus: 'PAUSED',
};

/** axios-shaped resolved response. */
function resolved(status: number, data: unknown) {
  return { data, status, statusText: String(status), headers: {}, config: {} } as never;
}

beforeEach(() => {
  __resetLoaderStore();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// pauseGame — POST /games/:gameId/players/:playerId/pause
// ---------------------------------------------------------------------------

describe('pauseGame', () => {
  it('POSTs to the pause endpoint and returns the PauseResumeResponse body', async () => {
    let url = '';
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(200, pauseResp));
    });

    const result = await pauseGame('g-123', 'p-1');

    expect(url).toBe('/games/g-123/players/p-1/pause');
    expect(result).toEqual(pauseResp);
    spy.mockRestore();
  });

  it('propagates the backend error message on 409 WRONG_PHASE', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Game is not in a pausable phase'));
    await expect(pauseGame('g-123', 'p-1')).rejects.toThrow('not in a pausable phase');
  });
});

// ---------------------------------------------------------------------------
// resumeGame — POST /games/:gameId/players/:playerId/resume
// ---------------------------------------------------------------------------

describe('resumeGame', () => {
  it('POSTs to the resume endpoint and returns the restored PauseResumeResponse', async () => {
    let url = '';
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(200, resumeResp));
    });

    const result = await resumeGame('g-123', 'p-1');

    expect(url).toBe('/games/g-123/players/p-1/resume');
    expect(result).toEqual(resumeResp);
    spy.mockRestore();
  });

  it('throws GameNotFoundError when the backend returns 404', async () => {
    // validateStatus allows 404 to resolve; resumeGame throws the sentinel.
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(resumeGame('g-404', 'p-1')).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('GameNotFoundError message includes the gameId', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );
    await expect(resumeGame('g-missing', 'p-1')).rejects.toThrow('g-missing');
  });

  it('throws a plain Error (not GameNotFoundError) on 409 WRONG_PHASE', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Game is not paused'));

    const thrown = await resumeGame('g-123', 'p-1').catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// stopGame — POST /games/:gameId/players/:playerId/stop
// ---------------------------------------------------------------------------

describe('stopGame', () => {
  it('POSTs to the stop endpoint and resolves void on 204', async () => {
    let url = '';
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(204, undefined));
    });

    await expect(stopGame('g-123', 'p-1')).resolves.toBeUndefined();
    expect(url).toBe('/games/g-123/players/p-1/stop');
    spy.mockRestore();
  });

  it('treats an already-gone game (404) as a successful idempotent stop', async () => {
    // validateStatus accepts 404 so the call resolves rather than rejecting.
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(stopGame('g-gone', 'p-1')).resolves.toBeUndefined();
  });

  it('propagates the backend error message on 403 PLAYER_NOT_IN_GAME', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Player is not in this game'));
    await expect(stopGame('g-123', 'p-x')).rejects.toThrow('not in this game');
  });
});
