import type { CreatePlayerRequest, PlayerResponse } from '../types/game';
import { api } from './gameApi';

/**
 * Sentinel error thrown when GET /players/{playerId} returns 404.
 * Callers (usePlayerIdentity) distinguish this from network/5xx failures
 * so they can clear localStorage only on authoritative "not found" responses,
 * not on transient connectivity failures.
 */
export class PlayerNotFoundError extends Error {
  constructor(playerId: string) {
    super(`Player not found: ${playerId}`);
    this.name = 'PlayerNotFoundError';
  }
}

/**
 * Creates a new persistent guest player profile.
 * POST /players
 *
 * @param displayName trimmed display name (1–30 chars, [A-Za-z0-9 _-])
 * @returns the created PlayerResponse ({ playerId, displayName, createdAt })
 * @throws Error 400 when validation fails (DISPLAY_NAME_REQUIRED | DISPLAY_NAME_TOO_LONG | DISPLAY_NAME_INVALID_CHARS)
 */
export async function createPlayer(displayName: string): Promise<PlayerResponse> {
  const body: CreatePlayerRequest = { displayName };
  const { data } = await api.post<PlayerResponse>('/players', body);
  return data;
}

/**
 * Fetches an existing player profile by ID.
 * GET /players/{playerId}
 *
 * Uses validateStatus to accept 404 as a resolved response so the caller can
 * distinguish "player deleted / server restarted" (404 → clear localStorage)
 * from a network error (thrown Error → keep localStorage, show transient error).
 * The global loader interceptor still counts this as a user-initiated request
 * because validateStatus does not bypass the request/response interceptors.
 *
 * @param playerId the UUID stored in localStorage['battleship_player_id']
 * @returns PlayerResponse on success
 * @throws PlayerNotFoundError when the backend returns 404
 * @throws Error on network failure or 5xx
 */
export async function getPlayer(playerId: string): Promise<PlayerResponse> {
  const response = await api.get<PlayerResponse>(`/players/${playerId}`, {
    // Accept both 200 and 404 as resolved so we can inspect the status.
    // 5xx and network errors still reject and surface as Error via the interceptor.
    validateStatus: (status) => status === 200 || status === 404,
  });
  if (response.status === 404) {
    throw new PlayerNotFoundError(playerId);
  }
  return response.data;
}
