import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlayerIdentity, PlayerIdentityStatus } from './usePlayerIdentity';
import * as playerApi from '../api/playerApi';
import type { PlayerResponse } from '../types/game';

const PLAYER_ID_KEY = 'battleship_player_id';

const mockPlayer: PlayerResponse = {
  playerId: 'player-uuid-abc',
  displayName: 'Alice',
  createdAt: '2026-06-25T06:48:00Z',
};

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper: seed localStorage before the hook mounts.
function seedLocalStorage(id: string) {
  window.localStorage.setItem(PLAYER_ID_KEY, JSON.stringify(id));
}

// ---------------------------------------------------------------------------
// Branch 1: localStorage absent → immediate needs-name
// ---------------------------------------------------------------------------

describe('absent localStorage ID', () => {
  it('starts with status needs-name and no player when localStorage is empty', () => {
    const { result } = renderHook(() => usePlayerIdentity());
    expect(result.current.status).toBe<PlayerIdentityStatus>('needs-name');
    expect(result.current.player).toBeNull();
    expect(result.current.isOptimistic).toBe(false);
  });

  it('does not call getPlayer when no ID is stored', () => {
    const spy = vi.spyOn(playerApi, 'getPlayer');
    renderHook(() => usePlayerIdentity());
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Branch 2: localStorage present + GET returns 200 → identified
// ---------------------------------------------------------------------------

describe('present localStorage ID + backend 200', () => {
  it('transitions from loading to identified after successful GET', async () => {
    seedLocalStorage('player-uuid-abc');
    vi.spyOn(playerApi, 'getPlayer').mockResolvedValue(mockPlayer);

    const { result } = renderHook(() => usePlayerIdentity());

    // Immediately after mount: loading (optimistic).
    expect(result.current.status).toBe<PlayerIdentityStatus>('loading');
    expect(result.current.isOptimistic).toBe(true);

    await waitFor(() => {
      expect(result.current.status).toBe<PlayerIdentityStatus>('identified');
    });

    expect(result.current.player).toEqual(mockPlayer);
    expect(result.current.isOptimistic).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls getPlayer with the stored playerId', async () => {
    seedLocalStorage('player-uuid-abc');
    const spy = vi.spyOn(playerApi, 'getPlayer').mockResolvedValue(mockPlayer);

    renderHook(() => usePlayerIdentity());

    await waitFor(() => expect(spy).toHaveBeenCalledWith('player-uuid-abc'));
  });
});

// ---------------------------------------------------------------------------
// Branch 3: localStorage present + GET returns 404 → clear + needs-name
// ---------------------------------------------------------------------------

describe('present localStorage ID + backend 404', () => {
  it('clears localStorage and transitions to needs-name on 404', async () => {
    seedLocalStorage('stale-uuid');
    vi.spyOn(playerApi, 'getPlayer').mockRejectedValue(
      new playerApi.PlayerNotFoundError('stale-uuid'),
    );

    const { result } = renderHook(() => usePlayerIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe<PlayerIdentityStatus>('needs-name');
    });

    expect(result.current.player).toBeNull();
    // localStorage must be cleared so the next mount does not loop.
    expect(window.localStorage.getItem(PLAYER_ID_KEY)).toBeNull();
  });

  it('does not surface the 404 as an error (it is a normal state transition)', async () => {
    seedLocalStorage('stale-uuid');
    vi.spyOn(playerApi, 'getPlayer').mockRejectedValue(
      new playerApi.PlayerNotFoundError('stale-uuid'),
    );

    const { result } = renderHook(() => usePlayerIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe<PlayerIdentityStatus>('needs-name');
    });

    expect(result.current.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Branch 4: localStorage present + network error → keep optimistic
// ---------------------------------------------------------------------------

describe('present localStorage ID + network error', () => {
  it('keeps status identified (optimistic) on transient network error', async () => {
    seedLocalStorage('player-uuid-abc');
    vi.spyOn(playerApi, 'getPlayer').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => usePlayerIdentity());

    await waitFor(() => {
      // Status transitions from loading to identified (optimistic preserved).
      expect(result.current.status).toBe<PlayerIdentityStatus>('identified');
    });

    // localStorage is NOT cleared for transient errors.
    expect(window.localStorage.getItem(PLAYER_ID_KEY)).not.toBeNull();
  });

  it('sets error on transient network error', async () => {
    seedLocalStorage('player-uuid-abc');
    vi.spyOn(playerApi, 'getPlayer').mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => usePlayerIdentity());

    await waitFor(() => {
      expect(result.current.error).toBe('Network Error');
    });
  });
});

// ---------------------------------------------------------------------------
// Branch 5: createPlayer — success path
// ---------------------------------------------------------------------------

describe('createPlayer', () => {
  it('writes playerId to localStorage and transitions to identified on success', async () => {
    vi.spyOn(playerApi, 'createPlayer').mockResolvedValue(mockPlayer);
    // getPlayer is called by the effect after storedPlayerId changes.
    vi.spyOn(playerApi, 'getPlayer').mockResolvedValue(mockPlayer);

    const { result } = renderHook(() => usePlayerIdentity());

    await act(async () => {
      await result.current.createPlayer('Alice');
    });

    expect(result.current.status).toBe<PlayerIdentityStatus>('identified');
    expect(result.current.player).toEqual(mockPlayer);

    // playerId must be persisted in localStorage.
    const stored = JSON.parse(window.localStorage.getItem(PLAYER_ID_KEY) ?? 'null') as string | null;
    expect(stored).toBe(mockPlayer.playerId);
  });

  it('calls createPlayer API with the provided displayName', async () => {
    const spy = vi.spyOn(playerApi, 'createPlayer').mockResolvedValue(mockPlayer);
    vi.spyOn(playerApi, 'getPlayer').mockResolvedValue(mockPlayer);

    const { result } = renderHook(() => usePlayerIdentity());

    await act(async () => {
      await result.current.createPlayer('Bob');
    });

    expect(spy).toHaveBeenCalledWith('Bob');
  });

  it('propagates the error when createPlayer API call fails', async () => {
    vi.spyOn(playerApi, 'createPlayer').mockRejectedValue(
      new Error('Display name is required'),
    );

    const { result } = renderHook(() => usePlayerIdentity());

    await expect(
      act(async () => {
        await result.current.createPlayer('');
      }),
    ).rejects.toThrow('Display name is required');
  });
});

// ---------------------------------------------------------------------------
// isOptimistic semantics
// ---------------------------------------------------------------------------

describe('isOptimistic flag', () => {
  it('is false when there is no stored ID', () => {
    const { result } = renderHook(() => usePlayerIdentity());
    expect(result.current.isOptimistic).toBe(false);
  });

  it('is true while GET is in flight (loading state)', async () => {
    seedLocalStorage('player-uuid-abc');
    // Use a never-resolving promise to freeze the in-flight state.
    vi.spyOn(playerApi, 'getPlayer').mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePlayerIdentity());

    // Wait one tick so the effect fires and status transitions to 'loading'.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isOptimistic).toBe(true);
  });

  it('is false after successful identification', async () => {
    seedLocalStorage('player-uuid-abc');
    vi.spyOn(playerApi, 'getPlayer').mockResolvedValue(mockPlayer);

    const { result } = renderHook(() => usePlayerIdentity());

    await waitFor(() => {
      expect(result.current.status).toBe<PlayerIdentityStatus>('identified');
    });

    expect(result.current.isOptimistic).toBe(false);
  });
});
