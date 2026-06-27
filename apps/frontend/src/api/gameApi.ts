import axios, { type AxiosError } from 'axios';
import type {
  CreateGameResponse,
  JoinGameResponse,
  PlaceShipRequest,
  PlaceShipResponse,
  ConfirmReadyResponse,
  FireShotResponse,
  GameStateResponse,
  PauseResumeResponse,
  RestoreGameResponse,
  ShipType,
  Orientation,
  GameMode,
  CreateGameRequest,
  JoinGameRequest,
} from '../types/game';

/**
 * Sentinel error thrown when a game-scoped call resolves to 404 GAME_NOT_FOUND.
 *
 * Callers (useResumeGame) distinguish this from network/5xx failures so they can
 * clear the local active-game pointer only on an authoritative "game gone" response
 * (server restart or prior Stop — AC-13), never on a transient connectivity blip.
 * This mirrors the PlayerNotFoundError convention used by usePlayerIdentity.
 */
export class GameNotFoundError extends Error {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
    this.name = 'GameNotFoundError';
  }
}

/**
 * Sentinel error thrown when a belonging-gated action resolves to 403 NOT_AUTHORIZED.
 *
 * Per the session-identity contract (architecture §4.5) every authenticated action
 * (ships POST/DELETE, ready, fire, pause, resume, stop) now requires a valid
 * per-seat `X-Session-Token`. A bad/absent token returns 403 NOT_AUTHORIZED — the
 * caller's stored belonging is stale or never proved ownership. Callers treat this
 * as an authoritative "this browser does not own this seat" signal: quiet-clear the
 * belonging record (same disposition as GameNotFoundError), never as a transient blip.
 * Distinct from GameNotFoundError so the UI can branch if it ever needs to; both lead
 * to a clean Home.
 */
export class NotAuthorizedError extends Error {
  constructor(gameId: string) {
    super(`Not authorized for game: ${gameId}`);
    this.name = 'NotAuthorizedError';
  }
}

/** Header carrying the per-seat belonging secret on every gated request. */
const SESSION_TOKEN_HEADER = 'X-Session-Token';
/** Header carrying the caller's asserted seat id on the restore probe. */
const PLAYER_ID_HEADER = 'X-Player-Id';

/**
 * Builds the auth header object for a belonging-gated request. Centralised so every
 * gated call site sends the token identically and the header name lives in one place.
 * The token is a bearer secret — it travels only in this header, never in URL/query.
 */
function authHeaders(sessionToken: string): Record<string, string> {
  return { [SESSION_TOKEN_HEADER]: sessionToken };
}

/**
 * validateStatus that resolves 2xx AND 403 so the wrapper can throw a typed
 * NotAuthorizedError instead of the generic Error the global interceptor would
 * produce. 5xx/network still reject and surface as a plain Error (transient).
 */
const okOr403 = (status: number): boolean =>
  (status >= 200 && status < 300) || status === 403;

/**
 * Throws NotAuthorizedError when a resolved response carries 403 NOT_AUTHORIZED.
 * Used by every gated action wrapper that opts into okOr403 so a bad/absent token
 * becomes an authoritative, typed "you don't own this seat" signal for hooks.
 */
function throwIfNotAuthorized(response: { status: number }, gameId: string): void {
  if (response.status === 403) {
    throw new NotAuthorizedError(gameId);
  }
}

/**
 * Shared axios instance for all backend calls.
 * Base URL comes from the Vite env variable — falls back to localhost for local dev.
 * The /api/v1 prefix matches the global context-path set in application.yml.
 */
// Exported for tests only: lets the loader test drive real requests through the
// request/response interceptors using a per-request stub adapter. Production code
// must keep calling through the typed wrappers below, never this instance directly.
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Augment axios request config with a `silent` flag. When true the request is
 * excluded from the global in-flight loader counter — used for the 2s background
 * poll loop so it never flickers the loader (Decision D1). User-initiated calls
 * omit it. Module augmentation keeps it type-safe at every call site without casts.
 */
declare module 'axios' {
  interface AxiosRequestConfig {
    silent?: boolean;
  }
}

// --- Global HTTP loader store -------------------------------------------------
// Tracks in-flight user-initiated requests AND a "loader visible" boolean that
// stays true for 300 ms after the last request settles. The visible flag lives
// here (not in React state) so that useSyncExternalStore reads it at render time:
// even when a very fast localhost response arrives before React's first render,
// the flag is still true and GlobalLoader renders the bar correctly.

type LoaderListener = () => void;

let activeRequestCount = 0;
let loaderVisible = false;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<LoaderListener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Number of non-silent requests currently in flight. */
export function getActiveRequestCount(): number {
  return activeRequestCount;
}

