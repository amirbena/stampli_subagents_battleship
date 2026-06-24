import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FiringIndicator } from './FiringIndicator';

describe('FiringIndicator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when inactive (AC6)', () => {
    const { container } = render(<FiringIndicator active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Firing…" when active (AC5)', () => {
    render(<FiringIndicator active />);
    expect(screen.getByText(/Firing…/)).toBeInTheDocument();
  });

  it('increments the elapsed-second counter while active', () => {
    render(<FiringIndicator active />);
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.getByText(/Firing… 1s/)).toBeInTheDocument();
  });
});
