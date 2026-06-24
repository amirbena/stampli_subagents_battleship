import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react'; // act from RTL, not vitest
import { MemoryRouter } from 'react-router-dom';
import { Lobby } from './Lobby';
import type { ShipDto, ShipType } from '../../types/game';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// Controllable polling mock — tests override the returned gameState.
let pollingReturn: { gameState: unknown; isLoading: boolean } = {
  gameState: null,
  isLoading: false,
};
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => pollingReturn,
}));

// Controllable placement mock — tests override placedShips/selectedShipType/allPlaced.
// The mock also captures the gameId argument so tests can assert it was passed correctly.
let placementReturn: Record<string, unknown>;
let lastUsePlacementArg: string | undefined;
function makePlacement(overrides: Record<string, unknown> = {}) {
  return {
    placedShips: [],
    selectedShipType: null,
    orientation: 'HORIZONTAL',
    allPlaced: false,
    previewCells: [],
    previewValid: true,
    selectShip: vi.fn(),
    toggleOrientation: vi.fn(),
    placeShip: vi.fn(),
    removeShip: vi.fn(),
    setPreview: vi.fn(),
    hydrate: vi.fn(),
    ...overrides,
  };
}
vi.mock('../../hooks/usePlacement', () => ({
  usePlacement: (gameId: string) => {
    lastUsePlacementArg = gameId;
    return placementReturn;
  },
}));

vi.mock('../../api/gameApi', () => ({
  placeShip: vi.fn(),
  removeShip: vi.fn(),
  setReady: vi.fn(),
}));

function ship(shipType: ShipType, cells: { row: number; col: number }[]): ShipDto {
  return { shipType, cells, hits: [], sunk: false };
}

const FULL_FLEET: ShipDto[] = [
  ship('CARRIER', [{ row: 0, col: 0 }]),
  ship('BATTLESHIP', [{ row: 1, col: 0 }]),
  ship('CRUISER', [{ row: 2, col: 0 }]),
  ship('SUBMARINE', [{ row: 3, col: 0 }]),
  ship('DESTROYER', [{ row: 4, col: 0 }]),
];

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('gameId', 'GAME01');
  sessionStorage.setItem('playerId', 'player1');
  pollingReturn = { gameState: null, isLoading: false };
  placementReturn = makePlacement();
  lastUsePlacementArg = undefined;
});

describe('Lobby — vs Computer mode', () => {
  it('shows vs-computer message when gameMode=COMPUTER', () => {
    sessionStorage.setItem('gameMode', 'COMPUTER');
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    expect(screen.getByText(/playing vs computer/i)).toBeInTheDocument();
  });

  it('does not show room code when gameMode=COMPUTER', () => {
    sessionStorage.setItem('gameMode', 'COMPUTER');
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    // RoomCodeDisplay shows the gameId; it should not be present
    expect(screen.queryByText('GAME01')).not.toBeInTheDocument();
  });
});

describe('Lobby — vs Human mode', () => {
  it('does not show vs-computer message when gameMode=HUMAN', () => {
    sessionStorage.setItem('gameMode', 'HUMAN');
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    expect(screen.queryByText(/playing vs computer/i)).not.toBeInTheDocument();
  });

  it('shows room code when gameMode=HUMAN', () => {
    sessionStorage.setItem('gameMode', 'HUMAN');
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    // RoomCodeDisplay renders the gameId text somewhere
    expect(screen.getByText('GAME01')).toBeInTheDocument();
  });
});

describe('Lobby — usePlacement gameId wiring', () => {
  it('passes the gameId from sessionStorage to usePlacement', () => {
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    expect(lastUsePlacementArg).toBe('GAME01');
  });

  it('passes an empty string to usePlacement when gameId is absent from sessionStorage', () => {
    sessionStorage.removeItem('gameId');
    // Redirect effect fires when gameId is missing, but the hook is still called first.
    render(<MemoryRouter><Lobby /></MemoryRouter>);
    expect(lastUsePlacementArg).toBe('');
  });
});