/** Whether the global loader bar should be visible right now. */
export function isLoaderVisible(): boolean {
  return loaderVisible;
}

/** Subscribe to loader state changes. Returns an unsubscribe function. */
export function subscribeActiveRequests(listener: LoaderListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: reset the counter and listeners between cases. */
export function __resetLoaderStore(): void {
  activeRequestCount = 0;
  loaderVisible = false;
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  listeners.clear();
}

function increment(): void {
  activeRequestCount += 1;
  // Cancel any pending hide so back-to-back requests keep the bar visible.
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  loaderVisible = true;
  emit();
}

function decrement(): void {
  // Guard against ever going negative if a settle fires without a matching start.
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  if (activeRequestCount === 0) {
    // Keep the bar visible for 300 ms so fast requests are always perceivable.
    hideTimer = setTimeout(() => {
      loaderVisible = false;
      hideTimer = null;
      emit();
    }, 300);
  }
  emit();
}

/**
 * Request interceptor — counts every user-initiated request as in flight.
 * Requests tagged `{ silent: true }` (background polls) are skipped so the global
 * loader does not appear for the 2s poll loop (AC-4).
 *
 * `{ synchronous: true }` (Axios v1.x) makes this interceptor run synchronously
 * inside the caller's event loop turn — before the Promise chain. Without it,
 * React 18 automatic batching groups the increment() microtask with the
 * decrement() response microtask on fast local requests, so the loader counter
 * goes 0→1→0 inside a single render flush and GlobalLoader never appears.
 * With synchronous: true, increment() fires during the click handler's
 * synchronous frame, React sees count→1 before the network response arrives,
 * and GlobalLoader renders. The response interceptor is intentionally left async.
 */
api.interceptors.request.use(
  (config) => {
    if (!config.silent) increment();
    return config;
  },
  undefined,
  { synchronous: true },
);

/**
 * Response interceptor — normalises backend error shapes into plain Error instances
 * and ALWAYS settles the loader counter (success AND error) so it never sticks.
 * The backend returns { error: string } on 4xx/5xx; we surface that message directly
 * so callers can display `e.message` in the UI without parsing response bodies.
 */
api.interceptors.response.use(
  (response) => {
    if (!response.config.silent) decrement();
    return response;
  },
  (error: AxiosError<{ error?: string }>) => {
    // config may be undefined on request-setup failures; treat missing as non-silent.
    if (!error.config?.silent) decrement();
    const message =
      error.response?.data?.error ??
      error.message ??
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);

/**
 * Creates a new game room.
 * POST /games
 *
 * When playerId is supplied the backend links playerA to the existing Player
 * record and echoes the same UUID back in the response (OQ-3: same UUID end-to-end).
 * When playerId is omitted the backend generates a new anonymous UUID as before
 * (backward-compatible path — existing call sites need no changes).
 *
 * @param mode     HUMAN | COMPUTER (default COMPUTER when omitted)
 * @param playerId optional persistent player ID from localStorage
 * @returns gameId (6-char room code) and the creator's playerId
 */
export async function createGame(mode?: GameMode, playerId?: string): Promise<CreateGameResponse> {
  const params = mode ? { mode } : undefined;
  // Only include the request body when playerId is present — omitting the body
  // entirely preserves the existing no-body backward-compatible path.
  const body: CreateGameRequest | undefined = playerId ? { playerId } : undefined;
  const { data } = await api.post<CreateGameResponse>('/games', body, { params });
  return data;
}

/**
 * Joins an existing game room as the second player.
 * POST /games/:gameId/join
 *
 * When playerId is supplied the backend links playerB to the existing persistent
 * Player record; the joiner ALWAYS receives a brand-new DISTINCT identity + its own
 * per-seat `sessionToken` minted for this seat (PR #58) — it never inherits the
 * creator's identity or token. When omitted the backend generates an anonymous UUID.
 *
 * Every non-admit case — missing code, full room, already-started/non-WAITING game —
 * collapses to the SAME generic 404 GAME_NOT_FOUND on the backend (no seat/type/
 * existence leakage). We resolve that 404 to a thrown GameNotFoundError (mirroring
 * restoreGameByCode / getGameState) so the caller can show the existing inline
 * "not joinable" message and stay put (AC-6d) without parsing response bodies.
 * 5xx/network still reject as a plain Error via the global interceptor (transient).
 *
 * @param gameId   the room code received from the creator (this code IS the gameId)
 * @param playerId optional persistent player ID from localStorage
 * @returns { gameId, playerId, status, sessionToken } — the joiner's DISTINCT seat
 * @throws GameNotFoundError when the backend returns 404 GAME_NOT_FOUND (any not-joinable case)
 */
export async function joinGame(gameId: string, playerId?: string): Promise<JoinGameResponse> {
  const body: JoinGameRequest = { gameId, ...(playerId ? { playerId } : {}) };
  const response = await api.post<JoinGameResponse>(`/games/${gameId}/join`, body, {
    // Accept 404 as resolved so we can throw the typed sentinel below; 5xx/network
    // still reject and surface as a plain Error via the global response interceptor.
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
  });
  if (response.status === 404) {
    throw new GameNotFoundError(gameId);
  }
  return response.data;
}

/**
 * Places a single ship on the player's board during the PLACING_SHIPS phase.
 * POST /games/:gameId/players/:playerId/ships
 *
 * @param gameId       the game room
 * @param playerId     the placing player
 * @param ship         ship type, anchor coordinate, and orientation
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @param silent       when true, excluded from the global loader — placement is a
 *                     high-frequency in-game action that must feel instant (no loader flicker)
 * @returns the cells the ship now occupies
 * @throws Error 400 if placement is out of bounds or overlaps another ship
 * @throws Error 409 if the game is not in PLACING_SHIPS phase
 * @throws NotAuthorizedError 403 when the token is bad/absent for this seat
 */
export async function placeShip(
  gameId: string,
  playerId: string,
  ship: PlaceShipRequest,
  sessionToken: string,
  silent = false,
): Promise<PlaceShipResponse> {
  const response = await api.post<PlaceShipResponse>(
    `/games/${gameId}/players/${playerId}/ships`,
    ship,
    // `silent` is read by the request/response interceptors to skip loader counting.
    { silent, headers: authHeaders(sessionToken), validateStatus: okOr403 },
  );
  throwIfNotAuthorized(response, gameId);
  return response.data;
}

/**
 * Removes a previously placed ship so the player can reposition it.
 * DELETE /games/:gameId/players/:playerId/ships/:shipType
 *
 * @param gameId       the game room
 * @param playerId     the player making the request
 * @param shipType     the ship type to remove
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @param silent       when true, excluded from the global loader — removing/repositioning a
 *                     ship is a high-frequency in-game action that must feel instant
 * @throws Error 400 if the ship has not been placed
 * @throws NotAuthorizedError 403 when the token is bad/absent for this seat
 */
export async function removeShip(
  gameId: string,
  playerId: string,
  shipType: ShipType,
  sessionToken: string,
  silent = false,
): Promise<void> {
  // `silent` is read by the request/response interceptors to skip loader counting.
  const response = await api.delete(`/games/${gameId}/players/${playerId}/ships/${shipType}`, {
    silent,
    headers: authHeaders(sessionToken),
    validateStatus: okOr403,
  });
  throwIfNotAuthorized(response, gameId);
}

/**
 * Marks the player as ready. If both players are ready the game transitions to IN_PROGRESS.
 * POST /games/:gameId/players/:playerId/ready
 *
 * @param gameId       the game room
 * @param playerId     the player marking ready
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @returns updated game status and current turn player (populated once game starts)
 * @throws Error 400 if the player has not placed all 5 ships
 * @throws NotAuthorizedError 403 when the token is bad/absent for this seat
 */
export async function setReady(
  gameId: string,
  playerId: string,
  sessionToken: string,
): Promise<ConfirmReadyResponse> {
  const response = await api.post<ConfirmReadyResponse>(
    `/games/${gameId}/players/${playerId}/ready`,
    undefined,
    { headers: authHeaders(sessionToken), validateStatus: okOr403 },
  );
  throwIfNotAuthorized(response, gameId);
  return response.data;
}

/**
 * Fires a shot at the opponent's board.
 * POST /games/:gameId/players/:playerId/fire
 *
 * @param gameId   the game room
 * @param playerId the shooting player (must match the current turn)
 * @param row          target row (0–9)
 * @param col          target column (0–9)
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @param silent       when true, excluded from the global loader — firing is a
 *                     high-frequency in-game action that must feel instant (no loader flicker)
 * @returns shot result (HIT | MISS | SUNK), sunk ship type, next turn player, winner if game ended
 * @throws Error 409 if it is not this player's turn
 * @throws Error 400 if coordinate is out of bounds or already targeted
 * @throws NotAuthorizedError 403 when the token is bad/absent for this seat
 */
export async function fireShot(
  gameId: string,
  playerId: string,
  row: number,
  col: number,
  sessionToken: string,
  silent = false,
): Promise<FireShotResponse> {
  const response = await api.post<FireShotResponse>(
    `/games/${gameId}/players/${playerId}/fire`,
    { row, col },
    // `silent` is read by the request/response interceptors to skip loader counting.
    { silent, headers: authHeaders(sessionToken), validateStatus: okOr403 },
  );
  throwIfNotAuthorized(response, gameId);
  return response.data;
}

/**
 * Fetches the current game state for the requesting player.
 * GET /games/:gameId/state?playerId=
 *
 * The opponent board in the response contains only sunk ships.
 * Un-hit ship positions are intentionally absent — the backend never sends them.
 *
 * A 404 resolves to a thrown GameNotFoundError (not a generic Error) so the resume
 * flow can clear the stale active-game pointer (AC-13) while transient/5xx failures
 * still surface as plain Error and leave the pointer intact. Background polls that do
 * not need this distinction simply catch the thrown error as before.
 *
 * The `X-Session-Token` header now proves seat ownership: a non-owner (bad/absent
 * token) receives the SAME generic 404 GAME_NOT_FOUND as a missing game (architecture
 * §4.5 — the state probe must not confirm existence to a non-owner), which maps to
 * GameNotFoundError here and triggers the same stale-belonging clear path.
 *
 * @param gameId       the game room
 * @param playerId     determines which board is "mine" vs "opponent" in the response
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @param silent       when true, excluded from the global loader (background poll only)
 * @returns sanitised game state safe to render directly in the UI
 * @throws GameNotFoundError when the backend returns 404 GAME_NOT_FOUND (missing OR non-owner)
 */
export async function getGameState(
  gameId: string,
  playerId: string,
  sessionToken: string,
  silent = false,
): Promise<GameStateResponse> {
  const response = await api.get<GameStateResponse>(`/games/${gameId}/state`, {
    params: { playerId },
    headers: authHeaders(sessionToken),
    // `silent` is read by the request/response interceptors to skip loader counting.
    silent,
    // Accept 404 as resolved so we can throw the typed sentinel below; 5xx/network
    // still reject and surface as Error via the global response interceptor.
    validateStatus: (status) => status === 200 || status === 404,
  });
  if (response.status === 404) {
    throw new GameNotFoundError(gameId);
  }
  return response.data;
}

/**
 * Pauses the player's active game session.
 * POST /games/:gameId/players/:playerId/pause
 *
 * Pause is one-sided and non-destructive — the backend flips the game to PAUSED and
 * records the pre-pause phase so resume can restore it. The local active-game pointer
 * is intentionally NOT cleared on pause (the game remains resumable).
 *
 * @param gameId       the game room
 * @param playerId     the participant pausing (must be in the game)
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @returns { gameId, status: 'PAUSED', previousStatus } — no board data
 * @throws NotAuthorizedError 403 — bad/absent token for this seat
 * @throws GameNotFoundError 404 — game gone (caller may clear pointer)
 * @throws Error 409 WRONG_PHASE — already PAUSED or FINISHED
 */
export async function pauseGame(
  gameId: string,
  playerId: string,
  sessionToken: string,
): Promise<PauseResumeResponse> {
  const response = await api.post<PauseResumeResponse>(
    `/games/${gameId}/players/${playerId}/pause`,
    undefined,
    {
      headers: authHeaders(sessionToken),
      // Accept 403 (typed NotAuthorizedError) and 404 (typed GameNotFoundError) as
      // resolved so both become authoritative stale-belonging signals; 5xx/network reject.
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 403 || status === 404,
    },
  );
  throwIfNotAuthorized(response, gameId);
  if (response.status === 404) {
    throw new GameNotFoundError(gameId);
  }
  return response.data;
}

/**
 * Resumes a PAUSED game, flipping it back to its pre-pause phase.
 * POST /games/:gameId/players/:playerId/resume
 *
 * This is a write that only flips status; the player-scoped board is NOT returned here
 * (resume hydration comes from the subsequent GET /state — see useResumeGame).
 *
 * A 404 resolves to a thrown GameNotFoundError so the caller can clear the stale pointer
 * (AC-13) instead of treating it as a transient failure. Other 4xx/5xx surface as plain
 * Error via the global response interceptor.
 *
 * @param gameId       the game room
 * @param playerId     the participant resuming (must be in the game)
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 * @returns { gameId, status: restored prior phase, previousStatus: 'PAUSED' }
 * @throws GameNotFoundError when the backend returns 404 GAME_NOT_FOUND
 * @throws NotAuthorizedError 403 — bad/absent token for this seat
 * @throws Error 409 WRONG_PHASE — game is not PAUSED (e.g. FINISHED)
 */
export async function resumeGame(
  gameId: string,
  playerId: string,
  sessionToken: string,
): Promise<PauseResumeResponse> {
  const response = await api.post<PauseResumeResponse>(
    `/games/${gameId}/players/${playerId}/resume`,
    undefined,
    {
      headers: authHeaders(sessionToken),
      // Accept 403 (NotAuthorizedError) and 404 (GameNotFoundError) as resolved so we
      // can throw the typed sentinels below; 5xx/network still reject as plain Error.
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 403 || status === 404,
    },
  );
  throwIfNotAuthorized(response, gameId);
  if (response.status === 404) {
    throw new GameNotFoundError(gameId);
  }
  return response.data;
}

/**
 * Stops (terminates) the player's game session.
 * POST /games/:gameId/players/:playerId/stop
 *
 * The backend deletes the game and returns 204 No Content. Stop is idempotent: a game
 * that is already gone (404) is treated as success so "No/Stop never throws" (AC-7/AC-13).
 * Both 204 and an already-absent 404 resolve normally; only 403 and transient 5xx/network
 * errors reject. Returns void — there is no response body to map.
 *
 * A bad/absent token returns 403 NOT_AUTHORIZED. For Stop this is treated as an
 * idempotent success (resolve void): the desired outcome — a clean Home with the
 * stale belonging cleared — is identical whether the game was already gone (404) or
 * this browser cannot prove ownership (403). Stop must never surface a blocking error
 * to a user trying to leave (AC-13 clean-Home), so 403 resolves rather than throws.
 *
 * @param gameId       the game room
 * @param playerId     the participant stopping (must be in the game when it still exists)
 * @param sessionToken per-seat belonging secret (sent as X-Session-Token)
 */
export async function stopGame(
  gameId: string,
  playerId: string,
  sessionToken: string,
): Promise<void> {
  await api.post(`/games/${gameId}/players/${playerId}/stop`, undefined, {
    headers: authHeaders(sessionToken),
    // 204 = success; 404 = already gone; 403 = can't prove ownership — all three are
    // treated as a successful idempotent Stop (clean-Home outcome). 5xx/network reject.
    validateStatus: (status) =>
      (status >= 200 && status < 300) || status === 403 || status === 404,
  });
}

/**
 * Belonging-probe: confirms this browser still owns a resumable seat for a code.
 * GET /games/{code}/restore  (headers: X-Player-Id, X-Session-Token)
 *
 * Under the session-identity contract (architecture §4.3) restore NO LONGER discovers
 * an identity. The caller MUST already hold its own seat's `playerId` + `sessionToken`
 * (from the create/join mint, stored in the belonging pointer) and prove ownership via
 * the two headers. Restore now serves BOTH modes: it only ever echoes back the caller's
 * OWN seat pointer when `ownsSeat(playerId, token)` passes and the game is resumable.
 *
 * A missing code, terminal game, or any caller that cannot prove belonging (wrong/absent
 * token, non-owner) returns the SAME generic 404 GAME_NOT_FOUND — no identity, mode, or
 * seat state leaks. The 404 maps to the typed GameNotFoundError so the UI quiet-clears the
 * stale belonging and shows the friendly inline message (AC-2/AC-5/AC-8/AC-13). Restore
 * returns NO board data and NO sessionToken. 5xx/network surface as a plain Error.
 *
 * The code is encoded as a single path segment defensively — trimming is the UI's job.
 *
 * @param code         the room code entered by the user (already trimmed by the UI)
 * @param playerId     the caller's own seat id, asserted via X-Player-Id
 * @param sessionToken the caller's own per-seat secret, proven via X-Session-Token
 * @returns { gameId, playerId, gameMode, status } — the caller's own seat, no board data
 * @throws GameNotFoundError when the backend returns 404 GAME_NOT_FOUND (missing OR not-owned)
 */
export async function restoreGameByCode(
  code: string,
  playerId: string,
  sessionToken: string,
): Promise<RestoreGameResponse> {
  const response = await api.get<RestoreGameResponse>(
    `/games/${encodeURIComponent(code)}/restore`,
    {
      // Both belonging headers are REQUIRED by the backend; the token is a bearer
      // secret carried only in the header, never in the URL/query.
      headers: {
        [PLAYER_ID_HEADER]: playerId,
        [SESSION_TOKEN_HEADER]: sessionToken,
      },
      // Accept 404 as a resolved response so we can throw the typed sentinel below;
      // 5xx/network still reject and surface as a plain Error via the interceptor.
      validateStatus: (status) => status === 200 || status === 404,
    },
  );
  if (response.status === 404) {
    throw new GameNotFoundError(code);
  }
  return response.data;
}

export type { PlaceShipRequest, Orientation };
