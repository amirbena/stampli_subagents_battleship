import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import type { Player } from '../../types/game';

// Mock the API layer — this is the UI agent's boundary (no HTTP in component tests).
vi.mock('../../api/gameApi', () => ({
  createGame: vi.fn().mockResolvedValue({ gameId: 'ABC123', playerId: 'p1', status: 'PLACING_SHIPS' }),
  joinGame: vi.fn().mockResolvedValue({ gameId: 'ABC123', playerId: 'p2', status: 'PLACING_SHIPS' }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

// ---- usePlayerIdentity mock ----
type IdentityStatus = 'loading' | 'identified' | 'needs-name';

const defaultReturn = {
  player: null as Player | null,
  status: 'needs-name' as IdentityStatus,
  isOptimistic: false,
  createPlayer: vi.fn(),
  error: null as string | null,
};

vi.mock('../../hooks/usePlayerIdentity', () => ({
  usePlayerIdentity: vi.fn(() => ({ ...defaultReturn })),
}));

import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';

function mockIdentity(overrides: Partial<typeof defaultReturn>) {
  vi.mocked(usePlayerIdentity).mockReturnValue({ ...defaultReturn, ...overrides });
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(usePlayerIdentity).mockReturnValue({ ...defaultReturn });
});

describe('Home — renders required elements', () => {
  it('renders Create Game button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /create game/i })).toBeInTheDocument();
  });

  it('renders Play vs Computer button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /play vs computer/i })).toBeInTheDocument();
  });

  it('renders Join Game submit button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
  });
});

describe('Home — identity gate (AC-01, AC-15)', () => {
  it('disables Create Game, Play vs Computer, and Join Game buttons when status is needs-name', () => {
    mockIdentity({ status: 'needs-name' });
    renderHome();

    expect(screen.getByRole('button', { name: /create game/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /join game/i })).toBeDisabled();
  });

  it('enables game-start buttons when status is identified (AC-01)', () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();

    expect(screen.getByRole('button', { name: /create game/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /play vs computer/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /join game/i })).not.toBeDisabled();
  });

  it('enables game-start buttons optimistically when status is loading (UX Expectations)', () => {
    // While background GET /players runs, buttons stay enabled — only downgrade to
    // disabled if the backend returns 404 (needs-name). Loading is not a blocking state.
    mockIdentity({ status: 'loading' });
    renderHome();

    expect(screen.getByRole('button', { name: /create game/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /play vs computer/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /join game/i })).not.toBeDisabled();
  });
});

describe('Home — name-entry form visibility (AC-01)', () => {
  it('shows the PlayerNameEntry form when status is needs-name', () => {
    mockIdentity({ status: 'needs-name' });
    renderHome();
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
  });

  it('hides the PlayerNameEntry form when status is identified', () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
  });

  it('hides the PlayerNameEntry form when status is loading', () => {
    mockIdentity({ status: 'loading' });
    renderHome();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
  });
});

describe('Home — welcome banner (AC-07)', () => {
  it('shows the welcome banner with display name when identified', () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('does not show the welcome banner when status is needs-name', () => {
    mockIdentity({ status: 'needs-name' });
    renderHome();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
  });

  it('does not show the welcome banner when status is loading', () => {
    mockIdentity({ status: 'loading' });
    renderHome();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
  });
});

describe('Home — inline validation errors passed through PlayerNameEntry (AC-02–04)', () => {
  it('passes DISPLAY_NAME_REQUIRED error code', () => {
    mockIdentity({ status: 'needs-name', error: 'DISPLAY_NAME_REQUIRED' });
    renderHome();
    expect(screen.getByRole('alert')).toHaveTextContent('Display name is required');
  });

  it('passes DISPLAY_NAME_TOO_LONG error code', () => {
    mockIdentity({ status: 'needs-name', error: 'DISPLAY_NAME_TOO_LONG' });
    renderHome();
    expect(screen.getByRole('alert')).toHaveTextContent('Display name must be 30 characters or fewer');
  });

  it('passes DISPLAY_NAME_INVALID_CHARS error code', () => {
    mockIdentity({ status: 'needs-name', error: 'DISPLAY_NAME_INVALID_CHARS' });
    renderHome();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Display name may only contain letters, numbers, spaces, hyphens, and underscores',
    );
  });
});
