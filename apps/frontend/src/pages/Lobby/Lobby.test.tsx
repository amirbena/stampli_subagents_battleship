import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Lobby } from './Lobby';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({ gameState: null, isLoading: false }),
}));

vi.mock('../../hooks/usePlacement', () => ({
  usePlacement: () => ({
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
  }),
}));

vi.mock('../../api/gameApi', () => ({
  placeShip: vi.fn(),
  removeShip: vi.fn(),
  setReady: vi.fn(),
}));

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem('gameId', 'GAME01');
  sessionStorage.setItem('playerId', 'player1');
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
