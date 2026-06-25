import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WelcomeBanner } from './WelcomeBanner';

describe('WelcomeBanner', () => {
  it('renders the welcome message with the display name (AC-07)', () => {
    render(<WelcomeBanner displayName="Alex" />);
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders the displayName inside a strong element for visual emphasis', () => {
    render(<WelcomeBanner displayName="TestPlayer" />);
    const strong = screen.getByText('TestPlayer');
    expect(strong.tagName).toBe('STRONG');
  });

  it('uses aria-live so returning-visit announcement is accessible', () => {
    const { container } = render(<WelcomeBanner displayName="Alex" />);
    const el = container.querySelector('[aria-live]');
    expect(el).toBeInTheDocument();
  });
});
