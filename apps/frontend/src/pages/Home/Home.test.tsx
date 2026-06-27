import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import type { Player } from '../../types/game';

// Mock the API layer — this is the UI agent's boundary (no HTTP in component tests).
vi.mock('../../api/gameApi', () => ({
  createGame: vi.fn().mockResolvedValue({
    gameId: 'ABC123', playerId: 'p1', status: 'PLACING_SHIPS', sessionToken: 'tok-mint',
  }),
  stopGame: vi.fn().mockResolvedValue(undefined),
  restoreGameByCode: vi.fn(),
  GameNotFoundError: class GameNotFoundError extends Error {},
}));

// Belonging probe hook (data layer, owned by frontend-api-agent) — mocked at the UI boundary.
// Default outcome 'cleared' so Home renders a clean default (no popup) unless a test arms it.
const probeMock = vi.fn().mockResolvedValue('cleared');
vi.mock('../../hooks/useBelongingProbe', () => ({
  useBelongingProbe: vi.fn(() => ({ probe: probeMock, isProbing: false })),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

// Restore-by-code hook (data layer) is mocked — the UI agent owns nav/pointer wiring only.
const restoreSubmitMock = vi.fn();
const restoreState = {
  submit: restoreSubmitMock,
  data: null as unknown,
  isLoading: false,
  notFound: false,
  error: null as string | null,
};
vi.mock('../../hooks/useRestoreGame', () => ({
  useRestoreGame: vi.fn(() => restoreState),
}));

// Resume sequence hook (data layer) — mocked so the modal's Yes/Resume path never hits HTTP.
const resumeMock = vi.fn();
vi.mock('../../hooks/useResumeGame', () => ({
  useResumeGame: vi.fn(() => ({ resume: resumeMock, isResuming: false })),
}));

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
  localStorage.clear();
  navigateMock.mockClear();
  restoreSubmitMock.mockReset();
  restoreState.notFound = false;
  restoreState.error = null;
  restoreState.isLoading = false;
  resumeMock.mockReset();
  probeMock.mockReset();
  probeMock.mockResolvedValue('cleared');
  vi.mocked(usePlayerIdentity).mockReturnValue({ ...defaultReturn });
});

// Belonging-record helper: writes the active-game pointer localStorage blob the real
// useActiveGame reads. `token` controls step-1 eligibility (empty = no belonging).
const ACTIVE_GAME_KEY = 'battleship_active_game';
function setBelonging(token: string, gameId = 'G1', gameMode: 'COMPUTER' | 'HUMAN' = 'COMPUTER') {
  localStorage.setItem(
    ACTIVE_GAME_KEY,
    JSON.stringify({ gameId, playerId: 'pX', gameMode, sessionToken: token }),
  );
}

describe('Home — renders required elements', () => {
  it('renders Play vs Computer button', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /play vs computer/i })).toBeInTheDocument();
  });

  it('renders the Restore Game submit button and code input (AC-7)', () => {
    renderHome();
    expect(screen.getByRole('button', { name: /restore game/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Game code')).toBeInTheDocument();
  });

  it('renders the disabled Coming Soon multiplayer button (AC-14)', () => {
    renderHome();
    const btn = screen.getByRole('button', { name: /play against another user/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/coming soon/i);
  });
});

describe('Home — identity gate (AC-01, AC-15)', () => {
  it('disables Play vs Computer when status is needs-name', () => {
    mockIdentity({ status: 'needs-name' });
    renderHome();
    expect(screen.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });

  it('enables Play vs Computer when status is identified (AC-01)', () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();
    expect(screen.getByRole('button', { name: /play vs computer/i })).not.toBeDisabled();
  });

  it('enables Play vs Computer optimistically when status is loading (UX Expectations)', () => {
    // While background GET /players runs, buttons stay enabled — only downgrade to
    // disabled if the backend returns 404 (needs-name). Loading is not a blocking state.
    mockIdentity({ status: 'loading' });
    renderHome();
    expect(screen.getByRole('button', { name: /play vs computer/i })).not.toBeDisabled();
  });

  it('keeps the multiplayer button disabled regardless of identity (AC-14)', () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();
    expect(screen.getByRole('button', { name: /play against another user/i })).toBeDisabled();
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

describe('Home — restore-by-code (AC-7/8/9/10)', () => {
  function identified() {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
  }

  it('empty submit shows a gentle validation hint and does not navigate (empty-code edge case)', async () => {
    identified();
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    expect(screen.getByText(/please enter a game code/i)).toBeInTheDocument();
    expect(restoreSubmitMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('trims whitespace before calling submit (AC-8 whitespace edge case)', async () => {
    identified();
    restoreSubmitMock.mockResolvedValue({
      gameId: 'ABC123', playerId: 'p1', gameMode: 'COMPUTER', status: 'IN_PROGRESS',
    });
    renderHome();
    // Input is capped at 6 chars; type surrounding spaces that survive the cap so trimming
    // is exercised (' ab12 ' → 'ab12').
    await userEvent.type(screen.getByLabelText('Game code'), ' ab12 ');
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    // Restore is now a belonging probe: code plus the caller's own playerId + sessionToken
    // (empty here — a fresh browser with no stored belonging, which the backend 404s).
    expect(restoreSubmitMock).toHaveBeenCalledWith('ab12', '', '');
  });

  it('valid IN_PROGRESS code navigates to /game (AC-8)', async () => {
    identified();
    restoreSubmitMock.mockResolvedValue({
      gameId: 'ABC123', playerId: 'p1', gameMode: 'COMPUTER', status: 'IN_PROGRESS',
    });
    renderHome();
    await userEvent.type(screen.getByLabelText('Game code'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/game'));
  });

  it('valid PLACING_SHIPS code navigates to /lobby (AC-8)', async () => {
    identified();
    restoreSubmitMock.mockResolvedValue({
      gameId: 'ABC123', playerId: 'p1', gameMode: 'COMPUTER', status: 'PLACING_SHIPS',
    });
    renderHome();
    await userEvent.type(screen.getByLabelText('Game code'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/lobby'));
  });

  it('not-found code shows the inline message and stays on Home — no nav (AC-9/AC-10)', async () => {
    identified();
    // useRestoreGame resolves null and sets notFound on a 404 (does not throw).
    restoreSubmitMock.mockResolvedValue(null);
    restoreState.notFound = true;
    renderHome();
    await userEvent.type(screen.getByLabelText('Game code'), 'NOPE12');
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    expect(await screen.findByText(/game not found or no longer available/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('transient error message renders inline and stays on Home', async () => {
    identified();
    restoreSubmitMock.mockRejectedValue(new Error('Network down'));
    restoreState.error = 'Network down';
    renderHome();
    await userEvent.type(screen.getByLabelText('Game code'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /restore game/i }));
    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('Home — resume-popup belonging gating (AC-1/AC-2/AC-8/AC-12/AC-13)', () => {
  function identified() {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
  }

  it('no belonging record at all → no probe, no popup (AC-1)', async () => {
    identified();
    renderHome();
    // No pointer in localStorage → step 1 fails → probe never called, dialog never shows.
    await waitFor(() => expect(probeMock).not.toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pointer WITHOUT a sessionToken → never popup-eligible, probe not called (AC-2/AC-8)', async () => {
    identified();
    setBelonging(''); // a browser that merely typed a code: pointer exists, token empty
    renderHome();
    // Step 1 (non-empty token) fails, so the probe is never run and the popup never shows —
    // knowing a code is not belonging.
    await waitFor(() => expect(probeMock).not.toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('token present but probe NOT eligible (cleared) → no popup (AC-12/AC-13)', async () => {
    identified();
    setBelonging('tok-1');
    probeMock.mockResolvedValue('cleared');
    renderHome();
    await waitFor(() => expect(probeMock).toHaveBeenCalled());
    // Probe ran but reported the seat is gone/terminal/not-owned → no popup, record cleared.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull();
  });

  it('token present AND probe eligible → popup shown (AC-3)', async () => {
    identified();
    setBelonging('tok-1');
    probeMock.mockResolvedValue('eligible');
    renderHome();
    // Only after a successful belonging probe does the personal welcome-back dialog appear.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(probeMock).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 'G1', sessionToken: 'tok-1' }),
    );
  });

  it('404/not-owned probe (cleared) quietly clears the stale record, clean Home, no error (AC-13)', async () => {
    identified();
    setBelonging('stale-tok');
    probeMock.mockResolvedValue('cleared');
    renderHome();
    await waitFor(() => expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBeNull());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // No blocking error surfaced — stale belonging resolves silently to a clean Home.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('5xx/network probe (transient) PRESERVES the record and shows no popup (Error States)', async () => {
    identified();
    setBelonging('tok-1');
    probeMock.mockResolvedValue('transient');
    renderHome();
    await waitFor(() => expect(probeMock).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Belonging is never downgraded by a connectivity blip — record stays for a later retry.
    expect(localStorage.getItem(ACTIVE_GAME_KEY)).not.toBeNull();
  });
});

describe('Home — code popup on computer-game start (AC-5/AC-6)', () => {
  it('shows the code popup after creating a computer game, then proceeds on acknowledge', async () => {
    mockIdentity({
      status: 'identified',
      player: { playerId: 'uuid-123', displayName: 'Alex', createdAt: '2026-01-01T00:00:00Z' },
    });
    renderHome();
    await userEvent.click(screen.getByRole('button', { name: /play vs computer/i }));
    // Popup appears with the code (createGame mock returns gameId 'ABC123').
    expect(await screen.findByText(/save your game code/i)).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    // Acknowledging proceeds into the game (computer game starts in the lobby).
    await userEvent.click(screen.getByRole('button', { name: /got it, start playing/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/lobby'));
  });
});
