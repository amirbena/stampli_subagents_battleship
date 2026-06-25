import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRestoreGame } from './useRestoreGame';
import * as gameApi from '../api/gameApi';
import { GameNotFoundError } from '../api/gameApi';
import type { RestoreGameResponse } from '../types/game';

const restoreResp: RestoreGameResponse = {
  gameId: 'ABC123',
  playerId: 'p-1',
  gameMode: 'COMPUTER',
  status: 'IN_PROGRESS',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRestoreGame', () => {
  it('success path: returns + stores the typed response, clears notFound/error', async () => {
    vi.spyOn(gameApi, 'restoreGameByCode').mockResolvedValueOnce(restoreResp);

    const { result } = renderHook(() => useRestoreGame());

    let returned: RestoreGameResponse | null = null;
    await act(async () => {
      returned = await result.current.submit('ABC123');
    });

    expect(returned).toEqual(restoreResp);
    expect(result.current.data).toEqual(restoreResp);
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('not-found path: resolves null, sets notFound, does NOT throw or set error', async () => {
    vi.spyOn(gameApi, 'restoreGameByCode').mockRejectedValueOnce(new GameNotFoundError('NOPE'));

    const { result } = renderHook(() => useRestoreGame());

    let returned: RestoreGameResponse | null = restoreResp;
    await act(async () => {
      returned = await result.current.submit('NOPE');
    });

    expect(returned).toBeNull();
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('transient path: sets error and re-throws on 5xx/network failure', async () => {
    vi.spyOn(gameApi, 'restoreGameByCode').mockRejectedValueOnce(new Error('Network Error'));

    const { result } = renderHook(() => useRestoreGame());

    let thrown: unknown;
    await act(async () => {
      thrown = await result.current.submit('ABC123').catch((e: unknown) => e);
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Network Error');
    expect(result.current.error).toBe('Network Error');
    expect(result.current.notFound).toBe(false);
  });

  it('isLoading toggles true during the request and false after it settles', async () => {
    let resolveFn: (v: RestoreGameResponse) => void = () => {};
    vi.spyOn(gameApi, 'restoreGameByCode').mockImplementationOnce(
      () => new Promise<RestoreGameResponse>((res) => { resolveFn = res; }),
    );

    const { result } = renderHook(() => useRestoreGame());

    let submitPromise!: Promise<RestoreGameResponse | null>;
    act(() => {
      submitPromise = result.current.submit('ABC123');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveFn(restoreResp);
      await submitPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('clears a prior notFound when a subsequent submit succeeds', async () => {
    const spy = vi.spyOn(gameApi, 'restoreGameByCode');
    spy.mockRejectedValueOnce(new GameNotFoundError('NOPE'));
    spy.mockResolvedValueOnce(restoreResp);

    const { result } = renderHook(() => useRestoreGame());

    await act(async () => {
      await result.current.submit('NOPE');
    });
    expect(result.current.notFound).toBe(true);

    await act(async () => {
      await result.current.submit('ABC123');
    });
    expect(result.current.notFound).toBe(false);
    expect(result.current.data).toEqual(restoreResp);
  });
});
