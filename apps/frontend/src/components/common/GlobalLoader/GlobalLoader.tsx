import React from 'react';
import { useActiveRequests } from '../../../hooks/useActiveRequests';
import './GlobalLoader.css';

/**
 * Global, non-blocking HTTP loader. Visible whenever at least one user-initiated
 * request is in flight (create/join/place/remove/ready/fire/initial-load/refresh),
 * and stays visible until the LAST overlapping request settles (AC-5). It clears on
 * both success and error because the counter is decremented in both interceptor
 * branches (AC-2/AC-3).
 *
 * Background polls are excluded (AC-4) and the indicator is a fixed top bar that does
 * not cover or freeze the board (AC-6) — pointer-events are disabled so gameplay
 * underneath remains interactive.
 */
export function GlobalLoader(): React.ReactElement | null {
  const activeRequests = useActiveRequests();
  if (activeRequests === 0) return null;

  return (
    <div className="global-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="global-loader__bar" />
    </div>
  );
}
