import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AxiosAdapter } from 'axios';
import {
  api,
  getActiveRequestCount,
  isLoaderVisible,
  subscribeActiveRequests,
  __resetLoaderStore,
} from './gameApi';

/**
 * Drive a request through the real interceptors with a stub adapter that resolves
 * (or rejects) on demand, so we can observe the in-flight counter mid-flight.
 */
function deferredAdapter() {
  let settle!: (mode: 'success' | 'error') => void;
  const adapter: AxiosAdapter = (config) =>
    new Promise((resolve, reject) => {
      settle = (mode) => {
        if (mode === 'success') {
          resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
        } else {
          reject({ config, message: 'boom', response: undefined });
        }
      };
    });
  return { adapter, succeed: () => settle('success'), fail: () => settle('error') };
}

/**
 * Axios runs the request interceptor (which increments the counter) and the adapter
 * on the microtask queue, so the count/adapter are not set synchronously after
 * api.get(). Flush pending microtasks before asserting in-flight state.
 */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  __resetLoaderStore();
});

describe('global HTTP loader store', () => {
  it('increments while a non-silent request is in flight and clears on success (AC-1/AC-2)', async () => {
    const d = deferredAdapter();
    const p = api.get('/x', { adapter: d.adapter });
    await flush();

    expect(getActiveRequestCount()).toBe(1);
    d.succeed();
    await p;
    expect(getActiveRequestCount()).toBe(0);
  });

  it('clears the counter even when the request errors (AC-3 — no stuck spinner)', async () => {
    const d = deferredAdapter();
    const p = api.get('/x', { adapter: d.adapter });
    await flush();

    expect(getActiveRequestCount()).toBe(1);
    d.fail();
    await expect(p).rejects.toBeTruthy();
    expect(getActiveRequestCount()).toBe(0);
  });

  it('ignores silent (background poll) requests (AC-4)', async () => {
    const d = deferredAdapter();
    // `silent: true` mirrors how getGameState tags the 2s poll.
    const p = api.get('/x', { adapter: d.adapter, silent: true });
    await flush();

    expect(getActiveRequestCount()).toBe(0);
    d.succeed();
    await p;
    expect(getActiveRequestCount()).toBe(0);
  });

  it('stays visible until the LAST of overlapping requests settles (AC-5)', async () => {
    const a = deferredAdapter();
    const b = deferredAdapter();
    const pa = api.get('/a', { adapter: a.adapter });
    const pb = api.get('/b', { adapter: b.adapter });
    await flush();

    expect(getActiveRequestCount()).toBe(2);
    a.succeed();
    await pa;
    expect(getActiveRequestCount()).toBe(1); // still visible — b in flight
    b.succeed();
    await pb;
    expect(getActiveRequestCount()).toBe(0);
  });

  it('counts non-silent but ignores a concurrent silent poll', async () => {
    const user = deferredAdapter();
    const poll = deferredAdapter();
    const pu = api.get('/fire', { adapter: user.adapter });
    const pp = api.get('/state', { adapter: poll.adapter, silent: true });
    await flush();

    expect(getActiveRequestCount()).toBe(1); // only the user call counts
    poll.succeed();
    await pp;
    expect(getActiveRequestCount()).toBe(1);
    user.succeed();
    await pu;
    expect(getActiveRequestCount()).toBe(0);
  });

  it('increments synchronously — no flush() needed (AC-6: synchronous interceptor)', () => {
    // With { synchronous: true } on the request interceptor, increment() fires
    // during the same call-stack frame as api.get(), before any microtask runs.
    // This verifies that React 18 batching cannot collapse the 0→1→0 transition
    // into a single render: by the time api.get() returns, count is already 1.
    const d = deferredAdapter();
    // Start the request but do NOT await or flush — no microtasks allowed.
    api.get('/x', { adapter: d.adapter }).catch(() => {
      // swallow resolution/rejection; we only care about the synchronous increment.
    });

    // Count must already be 1 here — no await, no flush.
    expect(getActiveRequestCount()).toBe(1);
  });

  it('notifies subscribers on change and stops after unsubscribe', async () => {
    let callCount = 0;
    const unsub = subscribeActiveRequests(() => { callCount++; });

    const d = deferredAdapter();
    const p = api.get('/x', { adapter: d.adapter });
    await flush();
    d.succeed();
    await p;

    const countAfterFirstRequest = callCount;
    expect(countAfterFirstRequest).toBeGreaterThan(0);
    unsub();

    const d2 = deferredAdapter();
    const p2 = api.get('/y', { adapter: d2.adapter });
    await flush();
    d2.succeed();
    await p2;
    expect(callCount).toBe(countAfterFirstRequest); // unchanged after unsubscribe
  });
});

describe('isLoaderVisible — 300 ms minimum display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetLoaderStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is true while a request is in flight', async () => {
    const d = deferredAdapter();
    const p = api.get('/x', { adapter: d.adapter });
    await flush();
    expect(isLoaderVisible()).toBe(true);
    d.succeed();
    await p;
  });

  it('stays true for 300 ms after the last request completes then becomes false', async () => {
    const d = deferredAdapter();
    const p = api.get('/x', { adapter: d.adapter });
    await flush();
    d.succeed();
    await p;

    expect(isLoaderVisible()).toBe(true); // still within 300 ms window

    vi.advanceTimersByTime(299);
    expect(isLoaderVisible()).toBe(true);

    vi.advanceTimersByTime(1); // total 300 ms
    expect(isLoaderVisible()).toBe(false);
  });

  it('cancels the hide timer when a new request arrives before 300 ms', async () => {
    const d1 = deferredAdapter();
    const p1 = api.get('/a', { adapter: d1.adapter });
    await flush();
    d1.succeed();
    await p1;

    vi.advanceTimersByTime(150); // partway through the hide window

    // New request starts — hide timer must be cancelled
    const d2 = deferredAdapter();
    const p2 = api.get('/b', { adapter: d2.adapter });
    await flush();

    vi.advanceTimersByTime(200); // original timer would have fired at 300 ms total
    expect(isLoaderVisible()).toBe(true); // still in flight, not hidden

    d2.succeed();
    await p2;

    // Fresh 300 ms window from d2 completion
    vi.advanceTimersByTime(299);
    expect(isLoaderVisible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isLoaderVisible()).toBe(false);
  });
});
