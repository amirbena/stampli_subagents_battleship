import React, { useEffect, useState } from 'react';
import './FiringIndicator.css';

interface FiringIndicatorProps {
  /** True while a shot request is in flight. */
  active: boolean;
}

/**
 * Lightweight pending-shot indicator. Renders "Firing…" with an elapsed-second
 * counter while a shot is in flight, and renders nothing otherwise.
 *
 * The counter is UX feedback only — it is not a game rule or countdown. The
 * timer starts fresh each time `active` becomes true and is cleared when the
 * shot resolves (active → false), so it can never get stuck on screen.
 */
export function FiringIndicator({ active }: FiringIndicatorProps): React.ReactElement | null {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsedSeconds(0);
      return;
    }
    setElapsedSeconds(0);
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="firing-indicator" role="status" aria-live="polite">
      <span className="firing-indicator__spinner" aria-hidden="true" />
      <span>Firing…{elapsedSeconds > 0 ? ` ${elapsedSeconds}s` : ''}</span>
    </div>
  );
}
