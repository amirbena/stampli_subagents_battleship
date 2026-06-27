import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveGame } from './useActiveGame';
import type { ActiveGamePointer } from '../types/game';

const ACTIVE_GAME_KEY = 'battleship_active_game';
const PLAYER_ID_KEY = 'battleship_player_id';

const pointer: ActiveGamePointer = {
  gameId: 'g-123',
  playerId: 'p-1',
  gameMode: 'HUMAN',
  sessionToken: 'seat-token-abc',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('useActiveGame initial read', () => {
  it('returns null when no pointer is stored', () => {
    const { result } = renderHook(() => useActiveGame());
    expect(result.current.pointer).toBeNull();
  });

  it('hydrates the pointer from localStorage on mount', () => {
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(pointer));
    const { result } = renderHook(() => useActiveGame());
    expect(result.current.pointer).toEqual(pointer);
  });
});

describe('setPointer', () => {
  it('persists the pointer to localStorage and exposes it', () => {
    const { result } = renderHook(() => useActiveGame());

    act(() => {
      result.current.setPointer(pointer);
    });

    expect(result.current.pointer).toEqual(pointer);
    const stored = JSON.parse(window.localStorage.getItem(ACTIVE_GAME_KEY) ?? 'null');
    expect(stored).toEqual(pointer);
    // The minted per-seat belonging secret must persist in the pointer (eligibility step 1).
    expect(stored.sessionToken).toBe('seat-token-abc');
  });
});

describe('clear', () => {
  it('removes the pointer key and returns to null', () => {
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(pointer));
    const { result } = renderHook(() => useActiveGame());

    act(() => {
      result.current.clear();
    });

    expect(result.current.pointer).toBeNull();
    // Key is removed entirely (not the string "null").
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-10: the active-game pointer must never touch battleship_player_id.
// ---------------------------------------------------------------------------

describe('does not touch identity key (AC-10)', () => {
  it('setPointer leaves battleship_player_id untouched', () => {
    window.localStorage.setItem(PLAYER_ID_KEY, JSON.stringify('identity-uuid'));
    const { result } = renderHook(() => useActiveGame());

    act(() => {
      result.current.setPointer(pointer);
    });

    expect(JSON.parse(window.localStorage.getItem(PLAYER_ID_KEY) ?? 'null')).toBe('identity-uuid');
  });

  it('clear leaves battleship_player_id untouched', () => {
    window.localStorage.setItem(PLAYER_ID_KEY, JSON.stringify('identity-uuid'));
    window.localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(pointer));
    const { result } = renderHook(() => useActiveGame());

    act(() => {
      result.current.clear();
    });

    // Identity survives an active-game clear (Stop/No must not log the user out).
    expect(JSON.parse(window.localStorage.getItem(PLAYER_ID_KEY) ?? 'null')).toBe('identity-uuid');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
