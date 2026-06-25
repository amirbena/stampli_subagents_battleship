import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLocalStorage', () => {
  // ── read / write ─────────────────────────────────────────────────────────

  it('returns initialValue when the key is not in storage', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('test-key', null));
    expect(result.current[0]).toBeNull();
  });

  it('reads a previously stored value on mount', () => {
    window.localStorage.setItem('test-key', JSON.stringify('hello'));
    const { result } = renderHook(() => useLocalStorage<string>('test-key', 'default'));
    expect(result.current[0]).toBe('hello');
  });

  it('setValue writes the value to localStorage and updates state', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('test-key', null));

    act(() => result.current[1]('new-value'));

    expect(result.current[0]).toBe('new-value');
    expect(window.localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });

  it('setValue works with non-string types (object)', () => {
    const { result } = renderHook(() =>
      useLocalStorage<{ id: number }>('obj-key', { id: 0 }),
    );

    act(() => result.current[1]({ id: 42 }));

    expect(result.current[0]).toEqual({ id: 42 });
    const raw = window.localStorage.getItem('obj-key');
    expect(JSON.parse(raw!)).toEqual({ id: 42 });
  });

  // ── clear (null) ─────────────────────────────────────────────────────────

  it('setValue(null) removes the key from localStorage', () => {
    window.localStorage.setItem('test-key', JSON.stringify('existing'));
    const { result } = renderHook(() => useLocalStorage<string | null>('test-key', null));

    act(() => result.current[1](null));

    expect(result.current[0]).toBeNull();
    // Key must be absent — not stored as the string "null".
    expect(window.localStorage.getItem('test-key')).toBeNull();
  });

  it('a subsequent read after clear returns initialValue', () => {
    window.localStorage.setItem('test-key', JSON.stringify('value'));

    const { result: r1 } = renderHook(() =>
      useLocalStorage<string | null>('test-key', null),
    );
    act(() => r1.current[1](null));

    // Mount a fresh hook instance — simulates a page reload after the clear.
    const { result: r2 } = renderHook(() =>
      useLocalStorage<string | null>('test-key', null),
    );
    expect(r2.current[0]).toBeNull();
  });

  // ── private-browsing fallback ─────────────────────────────────────────────

  it('falls back to in-memory state when localStorage.getItem throws (private mode)', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError: access denied');
    });

    const { result } = renderHook(() =>
      useLocalStorage<string>('test-key', 'fallback'),
    );
    // Must return initialValue without throwing.
    expect(result.current[0]).toBe('fallback');
  });

  it('falls back silently when localStorage.setItem throws (private mode write)', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('SecurityError: access denied');
    });

    const { result } = renderHook(() =>
      useLocalStorage<string | null>('test-key', null),
    );

    // setValue must not throw and must update in-memory state.
    expect(() => {
      act(() => result.current[1]('value'));
    }).not.toThrow();

    expect(result.current[0]).toBe('value');
  });

  it('falls back silently when localStorage.removeItem throws (private mode clear)', () => {
    vi.spyOn(window.localStorage, 'removeItem').mockImplementationOnce(() => {
      throw new Error('SecurityError: access denied');
    });

    window.localStorage.setItem('test-key', JSON.stringify('value'));
    const { result } = renderHook(() =>
      useLocalStorage<string | null>('test-key', null),
    );

    expect(() => {
      act(() => result.current[1](null));
    }).not.toThrow();

    expect(result.current[0]).toBeNull();
  });
});
