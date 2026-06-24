import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { GlobalLoader } from './GlobalLoader';

// Control the store directly: capture the subscriber so tests can push updates.
let notify: (() => void) | null = null;
let mockVisible = false;

vi.mock('../../../api/gameApi', () => ({
  subscribeActiveRequests: (listener: () => void) => {
    notify = listener;
    return () => { notify = null; };
  },
  isLoaderVisible: () => mockVisible,
}));

function setVisible(v: boolean) {
  mockVisible = v;
  notify?.();
}

beforeEach(() => {
  mockVisible = false;
  notify = null;
});

describe('GlobalLoader', () => {
  it('renders nothing when the store reports not visible', () => {
    render(<GlobalLoader />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the loading bar when the store reports visible', () => {
    mockVisible = true;
    render(<GlobalLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows the bar when the store transitions to visible', () => {
    render(<GlobalLoader />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => setVisible(true));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('hides the bar when the store transitions back to not visible', () => {
    mockVisible = true;
    render(<GlobalLoader />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => setVisible(false));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
