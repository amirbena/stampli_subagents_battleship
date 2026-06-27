import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useJoinGame } from './useJoinGame';
import * as gameApi from '../api/gameApi';
import { GameNotFoundError } from '../api/gameApi';
import type { JoinGameResponse } from '../types/game';

const joinResp: JoinGameResponse = {
  gameId: 'ABC123',
  playerId: 'joiner-2',
  status: 'PLACING_SHIPS',
  sessionToken: 'joiner-seat-token',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useJoinGame', () => {
  it('success path: returns a DISTINCT identity + own sessionToken, stores it, clears notFound/error', async () => {
    const spy = vi.spyOn(gameApi, 'joinGame').mockResolvedValueOnce(joinResp);

    const { result } = renderHook(() => useJoinGame());

    let returned: JoinGameResponse | null = null;
    await act(async () => {
      returned = await result.current.join('ABC123', 'persistent-pid');
    });

    // The code (which IS the gameId) and the optional persistent playerId are forwarded.
    expect(spy).toHaveBeenCalledWith('ABC123', 'persistent-pid');
    expect(returned).toEqual(joinResp);
    // Joiner gets its OWN distinct identity + its OWN per-seat token (never the creator's).
    expect((returned as unknown as JoinGameResponse).playerId).toBe('joiner-2');
    expect((returned as unknown as JoinGameResponse).sessionToken).toBe('joiner-seat-token');
    expect(result.current.data).toEqual(joinResp);
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('forwards the call without a playerId when the UI omits it (anonymous path)', async () => {
    const spy = vi.spyOn(gameApi, 'joinGame').mockResolvedValueOnce(joinResp);

    const { result } = renderHook(() => useJoinGame());
    await act(async () => {
      await result.current.join('ABC123');
    });

    expect(spy).toHaveBeenCalledWith('ABC123', undefined);
  });

  it('not-joinable path: resolves null, sets notFound, does NOT throw or set error', async () => {
    vi.spyOn(gameApi, 'joinGame').mockRejectedValueOnce(new GameNotFoundError('NOPE'));

    const { result } = renderHook(() => useJoinGame());

    let returned: JoinGameResponse | null = joinResp;
    await act(async () => {
      returned = await result.current.join('NOPE', 'persistent-pid');
    });

    expect(returned).toBeNull();
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('transient path: sets error and re-throws on 5xx/network failure', async () => {
    vi.spyOn(gameApi, 'joinGame').mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useJoinGame());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.join('ABC123', 'persistent-pid').catch((e: unknown) => e);
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Network Error');
    expect(result.current.error).toBe('Network Error');
    expect(result.current.notFound).toBe(false);
  });

  it('isLoading toggles true during the request and false after it settles', async () => {
    let resolveFn: (v: JoinGameResponse) => void = () => {};
    vi.spyOn(gameApi, 'joinGame').mockImplementationOnce(
      () => new Promise<JoinGameResponse>((res) => { resolveFn = res; }),
    );

    const { result } = renderHook(() => useJoinGame());

    let joinPromise!: Promise<JoinGameResponse | null>;
    act(() => {
      joinPromise = result.current.join('ABC123', 'persistent-pid');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFn(joinResp);
      await joinPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('clears a prior notFound when a subsequent join succeeds', async () => {
    const spy = vi.spyOn(gameApi, 'joinGame');
    spy.mockRejectedValueOnce(new GameNotFoundError('NOPE'));
    spy.mockResolvedValueOnce(joinResp);

    const { result } = renderHook(() => useJoinGame());

    await act(async () => {
      await result.current.join('NOPE', 'persistent-pid');
    });
    expect(result.current.notFound).toBe(true);

    await act(async () => {
      await result.current.join('ABC123', 'persistent-pid');
    });
    expect(result.current.notFound).toBe(false);
    expect(result.current.data).toEqual(joinResp);
  });
});
