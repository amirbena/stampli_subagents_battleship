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
} from '../types/game';

/**
 * Shared axios instance for all backend calls.
 * Base URL comes from the Vite env variable — falls back to localhost for local dev.
 * The /api/v1 prefix matches the global context-path set in application.yml.
 */
const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Response interceptor — normalises backend error shapes into plain Error instances.
 * The backend returns { error: string } on 4xx/5xx; we surface that message directly
 * so callers can display `e.message` in the UI without parsing response bodies.
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
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
 * @returns gameId (6-char room code) and the creator's playerId
 */
export async function createGame(): Promise<CreateGameResponse> {
  const { data } = await api.post<CreateGameResponse>('/games');
  return data;
}

/**
 * Joins an existing game room as the second player.
 * POST /games/:gameId/join
 *
 * @param gameId the 6-char room code received from the creator
 * @returns the joiner's playerId
 * @throws Error 409 if the room is full or already in progress
 */
export async function joinGame(gameId: string): Promise<JoinGameResponse> {
  const { data } = await api.post<JoinGameResponse>(`/games/${gameId}/join`, { gameId });
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
 * @returns sanitised game state safe to render directly in the UI
 */
export async function getGameState(
  gameId: string,
  playerId: string,
): Promise<GameStateResponse> {
  const { data } = await api.get<GameStateResponse>(`/games/${gameId}/state`, {
    params: { playerId },
  });
  return data;
}

export type { PlaceShipRequest, Orientation };
