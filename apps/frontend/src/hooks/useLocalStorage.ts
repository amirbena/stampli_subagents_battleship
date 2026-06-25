import { useState } from 'react';

/**
 * useState-compatible hook that persists its value in `localStorage`.
 *
 * Used for cross-session persistence — values survive tab closes and browser
 * restarts, unlike sessionStorage. The primary consumer is `usePlayerIdentity`,
 * which stores `battleship_player_id` here so returning visitors resume their
 * identity without re-entering a display name.
 *
 * Falls back gracefully if localStorage is unavailable (Safari private browsing,
 * restricted origin, etc.) by behaving like a plain useState — the identity
 * resolution then always starts from "needs-name", matching the sessionStorage
 * fallback contract in useSessionStorage.
 *
 * To clear an entry, call setValue(null) — the key is removed from storage
 * rather than storing the string "null", so a subsequent read returns initialValue.
 *
 * @param key          localStorage key
 * @param initialValue value to use if nothing is stored yet
 * @returns [storedValue, setValue] — same signature as useState
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      if (value === null || value === undefined) {
        // Remove the key entirely so the next read returns initialValue, not "null".
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // localStorage write/remove failed (quota exceeded, access denied in private browsing)
      // — continue with in-memory state only, matching useSessionStorage's fallback contract.
    }
    setStoredValue(value);
  };

  return [storedValue, setValue];
}
