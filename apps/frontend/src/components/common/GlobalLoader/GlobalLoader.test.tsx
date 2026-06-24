import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GlobalLoader } from './GlobalLoader';

// Mock the hook so tests control the activeRequests count directly without
// needing a real axios instance or useSyncExternalStore subscription.
const mockUseActiveRequests = vi.fn<() => number>();

vi.mock('../../../hooks/useActiveRequests', () => ({
  useActiveRequests: () => mockUseActiveRequests(),
}));

describe('GlobalLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseActiveRequests.mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // (a) Shows immediately when activeRequests > 0
  it('renders the loading bar when there are active requests', () => {
    mockUseActiveRequests.mockReturnValue(1);
    render(<GlobalLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders nothing when activeRequests is 0 and no requests have ever been made', () => {
    mockUseActiveRequests.mockReturnValue(0);
    render(<GlobalLoader />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // (b) Hides after 300ms delay when activeRequests drops back to 0
  it('stays visible immediately after activeRequests drops to 0, then hides after 300ms', () => {
    mockUseActiveRequests.mockReturnValue(1);
    const { rerender } = render(<GlobalLoader />);

    // Confirm visible with an active request
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Simulate the request completing
    mockUseActiveRequests.mockReturnValue(0);
    rerender(<GlobalLoader />);

    // Should still be visible before the 300ms timer fires
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Advance time past the 300ms threshold
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now it should be hidden
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not hide before 300ms have elapsed', () => {
    mockUseActiveRequests.mockReturnValue(1);
    const { rerender } = render(<GlobalLoader />);

    mockUseActiveRequests.mockReturnValue(0);
    rerender(<GlobalLoader />);

    // 299ms — still visible
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // 1ms more (total 300ms) — now hidden
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // (c) Stays visible if a new request starts before the 300ms timer fires (timer cancelled)
  it('stays visible if a new request arrives before the hide timer fires', () => {
    mockUseActiveRequests.mockReturnValue(1);
    const { rerender } = render(<GlobalLoader />);

    // Request completes — hide timer starts
    mockUseActiveRequests.mockReturnValue(0);
    rerender(<GlobalLoader />);

    // A new request starts at 150ms (before the 300ms timer fires)
    act(() => {
      vi.advanceTimersByTime(150);
    });
    mockUseActiveRequests.mockReturnValue(1);
    rerender(<GlobalLoader />);

    // Advance well past the original 300ms mark — bar must still be visible because
    // the original hide timer was cancelled when the new request arrived.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides 300ms after the second request also completes', () => {
    mockUseActiveRequests.mockReturnValue(1);
    const { rerender } = render(<GlobalLoader />);

    // First request completes, timer starts
    mockUseActiveRequests.mockReturnValue(0);
    rerender(<GlobalLoader />);

    // Second request arrives at 150ms, cancelling the hide timer
    act(() => {
      vi.advanceTimersByTime(150);
    });
    mockUseActiveRequests.mockReturnValue(1);
    rerender(<GlobalLoader />);

    // Second request completes — a fresh 300ms timer starts
    mockUseActiveRequests.mockReturnValue(0);
    rerender(<GlobalLoader />);

    // At 299ms after the second completion: still visible
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // At 300ms after the second completion: hidden
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
