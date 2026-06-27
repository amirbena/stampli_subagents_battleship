import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, __resetLoaderStore, joinGame, GameNotFoundError } from './gameApi';
import type { JoinGameResponse } from '../types/game';

const joinResp: JoinGameResponse = {
  gameId: 'ABC123',
  playerId: 'joiner-2',
  status: 'PLACING_SHIPS',
  sessionToken: 'joiner-seat-token',
};

/** axios-shaped resolved response. */
function resolved(status: number, data: unknown) {
  return { data, status, statusText: String(status), headers: {}, config: {} } as never;
}

beforeEach(() => {
  __resetLoaderStore();
  vi.restoreAllMocks();
});

describe('joinGame', () => {
  it('POSTs the join endpoint with the gameId body + persistent playerId and returns the joiner seat on 200', async () => {
    let url = '';
    let body: unknown;
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((u, b) => {
      url = u;
      body = b;
      return Promise.resolve(resolved(200, joinResp));
    });

    const result = await joinGame('ABC123', 'persistent-pid');

    expect(url).toBe('/games/ABC123/join');
    expect(body).toEqual({ gameId: 'ABC123', playerId: 'persistent-pid' });
    // The joiner receives its OWN distinct identity + per-seat token (never the creator's).
    expect(result).toEqual(joinResp);
    expect(result.sessionToken).toBe('joiner-seat-token');
    spy.mockRestore();
  });

  it('omits playerId from the body for the anonymous path', async () => {
    let body: unknown;
    vi.spyOn(api, 'post').mockImplementationOnce((_u, b) => {
      body = b;
      return Promise.resolve(resolved(200, joinResp));
    });

    await joinGame('ABC123');

    expect(body).toEqual({ gameId: 'ABC123' });
  });

  it('throws GameNotFoundError on the generic 404 not-joinable response (missing/full/already-started)', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce(
      resolved(404, { error: 'Game not found or not joinable', code: 'GAME_NOT_FOUND' }),
    );

    await expect(joinGame('NOPE', 'persistent-pid')).rejects.toBeInstanceOf(GameNotFoundError);
  });

  it('propagates a plain Error (not GameNotFoundError) on 5xx/network failures', async () => {
    vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('Network Error'));

    const thrown = await joinGame('ABC123', 'persistent-pid').catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(GameNotFoundError);
  });
});
