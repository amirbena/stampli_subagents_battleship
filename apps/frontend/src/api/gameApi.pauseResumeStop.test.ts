import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  api,
  __resetLoaderStore,
  pauseGame,
  resumeGame,
  stopGame,
  GameNotFoundError,
  NotAuthorizedError,
} from './gameApi';
import type { PauseResumeResponse } from '../types/game';

const TOKEN = 'seat-token-abc';

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
  it('POSTs to the pause endpoint with the token header and returns the PauseResumeResponse body', async () => {
    let url = '';
    let cfg: { headers?: Record<string, string> } = {};
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u, _b, c) => {
      url = u;
      cfg = (c ?? {}) as { headers?: Record<string, string> };
      return Promise.resolve(resolved(200, pauseResp));
    });

    const result = await pauseGame('g-123', 'p-1', TOKEN);

    expect(url).toBe('/games/g-123/players/p-1/pause');
    expect(cfg.headers?.['X-Session-Token']).toBe(TOKEN);
    expect(result).toEqual(pauseResp);
    spy.mockRestore();
  });

  it('propagates the backend error message on 409 WRONG_PHASE', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Game is not in a pausable phase'));
    await expect(pauseGame('g-123', 'p-1', TOKEN)).rejects.toThrow('not in a pausable phase');
  });

  it('throws NotAuthorizedError on 403 NOT_AUTHORIZED', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(403, { error: 'Not authorized', code: 'NOT_AUTHORIZED' }),
    );
    await expect(pauseGame('g-123', 'p-1', 'wrong')).rejects.toBeInstanceOf(NotAuthorizedError);
  });
});

// ---------------------------------------------------------------------------
// resumeGame — POST /games/:gameId/players/:playerId/resume
// ---------------------------------------------------------------------------

describe('resumeGame', () => {
  it('POSTs to the resume endpoint with the token header and returns the restored response', async () => {
    let url = '';
    let cfg: { headers?: Record<string, string> } = {};
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u, _b, c) => {
      url = u;
      cfg = (c ?? {}) as { headers?: Record<string, string> };
      return Promise.resolve(resolved(200, resumeResp));
    });

    const result = await resumeGame('g-123', 'p-1', TOKEN);

    expect(url).toBe('/games/g-123/players/p-1/resume');
    expect(cfg.headers?.['X-Session-Token']).toBe(TOKEN);
    expect(result).toEqual(resumeResp);
    spy.mockRestore();
  });

  it('throws GameNotFoundError when the backend returns 404', async () => {
    // validateStatus allows 404 to resolve; resumeGame throws the sentinel.
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(resumeGame('g-404', 'p-1', TOKEN)).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('throws NotAuthorizedError when the backend returns 403', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(403, { error: 'Not authorized', code: 'NOT_AUTHORIZED' }),
    );
    await expect(resumeGame('g-123', 'p-1', 'wrong')).rejects.toBeInstanceOf(NotAuthorizedError);
  });

  it('GameNotFoundError message includes the gameId', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );
    await expect(resumeGame('g-missing', 'p-1', TOKEN)).rejects.toThrow('g-missing');
  });

  it('throws a plain Error (not GameNotFoundError) on 409 WRONG_PHASE', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Game is not paused'));

    const thrown = await resumeGame('g-123', 'p-1', TOKEN).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// stopGame — POST /games/:gameId/players/:playerId/stop
// ---------------------------------------------------------------------------

describe('stopGame', () => {
  it('POSTs to the stop endpoint with the token header and resolves void on 204', async () => {
    let url = '';
    let cfg: { headers?: Record<string, string> } = {};
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u, _b, c) => {
      url = u;
      cfg = (c ?? {}) as { headers?: Record<string, string> };
      return Promise.resolve(resolved(204, undefined));
    });

    await expect(stopGame('g-123', 'p-1', TOKEN)).resolves.toBeUndefined();
    expect(url).toBe('/games/g-123/players/p-1/stop');
    expect(cfg.headers?.['X-Session-Token']).toBe(TOKEN);
    spy.mockRestore();
  });

  it('treats an already-gone game (404) as a successful idempotent stop', async () => {
    // validateStatus accepts 404 so the call resolves rather than rejecting.
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(stopGame('g-gone', 'p-1', TOKEN)).resolves.toBeUndefined();
  });

  it('treats a 403 NOT_AUTHORIZED as an idempotent stop (clean-Home, no blocking error)', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(403, { error: 'Not authorized', code: 'NOT_AUTHORIZED' }),
    );

    await expect(stopGame('g-123', 'p-x', 'wrong')).resolves.toBeUndefined();
  });

  it('propagates a transient Error on 5xx/network', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network Error'));
    await expect(stopGame('g-123', 'p-1', TOKEN)).rejects.toThrow('Network Error');
  });
});
