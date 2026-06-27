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

  it('returns control and re-enables the board after the computer move', async () => {
    fireShotMock.mockResolvedValue(responseWithComputerShot());
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);
    expect(screen.getByText('Computer is playing')).toBeInTheDocument();

    // Advance through the reveal + hold windows.
    await flush(COMPUTER_PLAYING_REVEAL_MS);
    await flush(COMPUTER_PLAYING_HOLD_MS);

    // Control returns: the "Computer is playing" lock is gone and the title is restored.
    expect(screen.queryByText('Computer is playing')).toBeNull();
    expect(screen.getByText('Your turn')).toBeInTheDocument(); // title restored
    // Board interactive again (no redundant "Your turn again" toast is shown).
    expect(within(enemyBoard()).getByRole('button', { name: 'Row 1 Col 1: empty' })).toBeInTheDocument();
  });

  it('navigates to game-over when the computer\'s shot ends the game', async () => {
    fireShotMock.mockResolvedValue(
      responseWithComputerShot({ winnerId: 'computer', gameStatus: 'FINISHED' }),
    );
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);
    await flush(COMPUTER_PLAYING_REVEAL_MS); // reveal → winner detected → navigate

    expect(navigateMock).toHaveBeenCalledWith('/game-over');
    // Control never returns: the board stays under the "Computer is playing" lock
    // until navigation away.
    expect(screen.getByText('Computer is playing')).toBeInTheDocument();
  });

  it("reveals the player's OWN shot result immediately, BEFORE the computer-reveal delay (AC-7/AC-8/AC-9)", async () => {
    // This is the core responsiveness ordering guarantee. The player's own authoritative
    // board marker is pulled via refresh(); that refresh must fire as soon as the shot
    // resolves — NOT be gated behind COMPUTER_PLAYING_REVEAL_MS. The computer's own shot
    // reveal is the only thing the delay applies to (a SECOND refresh after the delay).
    fireShotMock.mockResolvedValue(responseWithComputerShot());
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0); // resolve fireShot — player's own result + marker must be in by now

    // The player's own board refresh already happened (immediate), even though we have NOT
    // yet advanced the computer-reveal timer.
    expect(refreshMock).toHaveBeenCalledTimes(1);
    // The "Computer is playing" phase is showing, but its reveal delay has not elapsed.
    expect(screen.getByText('Computer is playing')).toBeInTheDocument();

    // Now advance the computer-reveal window: the SECOND refresh (computer's shot) lands.
    await flush(COMPUTER_PLAYING_REVEAL_MS);
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it('winning player shot resolves immediately with one refresh and no computer phase (AC-13a)', async () => {
    // The player's shot wins: backend returns no computerShot. The board must refresh
    // immediately (player's own result) with NO "Computer is playing" phase and NO delay.
    fireShotMock.mockResolvedValue({
      row: 0, col: 0, result: 'SUNK', sunkShipType: 'DESTROYER',
      nextTurnPlayerId: null, gameStatus: 'FINISHED', winnerId: 'me',
      computerShot: null,
    });
    renderGame();

    act(() => { fireEvent.click(within(enemyBoard()).getByLabelText('Row 1 Col 1: empty')); });
    await flush(0);

    // Immediate refresh of the player's own winning result — no computer choreography.
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Computer is playing')).toBeNull();
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
