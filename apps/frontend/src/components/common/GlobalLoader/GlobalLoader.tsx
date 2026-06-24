import React, { useState, useEffect } from 'react';
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
 *
 * Minimum display time: even if a request completes very quickly (e.g. 20ms on
 * localhost), the bar stays visible for at least 300ms so users can perceive it.
 * When activeRequests > 0, the bar shows immediately. When it drops back to 0,
 * hiding is deferred by 300ms. If a new request starts before the timer fires,
 * the timer is cancelled and the bar stays visible without interruption.
 */
export function GlobalLoader(): React.ReactElement | null {
  const activeRequests = useActiveRequests();
  // `visible` lags behind activeRequests by up to 300ms on the trailing edge so the
  // bar never flashes too briefly for the user to perceive.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeRequests > 0) {
      // Show immediately when any request is in flight.
      setVisible(true);
      return;
    }
    // Delay hiding so fast requests (e.g. <20ms on localhost) still display the bar
    // long enough for the user to notice. If another request arrives before the
    // timer fires, the cleanup callback cancels it and we stay visible.
    const timer = setTimeout(() => setVisible(false), 300);
    return () => clearTimeout(timer);
  }, [activeRequests]);

  if (!visible) return null;

  return (
    <div className="global-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="global-loader__bar" />
    </div>
  );
}
