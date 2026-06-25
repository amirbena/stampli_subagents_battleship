import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameSessionControls } from './GameSessionControls';

describe('GameSessionControls (AC-8 / AC-9)', () => {
  it('renders distinct Pause and Stop buttons (not confusable)', () => {
    render(<GameSessionControls onPause={vi.fn()} onStop={vi.fn()} />);
    const pause = screen.getByRole('button', { name: /pause/i });
    const stop = screen.getByRole('button', { name: /stop/i });
    expect(pause).toBeInTheDocument();
    expect(stop).toBeInTheDocument();
    // Stop carries danger weight so it is visually distinct from Pause.
    expect(stop).toHaveClass('btn--danger');
    expect(pause).not.toHaveClass('btn--danger');
  });

  it('fires onPause when Pause is clicked (AC-8)', () => {
    const onPause = vi.fn();
    render(<GameSessionControls onPause={onPause} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('fires onStop when Stop is clicked (AC-9)', () => {
    const onStop = vi.fn();
    render(<GameSessionControls onPause={vi.fn()} onStop={onStop} />);
    fireEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy', () => {
    render(<GameSessionControls onPause={vi.fn()} onStop={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /stop/i })).toBeDisabled();
  });
});
