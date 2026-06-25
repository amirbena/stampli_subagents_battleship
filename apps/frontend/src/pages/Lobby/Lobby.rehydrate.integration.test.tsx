import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GameStateResponse, ShipDto, Coordinate } from '../../types/game';
import { Lobby } from './Lobby';

/**
 * AC-11 seam test: on resume into PLACING_SHIPS, placement MUST rehydrate from the backend
 * `myBoard.ships` (via usePlacement.hydrate from GET /state), NOT from a stale
 * `placement_ships_<gameId>` sessionStorage blob. The bug lives in the ordering between
 * usePlacement's lazy sessionStorage init and the Lobby hydrate effect — per-layer unit tests
 * pass while the runtime still fails. This renders the REAL Lobby + REAL usePlacement and
 * controls the polled state via a mocked useGamePolling (the network boundary).
 */

const ACTIVE_GAME_KEY = 'battleship_active_game';
const GAME_ID = 'g-resume';

function cells(...rc: [number, number][]): Coordinate[] {
  return rc.map(([row, col]) => ({ row, col }));
}

// Backend truth: a CARRIER placed at row 0, cols 0–4.
const BACKEND_CARRIER: ShipDto = {
  shipType: 'CARRIER',
  cells: cells([0, 0], [0, 1], [0, 2], [0, 3], [0, 4]),
  hits: [],
  sunk: false,
};

function backendState(): GameStateResponse {
  return {
    gameId: GAME_ID,
    status: 'PLACING_SHIPS',
    currentTurnPlayerId: null,
    winnerId: null,
    myBoard: { ships: [BACKEND_CARRIER], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: false,
    opponentReady: false,
  };
}

// Mock only the network boundary: useGamePolling returns the server-truth state directly,
// and the API wrappers are inert. usePlacement stays REAL so the hydrate seam is exercised.
let polledState: GameStateResponse | null = null;
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({ gameState: polledState, isLoading: false, refresh: vi.fn() }),
}));

vi.mock('../../api/gameApi', () => ({
  placeShip: vi.fn(),
  removeShip: vi.fn(),
  setReady: vi.fn(),
  pauseGame: vi.fn(),
  stopGame: vi.fn(),
}));

describe('Lobby resume rehydration (AC-11)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    polledState = backendState();
    // Active-game pointer set (guard passed) — Lobby reads gameId/playerId from it.
    window.localStorage.setItem(
      ACTIVE_GAME_KEY,
      JSON.stringify({ gameId: GAME_ID, playerId: 'p-1', gameMode: 'HUMAN' }),
    );
  });

  it('hydrates placement from backend ships, overriding a STALE sessionStorage blob', () => {
    // STALE scratch: a DESTROYER from a previous session that no longer reflects the backend.
    const staleDestroyer: ShipDto = {
      shipType: 'DESTROYER',
      cells: cells([9, 8], [9, 9]),
      hits: [],
      sunk: false,
    };
    window.sessionStorage.setItem(
      `placement_ships_${GAME_ID}`,
      JSON.stringify([staleDestroyer]),
    );

    render(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>,
    );

    // Backend CARRIER is now the placed ship → its Remove control is present.
    expect(screen.getByRole('button', { name: /remove carrier/i })).toBeInTheDocument();
    // The stale DESTROYER must NOT be treated as placed — backend truth won.
    expect(screen.queryByRole('button', { name: /remove destroyer/i })).not.toBeInTheDocument();
  });

  it('hydrates from backend ships even when sessionStorage is empty', () => {
    render(
      <MemoryRouter>
        <Lobby />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /remove carrier/i })).toBeInTheDocument();
  });
});
