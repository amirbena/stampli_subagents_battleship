import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';

vi.mock('../../api/gameApi', () => ({
  createGame: vi.fn().mockResolvedValue({ gameId: 'ABC123', playerId: 'p1', status: 'PLACING_SHIPS' }),
  joinGame: vi.fn().mockResolvedValue({ gameId: 'ABC123', playerId: 'p2', status: 'PLACING_SHIPS' }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => vi.fn() };
});

beforeEach(() => {
  sessionStorage.clear();
});

describe('Home', () => {
  it('renders Create Game button', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /create game/i })).toBeInTheDocument();
  });

  it('renders Play vs Computer button', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /play vs computer/i })).toBeInTheDocument();
  });

  it('renders Join Game submit button', () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /join game/i })).toBeInTheDocument();
  });
});
