import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, __resetLoaderStore, restoreGameByCode, GameNotFoundError } from './gameApi';
import type { RestoreGameResponse } from '../types/game';

const restoreResp: RestoreGameResponse = {
  gameId: 'ABC123',
  playerId: 'p-1',
  gameMode: 'COMPUTER',
  status: 'IN_PROGRESS',
};

/** axios-shaped resolved response. */
function resolved(status: number, data: unknown) {
  return { data, status, statusText: String(status), headers: {}, config: {} } as never;
}

beforeEach(() => {
  __resetLoaderStore();
  vi.restoreAllMocks();
});

const PID = 'p-1';
const TOKEN = 'seat-token-abc';

describe('restoreGameByCode', () => {
  it('GETs the restore endpoint with BOTH belonging headers and returns the typed response on 200', async () => {
    let url = '';
    let cfg: { headers?: Record<string, string> } = {};
    const spy = vi.spyOn(api, 'get').mockImplementationOnce((u, c) => {
      url = u;
      cfg = (c ?? {}) as { headers?: Record<string, string> };
      return Promise.resolve(resolved(200, restoreResp));
    });

    const result = await restoreGameByCode('ABC123', PID, TOKEN);

    expect(url).toBe('/games/ABC123/restore');
    // Restore is a belonging probe: it sends the caller's own seat id AND secret.
    expect(cfg.headers?.['X-Player-Id']).toBe(PID);
    expect(cfg.headers?.['X-Session-Token']).toBe(TOKEN);
    expect(result).toEqual(restoreResp);
    spy.mockRestore();
  });

  it('serves both modes — a HUMAN restore response is returned unchanged on 200', async () => {
    const humanResp: RestoreGameResponse = { ...restoreResp, gameMode: 'HUMAN' };
    vi.spyOn(api, 'get').mockResolvedValueOnce(resolved(200, humanResp));

    const result = await restoreGameByCode('ABC123', PID, TOKEN);

    expect(result.gameMode).toBe('HUMAN');
  });

  it('encodes the code as a single path segment', async () => {
    let url = '';
    vi.spyOn(api, 'get').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(200, restoreResp));
    });

    await restoreGameByCode('a/b 1', PID, TOKEN);

    expect(url).toBe('/games/a%2Fb%201/restore');
  });

  it('throws GameNotFoundError when the backend returns 404 (validateStatus resolves it)', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found or not joinable', code: 'GAME_NOT_FOUND' }),
    );

    await expect(restoreGameByCode('NOPE', PID, TOKEN)).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('GameNotFoundError message includes the code', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found or not joinable', code: 'GAME_NOT_FOUND' }),
    );

    await expect(restoreGameByCode('MISSING', PID, TOKEN)).rejects.toThrow('MISSING');
  });

  it('propagates a plain Error (not GameNotFoundError) on 5xx/network failures', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network Error'));

    const thrown = await restoreGameByCode('ABC123', PID, TOKEN).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
  });
});