describe('Lobby — IN_PROGRESS sessionStorage cleanup', () => {
  it('removes the placement_ships_<gameId> key before navigating to /game', () => {
    // Pre-populate the key to confirm it gets cleared.
    sessionStorage.setItem('placement_ships_GAME01', JSON.stringify([{ shipType: 'DESTROYER', cells: [], hits: [], sunk: false }]));

    pollingReturn = {
      gameState: { status: 'IN_PROGRESS', myBoard: null, myReady: false },
      isLoading: false,
    };

    act(() => {
      render(<MemoryRouter><Lobby /></MemoryRouter>);
    });

    expect(sessionStorage.getItem('placement_ships_GAME01')).toBeNull();
  });

  it('does not remove placement key when game is still PLACING_SHIPS', () => {
    sessionStorage.setItem('placement_ships_GAME01', JSON.stringify([]));

    pollingReturn = {
      gameState: { status: 'PLACING_SHIPS', myBoard: { ships: [], missedShots: [], hits: [] }, myReady: false },
      isLoading: false,
    };

    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // Key must still be present — cleanup only fires on IN_PROGRESS.
    expect(sessionStorage.getItem('placement_ships_GAME01')).not.toBeNull();
  });
});

describe('Lobby — post-hydration fleet/board state', () => {
  it('marks already-placed ship types as placed in the Fleet List panel', () => {
    // Simulate the state after hydrate() ran: placedShips reflects the server board.
    placementReturn = makePlacement({
      placedShips: FULL_FLEET,
      allPlaced: true,
      selectedShipType: null,
    });
    pollingReturn = {
      gameState: {
        status: 'PLACING_SHIPS',
        myBoard: { ships: FULL_FLEET, missedShots: [], hits: [] },
        myReady: false,
      },
      isLoading: false,
    };
    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // FleetShipItem renders a "Placed" badge per placed ship type — all 5 present.
    expect(screen.getAllByText('Placed')).toHaveLength(5);
    // Placed ship buttons are disabled (cannot re-select an already-placed type).
    const carrier = screen.getByRole('button', { name: /carrier, size 5, placed/i });
    expect(carrier).toBeDisabled();
  });

  it('enables Confirm Ready when all ships placed post-hydration and player not ready', () => {
    placementReturn = makePlacement({
      placedShips: FULL_FLEET,
      allPlaced: true,
      selectedShipType: null,
    });
    pollingReturn = {
      gameState: {
        status: 'PLACING_SHIPS',
        myBoard: { ships: FULL_FLEET, missedShots: [], hits: [] },
        myReady: false,
      },
      isLoading: false,
    };
    render(<MemoryRouter><Lobby /></MemoryRouter>);

    const confirm = screen.getByRole('button', { name: /confirm ready/i });
    expect(confirm).toBeEnabled();
  });

  it('renders no pre-selected ship and a non-interactive board after hydration (no selection)', () => {
    placementReturn = makePlacement({
      placedShips: FULL_FLEET,
      allPlaced: true,
      selectedShipType: null,
    });
    pollingReturn = {
      gameState: {
        status: 'PLACING_SHIPS',
        myBoard: { ships: FULL_FLEET, missedShots: [], hits: [] },
        myReady: false,
      },
      isLoading: false,
    };
    render(<MemoryRouter><Lobby /></MemoryRouter>);

    // No ship selected → rotate section (only shown when a ship is selected) is absent.
    expect(screen.queryByText(/press/i)).not.toBeInTheDocument();
    // No ship selected → board passes interactive=false, so BoardCell renders cells as
    // role="gridcell" (not role="button"). With interactive=true they would be buttons
    // labelled "Row N Col M: ...". Assert no such interactive cell buttons exist.
    expect(screen.queryByRole('button', { name: /^row \d+ col \d+/i })).not.toBeInTheDocument();
    // The cells are still present as gridcells (board renders regardless of interactivity).
    expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0);
  });
});
