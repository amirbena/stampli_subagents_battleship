import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import {
  api,
  fireShot,
  getActiveRequestCount,
  isLoaderVisible,
  __resetLoaderStore,
} from './gameApi';

/**
 * Captures the request config the fireShot wrapper hands to axios (to assert the
 * `silent` flag is forwarded) and resolves with a canned shot result. Running through
 * the real `api` instance means the real request/response interceptors fire — so the
 * loader counter reflects exactly what production does for a silent vs non-silent shot.
 */
function capturingAdapter(body: unknown) {
  const seen: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = (config) => {
    seen.push(config);
    return Promise.resolve({
      data: body,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  };
  return { adapter, seen };
}

const SHOT_RESULT = {
  result: 'MISS',
  sunkShipType: null,
  nextTurnPlayerId: 'p2',
  winnerId: null,
};

beforeEach(() => {
  __resetLoaderStore();
  vi.restoreAllMocks();
});

describe('fireShot — silent flag + loader exclusion', () => {
  it('forwards silent: true to the request config and never moves the loader counter', async () => {
    const cap = capturingAdapter(SHOT_RESULT);
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    await fireShot('GAME01', 'p1', 3, 4, true);

    expect(cap.seen[0].silent).toBe(true);
    expect(cap.seen[0].url).toBe('/games/GAME01/players/p1/fire');
    expect(cap.seen[0].data).toBe(JSON.stringify({ row: 3, col: 4 }));
    // Silent shot must never register on the global loader.
    expect(getActiveRequestCount()).toBe(0);
    expect(isLoaderVisible()).toBe(false);
  });

  it('counts on the loader when called non-silently (default)', async () => {
    const cap = capturingAdapter(SHOT_RESULT);
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    const p = fireShot('GAME01', 'p1', 0, 0);
    // Request interceptor is synchronous: counter is already 1 before the response settles.
    expect(getActiveRequestCount()).toBe(1);
    expect(isLoaderVisible()).toBe(true);

    await p;
    expect(cap.seen[0].silent).toBeFalsy();
    expect(getActiveRequestCount()).toBe(0);
  });
});
