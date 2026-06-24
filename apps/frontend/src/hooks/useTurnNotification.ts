import { useEffect, useRef, useState } from 'react';
import type { GameStatus } from '../types/game';

const AUTO_DISMISS_MS = 2500;

/**
 * Signals when a "Your turn!" notification should be shown.
 *
 * Returns true ONLY on the edge transition from "not my turn" → "my turn", and
 * auto-dismisses after a short delay. It deliberately does NOT re-trigger while
 * it stays the player's turn (so repeated polls don't re-fire it), and it is
 * suppressed entirely once the game is FINISHED.
 *
 * The previous-turn value is tracked in a ref so the transition is detected
 * across the 2-second polling re-renders without firing on every poll.
 *
 * @param isMyTurn whether it is currently the player's turn (from backend state)
 * @param status   current game status (notification is suppressed when FINISHED)
 * @returns whether the "Your turn!" notification should currently be visible
 */
export function useTurnNotification(
  isMyTurn: boolean,
  status: GameStatus | undefined,
): boolean {
  const prevIsMyTurnRef = useRef<boolean>(isMyTurn);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prev = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;

    // Never announce a turn once the game is over.
    if (status === 'FINISHED') {
      setVisible(false);
      return;
    }

    // Only the rising edge (opponent/computer turn → my turn) triggers the toast.
    if (!prev && isMyTurn) {
      setVisible(true);
    }
  }, [isMyTurn, status]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return visible;
}
