/**
 * Integration tests for Lobby one-time placement hydration AND sessionStorage fast-path init.
 *
 * These render the REAL Lobby page wired to the REAL usePlacement hook — no mocks on the
 * internal frontend layers. Only the network/server boundary is mocked: useGamePolling
 * (the 2s poll) and gameApi (HTTP calls). This is the seam unit tests cannot exercise:
 *
 * 1. Hydration seam: the once-only hydration guard lives in Lobby, the placement state
 *    lives in the hook, and the trigger is the polling result arriving across re-renders.
 *    A bug here (re-hydrating on a later poll and clobbering an optimistic placement, or
 *    never hydrating on first ships) only surfaces when hook + page + polling run together.
 *
 * 2. sessionStorage fast-path seam: usePlacement(gameId) reads from sessionStorage lazily
 *    on mount. If the key is pre-populated (after a page refresh), the fleet panel must be
 *    populated on the FIRST render — before any poll tick. A unit test cannot catch this
 *    because it mocks usePlacement entirely and never exercises the lazy initializer.
 *
 * 3. IN_PROGRESS cleanup seam: Lobby removes placement_ships_<gameId> from sessionStorage
 *    before navigating to /game. Verified here with the real hook so we confirm the key
 *    the hook wrote is the same key the cleanup removes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Lobby } from './Lobby';
import type { GameStateResponse, ShipDto, ShipType, Coordinate } from '../../types/game';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// The polling boundary: tests mutate `currentGameState` then rerender to simulate a poll tick.
let currentGameState: GameStateResponse | null = null;
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({ gameState: currentGameState, isLoading: false }),
}));

// Network boundary: placeShip resolves so optimistic placement is not rolled back.
vi.mock('../../api/gameApi', () => ({
  placeShip: vi.fn().mockResolvedValue({ shipType: 'DESTROYER', cells: [] }),
  removeShip: vi.fn().mockResolvedValue(undefined),
  setReady: vi.fn().mockResolvedValue(undefined),
  pauseGame: vi.fn(),
  stopGame: vi.fn(),
}));

function ship(shipType: ShipType, cells: Coordinate[]): ShipDto {
  return { shipType, cells, hits: [], sunk: false };
}

// A full persisted fleet as the backend would return it after a refresh.
const PERSISTED_FLEET: ShipDto[] = [
  ship('CARRIER', [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 0, col: 4 }]),
  ship('BATTLESHIP', [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 }]),
  ship('CRUISER', [{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]),
  ship('SUBMARINE', [{ row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }]),
  ship('DESTROYER', [{ row: 4, col: 0 }, { row: 4, col: 1 }]),
];

function gameStateWith(ships: ShipDto[]): GameStateResponse {
  return {
    gameId: 'GAME01',
    status: 'PLACING_SHIPS',
    currentTurnPlayerId: null,
    winnerId: null,
    myBoard: { ships, missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: false,
    opponentReady: false,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  // Session context now lives in the localStorage active-game pointer (not sessionStorage).
  // placement_ships_<gameId> remains in sessionStorage (transient placement scratch).
  localStorage.setItem(
    'battleship_active_game',
    JSON.stringify({ gameId: 'GAME01', playerId: 'player1', gameMode: 'HUMAN' }),
  );
  currentGameState = null;
});

describe('Lobby hydration integration — real usePlacement + polling seam', () => {
  it('hydrates the fleet panel and board from the first server board carrying ships', () => {
    // First poll already carries the persisted fleet (refresh / reconnect scenario).
    currentGameState = gameStateWith(PERSISTED_FLEET);

    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // Fleet List panel: all 5 ship types marked Placed via the real hook state.
    expect(screen.getAllByText('Placed')).toHaveLength(5);

    // Board: the 17 persisted ship cells render as ship cells (state "ship").
    const shipCells = screen
      .getAllByRole('gridcell')
      .filter((el) => el.className.includes('board-cell--ship'));
    expect(shipCells).toHaveLength(17);

    // All placed → Confirm Ready is enabled (allPlaced computed by the real hook).
    expect(screen.getByRole('button', { name: /confirm ready/i })).toBeEnabled();

    // hydrate clears selection → no rotate hint, board not interactive.
    expect(screen.queryByText(/press/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^row \d+ col \d+/i })).not.toBeInTheDocument();
  });

  it('does NOT re-hydrate or clobber a local optimistic placement when a later poll echoes the board', async () => {
    // Start with an empty server board — nothing to hydrate yet.
    currentGameState = gameStateWith([]);
    const { rerender } = render(<MemoryRouter><Lobby /></MemoryRouter>);

    // No ships placed initially.
    expect(screen.queryByText('Placed')).not.toBeInTheDocument();

    // Player selects DESTROYER and places it locally (optimistic).
    fireEvent.click(screen.getByRole('button', { name: /destroyer, size 2/i }));
    // With a selection, board cells become interactive buttons "Row N Col M: ...".
    const targetCell = screen.getByRole('button', { name: /^row 6 col 1:/i });
    fireEvent.click(targetCell);

    // The optimistic ship now shows as placed (exactly one ship placed locally).
    expect(screen.getAllByText('Placed')).toHaveLength(1);
    const fleetPanel = screen.getByText('Your Fleet').closest('.fleet-list-panel') as HTMLElement;
    expect(within(fleetPanel).getByRole('button', { name: /destroyer, size 2, placed/i })).toBeDisabled();

    // A later 2s poll echoes back the FULL fleet (server now knows about more ships,
    // or simply re-sends state). Hydration must NOT fire again: placedShips.length is not 0
    // and the once-only ref is already set. Local state must remain a single placed ship.
    currentGameState = gameStateWith(PERSISTED_FLEET);
    rerender(<MemoryRouter><Lobby /></MemoryRouter>);

    // Still exactly one placed ship — NOT clobbered/overwritten by the echoed full fleet.
    expect(screen.getAllByText('Placed')).toHaveLength(1);
  });
});

describe('Lobby sessionStorage fast-path — real usePlacement lazy init seam', () => {
  it('populates fleet panel on FIRST render when sessionStorage is pre-populated (no poll needed)', () => {
    // Simulate a page refresh: the hook's lazy initializer reads from sessionStorage on mount.
    // No poll has fired yet — currentGameState is null.
    sessionStorage.setItem('placement_ships_GAME01', JSON.stringify(PERSISTED_FLEET));
    currentGameState = null;

    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // Fleet panel: all 5 ship types must be marked Placed immediately on first render —
    // no poll tick needed. This validates the lazy-init seam between usePlacement(gameId)
    // reading sessionStorage and Lobby rendering the result.
    expect(screen.getAllByText('Placed')).toHaveLength(5);

    // Confirm Ready must be enabled immediately (all ships placed, not ready yet).
    expect(screen.getByRole('button', { name: /confirm ready/i })).toBeEnabled();

    // No ship selected on init → board is non-interactive (no rotate hint, no button cells).
    expect(screen.queryByText(/press/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^row \d+ col \d+/i })).not.toBeInTheDocument();
  });

  it('does not flash empty fleet panel when sessionStorage has ships but first poll is delayed', () => {
    // Pre-populate before render — no poll state.
    sessionStorage.setItem('placement_ships_GAME01', JSON.stringify(PERSISTED_FLEET));
    currentGameState = null;

    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // Board must show 17 ship cells immediately (lazy init populated placedShips).
    const shipCells = screen
      .getAllByRole('gridcell')
      .filter((el) => el.className.includes('board-cell--ship'));
    expect(shipCells).toHaveLength(17);
  });
});

describe('Lobby IN_PROGRESS sessionStorage cleanup — real hook + page seam', () => {
  it('removes placement_ships_<gameId> before navigating to /game', () => {
    // Write a key as the real hook would during placement.
    sessionStorage.setItem('placement_ships_GAME01', JSON.stringify(PERSISTED_FLEET));

    // Simulate status becoming IN_PROGRESS on the first poll.
    currentGameState = {
      gameId: 'GAME01',
      status: 'IN_PROGRESS',
      currentTurnPlayerId: 'player1',
      winnerId: null,
      myBoard: { ships: PERSISTED_FLEET, missedShots: [], hits: [] },
      opponentBoard: { ships: [], missedShots: [], hits: [] },
      myReady: true,
      opponentReady: true,
    };

    act(() => {
      render(<MemoryRouter><Lobby /></MemoryRouter>);
    });

    // The placement key must be removed before navigate('/game') fires.
    // This prevents stale ship data from appearing in a future game on the same tab.
    expect(sessionStorage.getItem('placement_ships_GAME01')).toBeNull();
  });
});
