import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Game } from './Game';
import type { GameStateResponse } from '../../types/game';

/**
 * Cross-layer seam test (self-diagnosed per frontend-ui-agent skill): the browser
 * Back-button history/popstate guard ↔ real LeaveConfirmModal ↔ real navigation/stop wiring.
 *
 * Why an integration test and not a unit test: the per-layer Game.test.tsx mocks `useNavigate`,
 * so it proves the handlers fire but NOT that the popstate guard, the modal, and *real* router
 * navigation interact correctly together — including that after Leave the user actually lands
 * on a real Home route and the guard does not re-trap the navigation into a loop. Only the
 * network boundary (`stopGame`) and the polling hook are mocked; useActiveGame (localStorage),
 * react-router, the history guard, and LeaveConfirmModal are all REAL.
 *
 * Covers AC-11 (Back → confirm), AC-12 (Stay keeps the game), AC-13 (Leave releases + returns
 * to main), and the edge case: Back after Stay re-shows the confirmation (does not silently exit).
 */

const stopGameMock = vi.fn();
vi.mock('../../api/gameApi', () => ({
  fireShot: vi.fn(),
  pauseGame: vi.fn(),
  stopGame: (...args: unknown[]) => stopGameMock(...args),
}));

// Polling is the network boundary — mocked to a stable in-progress state so the board renders.
let mockGameState: GameStateResponse | null;
vi.mock('../../hooks/useGamePolling', () => ({
  useGamePolling: () => ({
    gameState: mockGameState,
    isLoading: false,
    gameGone: false,
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

function inProgressState(): GameStateResponse {
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
  };
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/game']}>
      <Routes>
        <Route path="/" element={<div>Home Screen</div>} />
        <Route path="/game" element={<Game />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.setItem(
    'battleship_active_game',
    JSON.stringify({ gameId: 'G1', playerId: 'me', gameMode: 'COMPUTER', sessionToken: 'tok-G1' }),
  );
  stopGameMock.mockReset();
  stopGameMock.mockResolvedValue(undefined);
  mockGameState = inProgressState();
});

afterEach(() => {
  localStorage.clear();
});

describe('Game Back/Leave seam (integration)', () => {
  it('Back press opens the confirmation; Leave stops the game and lands on Home (AC-11/AC-13)', async () => {
    const user = userEvent.setup();
    renderApp();
    expect(screen.getByRole('grid', { name: 'Enemy Waters' })).toBeInTheDocument();

    // Real browser Back via popstate — the guard intercepts and opens the modal.
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await screen.findByText(/leave this game\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^leave$/i }));

    await waitFor(() => expect(stopGameMock).toHaveBeenCalledWith('G1', 'me', 'tok-G1'));
    // Real router navigation lands on Home; pointer cleared so no re-entry loop (AC-4 alignment).
    expect(await screen.findByText('Home Screen')).toBeInTheDocument();
    expect(localStorage.getItem('battleship_active_game')).toBeNull();
  });

  it('Stay keeps the player in the game; a subsequent Back re-shows the confirmation (AC-12 + edge case)', async () => {
    const user = userEvent.setup();
    renderApp();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await screen.findByText(/leave this game\?/i);
    await user.click(screen.getByRole('button', { name: /^stay$/i }));

    // Still in the game — board present, Home not shown.
    await waitFor(() => expect(screen.queryByText(/leave this game\?/i)).toBeNull());
    expect(screen.getByRole('grid', { name: 'Enemy Waters' })).toBeInTheDocument();
    expect(screen.queryByText('Home Screen')).toBeNull();

    // Pressing Back again must re-show the confirmation, not silently exit.
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(await screen.findByText(/leave this game\?/i)).toBeInTheDocument();
    expect(stopGameMock).not.toHaveBeenCalled();
  });
});
