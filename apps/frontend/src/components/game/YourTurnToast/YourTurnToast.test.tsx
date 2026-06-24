import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { YourTurnToast } from './YourTurnToast';

describe('YourTurnToast', () => {
  it('renders the "Your turn!" message', () => {
    render(<YourTurnToast />);
    expect(screen.getByText(/your turn!/i)).toBeInTheDocument();
  });

  it('exposes a status role for screen readers', () => {
    render(<YourTurnToast />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
