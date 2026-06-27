import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import {
  api,
  placeShip,
  removeShip,
  getActiveRequestCount,
  isLoaderVisible,
  __resetLoaderStore,
} from './gameApi';
import type { PlaceShipRequest } from '../types/game';

/**
 * Captures the request config the real wrappers hand to axios (so we can assert the
 * `silent` flag is forwarded) and resolves with a canned body. Running through the real
 * `api` instance means the real request/response interceptors fire — so the loader
 * counter reflects exactly what production would do for a silent vs non-silent call.
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

const SHIP: PlaceShipRequest = {
  shipType: 'CARRIER',
  row: 0,
  col: 0,
  orientation: 'HORIZONTAL',
};

beforeEach(() => {
  __resetLoaderStore();
  vi.restoreAllMocks();
});

describe('placeShip — silent flag + loader exclusion', () => {
  it('forwards silent: true to the request config and never moves the loader counter', async () => {
    const cap = capturingAdapter({ cells: [] });
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    await placeShip('GAME01', 'p1', SHIP, true);

    expect(cap.seen[0].silent).toBe(true);
    expect(cap.seen[0].url).toBe('/games/GAME01/players/p1/ships');
    // Silent placement must never register on the global loader.
    expect(getActiveRequestCount()).toBe(0);
    expect(isLoaderVisible()).toBe(false);
  });

  it('counts on the loader when called non-silently (default)', async () => {
    const cap = capturingAdapter({ cells: [] });
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    const p = placeShip('GAME01', 'p1', SHIP);
    // Request interceptor is synchronous: counter is already 1 before the response settles.
    expect(getActiveRequestCount()).toBe(1);
    expect(isLoaderVisible()).toBe(true);

    await p;
    expect(cap.seen[0].silent).toBeFalsy();
    expect(getActiveRequestCount()).toBe(0);
  });
});

describe('removeShip — silent flag + loader exclusion', () => {
  it('forwards silent: true to the request config and never moves the loader counter', async () => {
    const cap = capturingAdapter(undefined);
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    await removeShip('GAME01', 'p1', 'CARRIER', true);

    expect(cap.seen[0].silent).toBe(true);
    expect(cap.seen[0].url).toBe('/games/GAME01/players/p1/ships/CARRIER');
    expect(getActiveRequestCount()).toBe(0);
    expect(isLoaderVisible()).toBe(false);
  });

  it('counts on the loader when called non-silently (default)', async () => {
    const cap = capturingAdapter(undefined);
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    const p = removeShip('GAME01', 'p1', 'CARRIER');
    expect(getActiveRequestCount()).toBe(1);

    await p;
    expect(cap.seen[0].silent).toBeFalsy();
    expect(getActiveRequestCount()).toBe(0);
  });
});

describe('overlapping silent placement does not flicker the loader for a concurrent user call', () => {
  it('keeps the counter at 1 (the non-silent call) while a silent placement runs', async () => {
    const cap = capturingAdapter({ cells: [] });
    vi.spyOn(api.defaults, 'adapter', 'get').mockReturnValue(cap.adapter);

    const silent = placeShip('GAME01', 'p1', SHIP, true);
    const loud = placeShip('GAME01', 'p1', SHIP, false);

    // Only the non-silent placement is counted.
    expect(getActiveRequestCount()).toBe(1);

    await Promise.all([silent, loud]);
    expect(getActiveRequestCount()).toBe(0);
  });
});
