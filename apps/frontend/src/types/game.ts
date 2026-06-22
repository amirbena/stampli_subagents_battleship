export type ShipType = 'CARRIER' | 'BATTLESHIP' | 'CRUISER' | 'SUBMARINE' | 'DESTROYER';
export type Orientation = 'HORIZONTAL' | 'VERTICAL';
export type ShotResult = 'MISS' | 'HIT' | 'SUNK';
export type GameStatus =
  | 'WAITING_FOR_PLAYERS'
  | 'PLACING_SHIPS'
  | 'IN_PROGRESS'
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
}

export interface CreateGameResponse {
  gameId: string;
  playerId: string;
  status: GameStatus;
}

export interface JoinGameResponse {
  gameId: string;
  playerId: string;
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
}

export interface ApiError {
  error: string;
  code: string;
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

export type CellState = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk' | 'preview' | 'preview-invalid';
