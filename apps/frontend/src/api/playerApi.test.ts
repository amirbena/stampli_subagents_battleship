import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosAdapter } from 'axios';
import { api, __resetLoaderStore } from './gameApi';
import { createPlayer, getPlayer, PlayerNotFoundError } from './playerApi';
import type { PlayerResponse } from '../types/game';

const mockPlayer: PlayerResponse = {
  playerId: 'player-uuid-123',
  displayName: 'Alice',
  createdAt: '2026-06-25T06:48:00Z',
};

/**
 * Build an adapter that immediately resolves with the given status/data.
 * `validateStatus` in getPlayer accepts 404 without rejection, so the adapter
 * can return 404 as a resolved response and playerApi's own check fires.
 */
function resolveAdapter(status: number, data: unknown): AxiosAdapter {
  return (config) =>
    Promise.resolve({
      data,
      status,
      statusText: String(status),
      headers: {},
      config,
    });
}

/**
 * Build an adapter that rejects with an axios-shaped error (network failure or 4xx/5xx
 * caught by the global response interceptor).
 */
function rejectAdapter(status: number | undefined, message: string, data?: unknown): AxiosAdapter {
  return (_config) => {
    const err: Record<string, unknown> = {
      isAxiosError: true,
      message,
      response: status !== undefined
        ? { status, data: data ?? {}, headers: {} }
        : undefined,
    };
    return Promise.reject(err);
  };
}

beforeEach(() => {
  __resetLoaderStore();
});

// ---------------------------------------------------------------------------
// createPlayer — POST /players
// ---------------------------------------------------------------------------

describe('createPlayer', () => {
  it('returns PlayerResponse on 201 success', async () => {
    const adapter = resolveAdapter(201, mockPlayer);
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((_url, _body, _config?) =>
      Promise.resolve({ data: mockPlayer, status: 201, statusText: 'Created', headers: {}, config: {} } as never),
    );

    const result = await createPlayer('Alice');
    expect(result).toEqual(mockPlayer);
    spy.mockRestore();
    void adapter; // referenced to satisfy lint
  });

  it('sends { displayName } as the request body', async () => {
    let capturedBody: unknown;
    const spy = vi.spyOn(api, 'post').mockImplementationOnce((_url, body) => {
      capturedBody = body;
      return Promise.resolve({ data: mockPlayer, status: 201, statusText: 'Created', headers: {}, config: {} } as never);
    });

    await createPlayer('Alice');
    expect(capturedBody).toEqual({ displayName: 'Alice' });
    spy.mockRestore();
  });

  it('throws with the backend error message on 400 validation failure', async () => {
    const spy = vi.spyOn(api, 'post').mockRejectedValueOnce(
      new Error('Display name is required'),
    );

    await expect(createPlayer('')).rejects.toThrow('Display name is required');
    spy.mockRestore();
  });

  it('throws with the backend error message for TOO_LONG', async () => {
    const spy = vi.spyOn(api, 'post').mockRejectedValueOnce(
      new Error('Display name must be 30 characters or fewer'),
    );

    await expect(createPlayer('a'.repeat(31))).rejects.toThrow('30 characters');
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// getPlayer — GET /players/{playerId}
// ---------------------------------------------------------------------------

describe('getPlayer', () => {
  it('returns PlayerResponse on 200 success', async () => {
    const spy = vi.spyOn(api, 'get').mockResolvedValueOnce(
      { data: mockPlayer, status: 200, statusText: 'OK', headers: {}, config: {} } as never,
    );

    const result = await getPlayer('player-uuid-123');
    expect(result).toEqual(mockPlayer);
    spy.mockRestore();
  });

  it('throws PlayerNotFoundError when status is 404', async () => {
    // validateStatus allows 404 to resolve rather than reject.
    // Mock api.get to return a 404 resolved response.
    const spy = vi.spyOn(api, 'get').mockResolvedValueOnce(
      { data: { error: 'Player not found', code: 'PLAYER_NOT_FOUND' }, status: 404, statusText: 'Not Found', headers: {}, config: {} } as never,
    );

    await expect(getPlayer('unknown-uuid')).rejects.toThrow(PlayerNotFoundError);
    spy.mockRestore();
  });

  it('PlayerNotFoundError message includes the playerId', async () => {
    const spy = vi.spyOn(api, 'get').mockResolvedValueOnce(
      { data: { error: 'Player not found', code: 'PLAYER_NOT_FOUND' }, status: 404, statusText: 'Not Found', headers: {}, config: {} } as never,
    );

    await expect(getPlayer('my-missing-id')).rejects.toThrow('my-missing-id');
    spy.mockRestore();
  });

  it('throws a plain Error (not PlayerNotFoundError) on network failure', async () => {
    const spy = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Network Error'));

    const thrown = await getPlayer('some-id').catch((e: unknown) => e);
    expect(thrown).not.toBeInstanceOf(PlayerNotFoundError);
    expect(thrown).toBeInstanceOf(Error);
    spy.mockRestore();

    void rejectAdapter; // referenced to satisfy lint
  });

  it('throws a plain Error (not PlayerNotFoundError) on 5xx server error', async () => {
    const spy = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('Internal Server Error'));

    const thrown = await getPlayer('some-id').catch((e: unknown) => e);
    expect(thrown).not.toBeInstanceOf(PlayerNotFoundError);
    spy.mockRestore();
  });
});
