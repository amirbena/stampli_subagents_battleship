import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CantShootToast } from './CantShootToast';
import { CANT_SHOOT_NOTICE_MS } from '../../../utils/turnTiming';

describe('CantShootToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing at the initial idle trigger (0)', () => {
    render(<CantShootToast trigger={0} />);
    expect(screen.queryByText(/can't shoot/i)).toBeNull();
  });

  it('shows the notice when the trigger becomes non-zero', () => {
    const { rerender } = render(<CantShootToast trigger={0} />);
    rerender(<CantShootToast trigger={1} />);
    expect(screen.getByText(/can't shoot — computer is playing/i)).toBeInTheDocument();
  });

  it('auto-dismisses after the notice duration', () => {
    const { rerender } = render(<CantShootToast trigger={0} />);
    rerender(<CantShootToast trigger={1} />);
    expect(screen.getByText(/can't shoot/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(CANT_SHOOT_NOTICE_MS); });
    expect(screen.queryByText(/can't shoot/i)).toBeNull();
  });

  it('re-shows and resets the timer when the trigger changes again', () => {
    const { rerender } = render(<CantShootToast trigger={0} />);
    rerender(<CantShootToast trigger={1} />);

    // Let it almost time out, then a new click (trigger bump) refreshes it.
    act(() => { vi.advanceTimersByTime(CANT_SHOOT_NOTICE_MS - 100); });
    rerender(<CantShootToast trigger={2} />);
    expect(screen.getByText(/can't shoot/i)).toBeInTheDocument();

    // Old timer would have fired here; the refreshed notice is still visible.
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.getByText(/can't shoot/i)).toBeInTheDocument();

    // Cleared a full duration after the latest trigger.
    act(() => { vi.advanceTimersByTime(CANT_SHOOT_NOTICE_MS); });
    expect(screen.queryByText(/can't shoot/i)).toBeNull();
  });

  it('exposes a status role for screen readers', () => {
    const { rerender } = render(<CantShootToast trigger={0} />);
    rerender(<CantShootToast trigger={1} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
