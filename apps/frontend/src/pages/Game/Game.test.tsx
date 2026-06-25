import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, act } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Game } from './Game';
import type { GameStateResponse, FireShotResponse } from '../../types/game';

const playShotSoundMock = vi.fn();
vi.mock('../../utils/sound', () => ({
  playShotSound: () => playShotSoundMock(),
}));

const fireShotMock = vi.fn();
vi.mock('../../api/gameApi', () => ({
  fireShot: (...args: unknown[]) => fireShotMock(...args),
  pauseGame: vi.fn(),
  stopGame: vi.fn(),
}));

const refreshMock = vi.fn().mockResolvedValue(undefined);
let mockGameState: GameStateResponse | null;
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({ gameState: mockGameState, isLoading: false, refresh: refreshMock }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function baseState(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    gameId: 'G1',
    status: 'IN_PROGRESS',
    currentTurnPlayerId: 'me',
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: true,
    opponentReady: true,
    gameMode: 'HUMAN',
    ...overrides,
  };
}

const HIT_RESULT: FireShotResponse = {
  row: 0,
  col: 0,
  result: 'HIT',
  sunkShipType: null,
  nextTurnPlayerId: 'opp',
  gameStatus: 'IN_PROGRESS',
  winnerId: null,
  computerShot: null,
};

function enemyBoard() {
  return screen.getByRole('grid', { name: 'Enemy Waters' });
}

function renderGame() {
  return render(<MemoryRouter><Game /></MemoryRouter>);
}

beforeEach(() => {
  // Session context now lives in the localStorage active-game pointer (not sessionStorage).
  localStorage.setItem(
    'battleship_active_game',
    JSON.stringify({ gameId: 'G1', playerId: 'me', gameMode: 'HUMAN' }),
  );
  fireShotMock.mockReset();
  playShotSoundMock.mockReset();
  refreshMock.mockClear();
  mockGameState = baseState();
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('Game — shot responsiveness', () => {
  it('marks the target cell pending immediately on fire (AC1)', async () => {
    const user = userEvent.setup();
    let resolveFire: (v: FireShotResponse) => void = () => {};
    fireShotMock.mockReturnValue(new Promise<FireShotResponse>((r) => { resolveFire = r; }));

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    expect(within(enemyBoard()).getByLabelText('Row 1 Col 1: pending')).toBeInTheDocument();
    await act(async () => { resolveFire(HIT_RESULT); });
  });

  it('shows the "Firing…" indicator while pending and removes it after the result (AC5/AC6)', async () => {
    const user = userEvent.setup();
    let resolveFire: (v: FireShotResponse) => void = () => {};
    fireShotMock.mockReturnValue(new Promise<FireShotResponse>((r) => { resolveFire = r; }));

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));
    expect(screen.getByText(/Firing…/)).toBeInTheDocument();

    await act(async () => { resolveFire(HIT_RESULT); });
    await waitFor(() => expect(screen.queryByText(/Firing…/)).toBeNull());
  });

  it('plays the shot sound on a valid fire (AC14)', async () => {
    const user = userEvent.setup();
    fireShotMock.mockResolvedValue(HIT_RESULT);

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    expect(playShotSoundMock).toHaveBeenCalledTimes(1);
  });

  it('does not fire or play sound when it is not my turn (AC15)', async () => {
    mockGameState = baseState({ currentTurnPlayerId: 'opp' });
    const user = userEvent.setup();

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    expect(fireShotMock).not.toHaveBeenCalled();
    expect(playShotSoundMock).not.toHaveBeenCalled();
  });

  it('does not fire or play sound on an already-missed cell (AC15)', async () => {
    mockGameState = baseState({ opponentBoard: { ships: [], missedShots: [{ row: 0, col: 0 }], hits: [] } });
    const user = userEvent.setup();

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: miss'));

    expect(fireShotMock).not.toHaveBeenCalled();
    expect(playShotSoundMock).not.toHaveBeenCalled();
  });

  it('prevents a second shot while one is pending (AC2/AC8)', async () => {
    const user = userEvent.setup();
    let resolveFire: (v: FireShotResponse) => void = () => {};
    fireShotMock.mockReturnValue(new Promise<FireShotResponse>((r) => { resolveFire = r; }));

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));
    // Board is locked while pending — a second click must not issue another request.
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 2: empty'));

    expect(fireShotMock).toHaveBeenCalledTimes(1);
    expect(playShotSoundMock).toHaveBeenCalledTimes(1);
    await act(async () => { resolveFire(HIT_RESULT); });
  });

  it('clears pending and pulls authoritative state after success (AC3)', async () => {
    const user = userEvent.setup();
    fireShotMock.mockResolvedValue(HIT_RESULT);

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    await waitFor(() =>
      expect(within(enemyBoard()).queryByLabelText('Row 1 Col 1: pending')).toBeNull(),
    );
    expect(refreshMock).toHaveBeenCalled();
  });

  it('clears pending, unlocks the board, and shows an error on failure (AC7)', async () => {
    const user = userEvent.setup();
    fireShotMock.mockRejectedValue(new Error('Network down'));

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Network down'));
    expect(within(enemyBoard()).queryByLabelText('Row 1 Col 1: pending')).toBeNull();
    // Board is interactive again — the cell is a button.
    expect(within(enemyBoard()).getByRole('button', { name: 'Row 1 Col 1: empty' })).toBeInTheDocument();
    expect(screen.queryByText(/Firing…/)).toBeNull();
  });
});
