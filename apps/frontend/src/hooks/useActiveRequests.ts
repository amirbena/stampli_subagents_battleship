import { useSyncExternalStore } from 'react';
import { getActiveRequestCount, subscribeActiveRequests } from '../api/gameApi';

/**
 * Subscribes to the number of user-initiated HTTP requests currently in flight,
 * as tracked by the shared axios instance in gameApi.ts.
 *
 * Background poll requests (tagged `silent`) are excluded at the interceptor level,
 * so they never increment this count — the global loader stays calm during polling.
 *
 * Uses useSyncExternalStore so React stays in sync with the external counter without
 * any extra state-management dependency. Cleans up its subscription automatically.
 *
 * @returns the current in-flight count (0 = idle)
 */
export function useActiveRequests(): number {
  return useSyncExternalStore(subscribeActiveRequests, getActiveRequestCount);
}
