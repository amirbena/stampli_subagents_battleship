import React, { useSyncExternalStore } from 'react';
import { subscribeActiveRequests, isLoaderVisible } from '../../../api/gameApi';
import './GlobalLoader.css';

/**
 * Global, non-blocking HTTP loader. Visible whenever at least one user-initiated
 * request is in flight and for 300 ms after the last one settles (so fast requests
 * are always perceivable). Background polls tagged `silent` are excluded.
 *
 * Visibility is derived directly from the loader store via useSyncExternalStore —
 * no local useState or useEffect. This avoids a timing race where a sub-millisecond
 * localhost response could decrement the counter before React's effect ever ran,
 * causing setVisible(true) to be skipped entirely.
 */
export function GlobalLoader(): React.ReactElement | null {
  const visible = useSyncExternalStore(subscribeActiveRequests, isLoaderVisible);
  if (!visible) return null;

  return (
    <div className="global-loader" role="status" aria-live="polite" aria-label="Loading">
      <div className="global-loader__bar" />
    </div>
  );
}
