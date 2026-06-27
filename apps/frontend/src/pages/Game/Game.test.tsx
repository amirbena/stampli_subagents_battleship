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
const stopGameMock = vi.fn();
vi.mock('../../api/gameApi', () => ({
  fireShot: (...args: unknown[]) => fireShotMock(...args),
  pauseGame: vi.fn(),
  stopGame: (...args: unknown[]) => stopGameMock(...args),
}));

const refreshMock = vi.fn().mockResolvedValue(undefined);
let mockGameState: GameStateResponse | null;
let mockGameGone = false;
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({
    gameState: mockGameState,
    isLoading: false,
    gameGone: mockGameGone,
    refresh: refreshMock,
  }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
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
    JSON.stringify({ gameId: 'G1', playerId: 'me', gameMode: 'HUMAN', sessionToken: 'tok-G1' }),
  );
  fireShotMock.mockReset();
  stopGameMock.mockReset();
  stopGameMock.mockResolvedValue(undefined);
  playShotSoundMock.mockReset();
  navigateMock.mockClear();
  refreshMock.mockClear();
  mockGameState = baseState();
  mockGameGone = false;
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

  it('fires the shot with silent=true so the app-wide loader is not triggered', async () => {
    const user = userEvent.setup();
    fireShotMock.mockResolvedValue(HIT_RESULT);

    renderGame();
    await user.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty'));

    // The trailing silent arg keeps firing off the global top-bar loader (UX-only).
    expect(fireShotMock).toHaveBeenCalledWith('G1', 'me', 0, 0, 'tok-G1', true);
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

describe('Game — recovery on unloadable game data (AC-3/AC-4)', () => {
  it('clears the stale pointer and redirects to main when gameGone is true', async () => {
    mockGameGone = true;
    renderGame();
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    // Stale pointer cleared so the route guard cannot re-admit the dead session (AC-4).
    expect(localStorage.getItem('battleship_active_game')).toBeNull();
  });

  it('does not render a broken board while recovering (no flash before redirect)', () => {
    mockGameGone = true;
    renderGame();
    // No game grids render — a neutral recovery spinner shows instead.
    expect(screen.queryByRole('grid', { name: 'Enemy Waters' })).toBeNull();
    expect(screen.getByText(/returning to the main screen/i)).toBeInTheDocument();
  });
});

describe('Game — leave confirmation + Back interception (AC-11/12/13)', () => {
  it('pressing browser Back shows the Stay/Leave confirmation instead of leaving (AC-11)', async () => {
    renderGame();
    // Simulate the browser Back button.
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/leave this game\?/i)).toBeInTheDocument();
  });

  it('Stay closes the dialog and keeps the player in the game (AC-12)', async () => {
    const user = userEvent.setup();
    renderGame();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^stay$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Game board still present — no state loss, no navigation.
    expect(enemyBoard()).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('Leave releases the game (stop) and returns to main (AC-13)', async () => {
    const user = userEvent.setup();
    renderGame();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^leave$/i }));
    await waitFor(() => expect(stopGameMock).toHaveBeenCalledWith('G1', 'me', 'tok-G1'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    expect(localStorage.getItem('battleship_active_game')).toBeNull();
  });

  it('keeps the player in the game if the Leave (stop) call fails — no double-release nav', async () => {
    const user = userEvent.setup();
    stopGameMock.mockRejectedValue(new Error('Stop failed'));
    renderGame();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /^leave$/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Stop failed'));
    expect(navigateMock).not.toHaveBeenCalled();
    // Pointer preserved so the player can retry.
    expect(localStorage.getItem('battleship_active_game')).not.toBeNull();
  });
});
