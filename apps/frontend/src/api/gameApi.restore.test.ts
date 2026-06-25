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

describe('restoreGameByCode', () => {
  it('GETs the restore endpoint and returns the typed RestoreGameResponse on 200', async () => {
    let url = '';
    const spy = vi.spyOn(api, 'get').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(200, restoreResp));
    });

    const result = await restoreGameByCode('ABC123');

    expect(url).toBe('/games/ABC123/restore');
    expect(result).toEqual(restoreResp);
    spy.mockRestore();
  });

  it('encodes the code as a single path segment', async () => {
    let url = '';
    vi.spyOn(api, 'get').mockImplementationOnce((u) => {
      url = u;
      return Promise.resolve(resolved(200, restoreResp));
    });

    await restoreGameByCode('a/b 1');

    expect(url).toBe('/games/a%2Fb%201/restore');
  });

  it('throws GameNotFoundError when the backend returns 404 (validateStatus resolves it)', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(restoreGameByCode('NOPE')).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('GameNotFoundError message includes the code', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found', code: 'GAME_NOT_FOUND' }),
    );

    await expect(restoreGameByCode('MISSING')).rejects.toThrow('MISSING');
  });

  it('propagates a plain Error (not GameNotFoundError) on 5xx/network failures', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network Error'));

    const thrown = await restoreGameByCode('ABC123').catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
  });
});
