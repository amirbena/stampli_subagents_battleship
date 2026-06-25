import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useActiveGame } from '../../../hooks/useActiveGame';

/**
 * Route guard for the internal game routes (`/lobby`, `/game`, `/game-over`).
 *
 * Reads the SAME single-source-of-truth active-game pointer that the Home resume
 * modal reads (`useActiveGame`). This shared read is what prevents the
 * guard-vs-resume redirect loop / blocked-resume class of bug (spec Product Risk #1):
 *
 *   - pointer non-null  ⇒ a valid in-app session exists ⇒ render the route (<Outlet/>).
 *                          Actual backend liveness is confirmed later by GET /state;
 *                          a stale (404) game clears the pointer downstream and a
 *                          subsequent navigation naturally falls back to Home.
 *   - pointer null      ⇒ no active session ⇒ redirect to Home (<Navigate to="/" replace/>).
 *
 * Home (`/`) is intentionally NOT wrapped by this guard, so the guard only ever
 * redirects *into* Home, never out of it — no redirect loop is possible (AC-3, AC-4).
 */
export function RequireActiveSession(): React.ReactElement {
  const { pointer } = useActiveGame();

  if (pointer === null) {
    // Deep-link / bare refresh with no valid in-app session → Home is the only door (AC-3, AC-4).
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
