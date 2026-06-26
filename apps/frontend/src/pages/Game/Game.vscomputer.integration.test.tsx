import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Game } from './Game';
import type { GameStateResponse, FireShotResponse } from '../../types/game';
import {
  COMPUTER_PLAYING_REVEAL_MS,
  COMPUTER_PLAYING_HOLD_MS,
} from '../../utils/turnTiming';

/**
 * Integration test for the vs-computer turn-phase choreography.
 *
 * This is a seam/timing test, not a per-component unit test: the "Computer is playing"
 * phase, the fire lock, the "can't shoot" notice, and the "your turn again" return cue
 * are produced by the real Game page orchestrating its child components and timers
 * together. Each piece passes in isolation, but only the wired-up sequence verifies the
 * lock engages between the player's shot and the computer's reveal and releases after.
 */

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
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({
    gameState: mockGameState,
    isLoading: false,
    gameGone: false,
    refresh: refreshMock,
  }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

function computerState(overrides: Partial<GameStateResponse> = {}): GameStateResponse {
  return {
    gameId: 'G1',
    status: 'IN_PROGRESS',
    currentTurnPlayerId: 'me',
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: true,
    opponentReady: true,
    gameMode: 'COMPUTER',
    ...overrides,
  };
}

function responseWithComputerShot(
  overrides: Partial<FireShotResponse['computerShot']> = {},
): FireShotResponse {
  return {
    row: 0,
    col: 0,
    result: 'MISS',
    sunkShipType: null,
    nextTurnPlayerId: 'me',
    gameStatus: 'IN_PROGRESS',
    winnerId: null,
    computerShot: {
      row: 5,
      col: 5,
      result: 'MISS',
      sunkShipType: null,
      winnerId: null,
      gameStatus: 'IN_PROGRESS',
      ...overrides,
    },
  };
}

function enemyBoard() {
  return screen.getByRole('grid', { name: 'Enemy Waters' });
}

function renderGame() {
  return render(<MemoryRouter><Game /></MemoryRouter>);
}

// Flush pending microtasks (awaited promises) and any timers due within `ms`.
async function flush(ms = 0): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem(
    'battleship_active_game',
    JSON.stringify({ gameId: 'G1', playerId: 'me', gameMode: 'COMPUTER' }),
  );
  fireShotMock.mockReset();
  stopGameMock.mockReset();
  stopGameMock.mockResolvedValue(undefined);
  playShotSoundMock.mockReset();
  navigateMock.mockClear();
  refreshMock.mockClear();
  mockGameState = computerState();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('Game vs-computer — turn choreography', () => {
  it('shows a persistent "Your turn" title before firing', () => {
    renderGame();
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });

  it('enters a locked "Computer is playing" phase after the player fires', async () => {
    fireShotMock.mockResolvedValue(responseWithComputerShot());
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0); // resolve fireShot → enter the computer-playing phase

    expect(screen.getByText('Computer is playing')).toBeInTheDocument();
    // Board is locked: cells are no longer interactive buttons.
    expect(within(enemyBoard()).queryByRole('button', { name: 'Row 1 Col 2: empty' })).toBeNull();
  });

  it('shows "Can\'t shoot" and fires no shot when the player clicks during the lock', async () => {
    fireShotMock.mockResolvedValue(responseWithComputerShot());
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);
    expect(screen.getByText('Computer is playing')).toBeInTheDocument();

    // Click another cell while locked.
    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 2: empty')); });

    expect(screen.getByText(/can't shoot — computer is playing/i)).toBeInTheDocument();
    expect(fireShotMock).toHaveBeenCalledTimes(1); // no second shot issued
  });

  it('returns control with a "Your turn again" cue and re-enables the board', async () => {
    fireShotMock.mockResolvedValue(responseWithComputerShot());
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);
    expect(screen.getByText('Computer is playing')).toBeInTheDocument();

    // Advance through the reveal + hold windows.
    await flush(COMPUTER_PLAYING_REVEAL_MS);
    await flush(COMPUTER_PLAYING_HOLD_MS);

    expect(screen.getByText(/your turn again/i)).toBeInTheDocument();
    expect(screen.getByText('Your turn')).toBeInTheDocument(); // title restored
    // Board interactive again.
    expect(within(enemyBoard()).getByRole('button', { name: 'Row 1 Col 1: empty' })).toBeInTheDocument();
  });

  it('does not show "Your turn again" when the computer\'s shot ends the game', async () => {
    fireShotMock.mockResolvedValue(
      responseWithComputerShot({ winnerId: 'computer', gameStatus: 'FINISHED' }),
    );
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);
    await flush(COMPUTER_PLAYING_REVEAL_MS); // reveal → winner detected → navigate

    expect(navigateMock).toHaveBeenCalledWith('/game-over');
    expect(screen.queryByText(/your turn again/i)).toBeNull();
  });

  it('recovers to an active turn (no stuck lock) when the shot request fails', async () => {
    fireShotMock.mockRejectedValue(new Error('Network down'));
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);

    expect(screen.getByRole('alert')).toHaveTextContent('Network down');
    expect(screen.queryByText('Computer is playing')).toBeNull();
    expect(screen.getByText('Your turn')).toBeInTheDocument();
    expect(within(enemyBoard()).getByRole('button', { name: 'Row 1 Col 1: empty' })).toBeInTheDocument();
  });
});
