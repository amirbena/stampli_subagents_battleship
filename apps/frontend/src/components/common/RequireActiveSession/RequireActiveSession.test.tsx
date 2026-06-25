import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireActiveSession } from './RequireActiveSession';

const ACTIVE_GAME_KEY = 'battleship_active_game';

/**
 * Renders the guard wrapping a protected route, entering at `/game`. The guard reads the
 * REAL useActiveGame pointer (localStorage), so these tests exercise the true guard↔pointer
 * seam, not a mocked stand-in.
 */
function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route element={<RequireActiveSession />}>
          <Route path="/game" element={<div>Protected Game</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireActiveSession guard (AC-3 / AC-4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('redirects to Home when no active-game pointer exists (deep-link with no session)', () => {
    renderAt('/game');
    expect(screen.getByText('Home Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Game')).not.toBeInTheDocument();
  });

  it('renders the protected route when a valid active-game pointer exists', () => {
    window.localStorage.setItem(
      ACTIVE_GAME_KEY,
      JSON.stringify({ gameId: 'g-1', playerId: 'p-1', gameMode: 'HUMAN' }),
    );
    renderAt('/game');
    expect(screen.getByText('Protected Game')).toBeInTheDocument();
    expect(screen.queryByText('Home Page')).not.toBeInTheDocument();
  });
});
