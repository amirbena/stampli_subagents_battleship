/**
 * Integration tests for GlobalLoader — renders the real component against the
 * real store (no mocks) and drives actual Axios requests through the interceptors.
 *
 * These tests exist because the unit tests (GlobalLoader.test.tsx mocks the store,
 * gameApi.loader.test.ts never renders React) cannot catch timing bugs that only
 * surface when React rendering and Axios response arrival race each other.
 *
 * The critical scenario this file guards against:
 *   - A localhost response arrives in <1 ms
 *   - React has not yet run any effect
 *   - The bar must still appear because isLoaderVisible() stays true for 300 ms
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { AxiosAdapter } from 'axios';
import { GlobalLoader } from './GlobalLoader';
import { api, __resetLoaderStore } from '../../../api/gameApi';

function deferredAdapter() {
  let settle!: (mode: 'success' | 'error') => void;
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      settle = (mode) => {
        if (mode === 'success') {
          resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
        } else {
          reject({ config, message: 'network error', response: undefined });
        }
      };
    });
  return { adapter, succeed: () => settle('success'), fail: () => settle('error') };
}

beforeEach(() => {
  vi.useFakeTimers();
  __resetLoaderStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GlobalLoader integration — real store, real interceptors', () => {
  it('shows the bar while a request is in flight', async () => {
    const d = deferredAdapter();
    render(<GlobalLoader />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Start request — interceptor increments the store synchronously
    const p = api.get('/test', { adapter: d.adapter });

    await act(async () => {
      await Promise.resolve(); // let the interceptor microtask settle
    });

    expect(screen.getByRole('status')).toBeInTheDocument();

    // Clean up
    d.succeed();
    await act(async () => { await p; });
  });

  /**
   * The regression test for the timing bug.
   *
   * Scenario: fast localhost response — increment AND decrement both fire before
   * React has rendered even once. The bar must still appear for 300 ms because
   * isLoaderVisible() is held true by the hide timer in the store.
   *
   * This test FAILED with useState+useEffect and useState+useLayoutEffect approaches
   * because setVisible(true) was never called when activeRequests was already 0
   * by the time any effect ran.
   */
  it('shows the bar even when the response arrives before React renders (fast localhost)', async () => {
    const d = deferredAdapter();
    render(<GlobalLoader />);

    // Fire the request AND immediately complete it — simulates a sub-ms response
    const p = api.get('/test', { adapter: d.adapter });
    d.succeed();

    await act(async () => { await p; });

    // Bar must be visible — isLoaderVisible() is true for 300ms after decrement
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Still visible at 299ms
    act(() => { vi.advanceTimersByTime(299); });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Hidden after 300ms
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('hides the bar after 300ms on a normal-speed request', async () => {
    const d = deferredAdapter();
    render(<GlobalLoader />);

    const p = api.get('/test', { adapter: d.adapter });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('status')).toBeInTheDocument();

    d.succeed();
    await act(async () => { await p; });

    // Still visible (within 300ms window)
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not show the bar for silent (background poll) requests', async () => {
    const d = deferredAdapter();
    render(<GlobalLoader />);

    const p = api.get('/test', { adapter: d.adapter, silent: true });
    d.succeed();
    await act(async () => { await p; });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the bar visible across back-to-back requests', async () => {
    const d1 = deferredAdapter();
    const d2 = deferredAdapter();
    render(<GlobalLoader />);

    const p1 = api.get('/a', { adapter: d1.adapter });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status')).toBeInTheDocument();

    d1.succeed();
    await act(async () => { await p1; });
    // Within 300ms window — still visible
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Second request starts before hide timer fires
    const p2 = api.get('/b', { adapter: d2.adapter });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('status')).toBeInTheDocument();

    d2.succeed();
    await act(async () => { await p2; });

    // Fresh 300ms window from second request
    act(() => { vi.advanceTimersByTime(299); });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
