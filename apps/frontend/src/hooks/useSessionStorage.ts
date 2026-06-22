import { useState } from 'react';

/**
 * useState-compatible hook that persists its value in `sessionStorage`.
 *
 * Used to survive page refreshes within the same browser tab (e.g. keeping
 * gameId and playerId alive after an accidental reload). Values are lost
 * when the tab is closed, which is intentional — games are in-memory on
 * the backend and don't survive server restarts either.
 *
 * Falls back gracefully if sessionStorage is unavailable (private browsing
 * restrictions, SSR, etc.) by behaving like a plain useState.
 *
 * @param key          sessionStorage key
 * @param initialValue value to use if nothing is stored yet
 * @returns [storedValue, setValue] — same signature as useState
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // sessionStorage write failed (quota exceeded or access denied) — continue with in-memory state
    }
    setStoredValue(value);
  };

  return [storedValue, setValue];
}
