import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { GameStateResponse } from '../../types/game';
import { Home } from './Home';

/**
 * Cross-layer seam test: real useActiveGame pointer (localStorage) ↔ real ResumeGameModal ↔
 * resume routing in Home. Only the network boundary is mocked: the resume sequence hook and
 * the stop API wrapper. This proves the guard/modal/resume single-source behavior end-to-end
 * inside jsdom — the runtime ordering a per-layer unit test cannot exercise together
 * (AC-5 render condition, AC-6 route-by-phase, AC-7 stop clears + no re-prompt, AC-14).
 */

const ACTIVE_GAME_KEY = 'battleship_active_game';

// Mock only the network/seam boundary. useActiveGame + ResumeGameModal stay REAL.
const resumeMock = vi.fn();
vi.mock('../../hooks/useResumeGame', () => ({
  useResumeGame: () => ({ resume: resumeMock, isResuming: false }),
}));

const stopGameMock = vi.fn();
vi.mock('../../api/gameApi', () => ({
  createGame: vi.fn(),
  joinGame: vi.fn(),
  stopGame: (...args: unknown[]) => stopGameMock(...args),
}));

// Identity resolves immediately so Home renders its actions without a backend round-trip.
vi.mock('../../hooks/usePlayerIdentity', () => ({
  usePlayerIdentity: () => ({
    player: { playerId: 'p-1', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    status: 'identified',
    createPlayer: vi.fn(),
    error: null,
  }),
}));

function setPointer() {
  window.localStorage.setItem(
    ACTIVE_GAME_KEY,
    JSON.stringify({ gameId: 'g-1', playerId: 'p-1', gameMode: 'HUMAN' }),
  );
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<div>Lobby Page</div>} />
        <Route path="/game" element={<div>Game Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function stateWith(status: GameStateResponse['status']): GameStateResponse {
  return {
    gameId: 'g-1',
    status,
    currentTurnPlayerId: null,
    winnerId: null,
    myBoard: { ships: [], missedShots: [], hits: [] },
    opponentBoard: { ships: [], missedShots: [], hits: [] },
    myReady: false,
    opponentReady: false,
  };
}

describe('Home resume seam (AC-5/6/7/14)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resumeMock.mockReset();
    stopGameMock.mockReset();
  });

  it('shows the resume modal ONLY when the active-game pointer is non-null (AC-5)', () => {
    renderHome();
    // Clean Home — no pointer, no modal.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the verbatim modal when a pointer exists', () => {
    setPointer();
    renderHome();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText('Do you want to continue your existing game?'),
    ).toBeInTheDocument();
  });

  it('Yes/Resume → IN_PROGRESS routes to /game (AC-6)', async () => {
    setPointer();
    resumeMock.mockResolvedValue(stateWith('IN_PROGRESS'));
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(screen.getByText('Game Page')).toBeInTheDocument());
    expect(resumeMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 'g-1', playerId: 'p-1' }),
    );
  });

  it('Yes/Resume → PLACING_SHIPS routes to /lobby (AC-6)', async () => {
    setPointer();
    resumeMock.mockResolvedValue(stateWith('PLACING_SHIPS'));
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(screen.getByText('Lobby Page')).toBeInTheDocument());
  });

  it('Yes/Resume → null (stale 404 / FINISHED) stays on clean Home, modal gone (AC-13/14)', async () => {
    setPointer();
    // Stale 404 / FINISHED resolves to null. Home must clear its OWN pointer instance so the
    // modal disappears — the resume hook only cleared its separate instance (cross-layer seam).
    resumeMock.mockResolvedValue(null);
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /resume/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('Game Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Lobby Page')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it('No/Stop → calls stopGame, clears pointer, modal gone (AC-7/14)', async () => {
    setPointer();
    stopGameMock.mockResolvedValue(undefined);
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(stopGameMock).toHaveBeenCalledWith('g-1', 'p-1');
    expect(window.localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });
});
