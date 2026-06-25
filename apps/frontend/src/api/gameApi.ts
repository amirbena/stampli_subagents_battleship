import axios, { type AxiosError } from 'axios';
import type {
  CreateGameResponse,
  JoinGameResponse,
  PlaceShipRequest,
  PlaceShipResponse,
  ConfirmReadyResponse,
  FireShotResponse,
  GameStateResponse,
  ShipType,
  Orientation,
  GameMode,
  CreateGameRequest,
  JoinGameRequest,
} from '../types/game';

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
 * When playerId is supplied the backend links playerB to the existing Player
 * record (AC-13). When omitted the backend generates an anonymous UUID as today.
 *
 * @param gameId   the 6-char room code received from the creator
 * @param playerId optional persistent player ID from localStorage
 * @returns the joiner's playerId
 * @throws Error 409 if the room is full or already in progress
 */
export async function joinGame(gameId: string, playerId?: string): Promise<JoinGameResponse> {
  const body: JoinGameRequest = { gameId, ...(playerId ? { playerId } : {}) };
  const { data } = await api.post<JoinGameResponse>(`/games/${gameId}/join`, body);
  return data;
}

/**
 * Places a single ship on the player's board during the PLACING_SHIPS phase.
 * POST /games/:gameId/players/:playerId/ships
 *
 * @param gameId   the game room
 * @param playerId the placing player
 * @param ship     ship type, anchor coordinate, and orientation
 * @returns the cells the ship now occupies
 * @throws Error 400 if placement is out of bounds or overlaps another ship
 * @throws Error 409 if the game is not in PLACING_SHIPS phase
 */
export async function placeShip(
  gameId: string,
  playerId: string,
  ship: PlaceShipRequest,
): Promise<PlaceShipResponse> {
  const { data } = await api.post<PlaceShipResponse>(
    `/games/${gameId}/players/${playerId}/ships`,
    ship,
  );
  return data;
}

/**
 * Removes a previously placed ship so the player can reposition it.
 * DELETE /games/:gameId/players/:playerId/ships/:shipType
 *
 * @param gameId   the game room
 * @param playerId the player making the request
 * @param shipType the ship type to remove
 * @throws Error 400 if the ship has not been placed
 */
export async function removeShip(
  gameId: string,
  playerId: string,
  shipType: ShipType,
): Promise<void> {
  await api.delete(`/games/${gameId}/players/${playerId}/ships/${shipType}`);
}

/**
 * Marks the player as ready. If both players are ready the game transitions to IN_PROGRESS.
 * POST /games/:gameId/players/:playerId/ready
 *
 * @returns updated game status and current turn player (populated once game starts)
 * @throws Error 400 if the player has not placed all 5 ships
 */
export async function setReady(gameId: string, playerId: string): Promise<ConfirmReadyResponse> {
  const { data } = await api.post<ConfirmReadyResponse>(
    `/games/${gameId}/players/${playerId}/ready`,
  );
  return data;
}

/**
 * Fires a shot at the opponent's board.
 * POST /games/:gameId/players/:playerId/fire
 *
 * @param gameId   the game room
 * @param playerId the shooting player (must match the current turn)
 * @param row      target row (0–9)
 * @param col      target column (0–9)
 * @returns shot result (HIT | MISS | SUNK), sunk ship type, next turn player, winner if game ended
 * @throws Error 409 if it is not this player's turn
 * @throws Error 400 if coordinate is out of bounds or already targeted
 */
export async function fireShot(
  gameId: string,
  playerId: string,
  row: number,
  col: number,
): Promise<FireShotResponse> {
  const { data } = await api.post<FireShotResponse>(
    `/games/${gameId}/players/${playerId}/fire`,
    { row, col },
  );
  return data;
}

/**
 * Fetches the current game state for the requesting player.
 * GET /games/:gameId/state?playerId=
 *
 * The opponent board in the response contains only sunk ships.
 * Un-hit ship positions are intentionally absent — the backend never sends them.
 *
 * @param gameId   the game room
 * @param playerId determines which board is "mine" vs "opponent" in the response
 * @param silent   when true, excluded from the global loader (background poll only)
 * @returns sanitised game state safe to render directly in the UI
 */
export async function getGameState(
  gameId: string,
  playerId: string,
  silent = false,
): Promise<GameStateResponse> {
  const { data } = await api.get<GameStateResponse>(`/games/${gameId}/state`, {
    params: { playerId },
    // `silent` is read by the request/response interceptors to skip loader counting.
    silent,
  });
  return data;
}

export type { PlaceShipRequest, Orientation };
