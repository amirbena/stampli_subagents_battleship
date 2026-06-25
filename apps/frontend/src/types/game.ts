export type ShipType = 'CARRIER' | 'BATTLESHIP' | 'CRUISER' | 'SUBMARINE' | 'DESTROYER';
export type Orientation = 'HORIZONTAL' | 'VERTICAL';
export type GameMode = 'HUMAN' | 'COMPUTER';
export type ShotResult = 'MISS' | 'HIT' | 'SUNK';
export type GameStatus =
  | 'WAITING_FOR_PLAYERS'
  | 'PLACING_SHIPS'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'FINISHED';

export interface Coordinate {
  row: number;
  col: number;
}

export interface ShipDto {
  shipType: ShipType;
  cells: Coordinate[];
  hits: Coordinate[];
  sunk: boolean;
}

export interface BoardStateDto {
  ships: ShipDto[];
  missedShots: Coordinate[];
  // Requester's own non-sunk HIT cells on the opponent board (green markers).
  // Sourced from authoritative shot history — never from un-hit ship cells.
  // Always present (empty array when none) so callers can iterate safely.
  hits: Coordinate[];
}

export interface ComputerShotDto {
  row: number;
  col: number;
  result: ShotResult;
  sunkShipType: ShipType | null;
  winnerId: string | null;
  gameStatus: string;
}

export interface GameStateResponse {
  gameId: string;
  status: GameStatus;
  currentTurnPlayerId: string | null;
  winnerId: string | null;
  myBoard: BoardStateDto;
  opponentBoard: BoardStateDto;
  myReady: boolean;
  opponentReady: boolean;
  gameMode?: GameMode;
}

export interface CreateGameResponse {
  gameId: string;
  playerId: string;
  status: GameStatus;
  gameMode?: GameMode;
}

export interface JoinGameResponse {
  gameId: string;
  playerId: string;
  status: GameStatus;
}

/**
 * Response body for GET /games/{code}/restore — restore a computer game by code.
 * Resolves the human player (playerA) for an existing COMPUTER game so a fresh
 * browser (no stored playerId) can rehydrate its session pointer and then re-poll
 * GET /games/{gameId}/state. A missing, released, or non-computer code returns
 * 404 GAME_NOT_FOUND (mapped to GameNotFoundError by the api wrapper). Restore
 * returns NO board data — board rendering stays on the hidden-data-safe state call.
 */
export interface RestoreGameResponse {
  gameId: string;
  playerId: string;
  gameMode: GameMode;
  status: GameStatus;
}

export interface PlaceShipRequest {
  shipType: ShipType;
  row: number;
  col: number;
  orientation: Orientation;
}

export interface PlaceShipResponse {
  shipType: ShipType;
  cells: Coordinate[];
}

export interface ConfirmReadyResponse {
  gameId: string;
  playerId: string;
  status: GameStatus;
  message: string;
}

export interface FireShotRequest {
  row: number;
  col: number;
}

export interface FireShotResponse {
  row: number;
  col: number;
  result: ShotResult;
  sunkShipType: ShipType | null;
  nextTurnPlayerId: string | null;
  gameStatus: GameStatus;
  winnerId: string | null;
  computerShot: ComputerShotDto | null;
}

export interface ApiError {
  error: string;
  code: string;
}

// --- Pause / Resume / Stop game-session lifecycle ---

/**
 * Active-game pointer persisted in localStorage under `battleship_active_game`.
 * Single source of truth read by both the route guard and the Home resume modal.
 * Distinct from `battleship_player_id` (persistent identity) — never collides with it.
 */
export interface ActiveGamePointer {
  gameId: string;
  playerId: string;
  gameMode: GameMode;
}

/** Response body for POST .../pause and POST .../resume. (Stop returns 204 No Content.) */
export interface PauseResumeResponse {
  gameId: string;
  status: GameStatus;
  previousStatus: GameStatus;
}

// --- Player identity (Guest & Persistent Player Identity feature) ---

/** Persistent guest player profile returned by POST /players and GET /players/{id}. */
export interface Player {
  playerId: string;
  displayName: string;
  createdAt: string; // ISO-8601 instant
}

/** Request body for POST /players. */
export interface CreatePlayerRequest {
  displayName: string;
}

/** Response from POST /players and GET /players/{playerId}. */
export type PlayerResponse = Player;

/** Optional body for POST /games. Omit entirely for the anonymous/backward-compatible path. */
export interface CreateGameRequest {
  playerId?: string;
}

/** Body for POST /games/{gameId}/join. playerId is optional (anonymous path when omitted). */
export interface JoinGameRequest {
  gameId: string;
  playerId?: string;
}

export const SHIP_SIZES: Record<ShipType, number> = {
  CARRIER: 5,
  BATTLESHIP: 4,
  CRUISER: 3,
  SUBMARINE: 3,
  DESTROYER: 2,
};

export const SHIP_DISPLAY_NAMES: Record<ShipType, string> = {
  CARRIER: 'Carrier',
  BATTLESHIP: 'Battleship',
  CRUISER: 'Cruiser',
  SUBMARINE: 'Submarine',
  DESTROYER: 'Destroyer',
};

export const ALL_SHIP_TYPES: ShipType[] = [
  'CARRIER',
  'BATTLESHIP',
  'CRUISER',
  'SUBMARINE',
  'DESTROYER',
];

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk' | 'preview' | 'preview-invalid' | 'pending';
