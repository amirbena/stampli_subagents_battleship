import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnIndicator } from './TurnIndicator';

describe('TurnIndicator', () => {
  it('shows waiting message when opponent is not ready', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={false} />);
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('shows "Your Turn" when it is my turn and opponent is ready', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={true} />);
    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
  });

  it('shows opponent turn message when it is not my turn', () => {
    render(<TurnIndicator isMyTurn={false} opponentReady={true} />);
    expect(screen.getByText(/opponent's turn/i)).toBeInTheDocument();
  });

  it('applies my-turn CSS class when it is my turn', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={true} />);
    expect(container.firstChild).toHaveClass('turn-indicator--my-turn');
  });

  it('applies opponent-turn CSS class when it is not my turn', () => {
    const { container } = render(<TurnIndicator isMyTurn={false} opponentReady={true} />);
    expect(container.firstChild).toHaveClass('turn-indicator--opponent-turn');
  });

  it('applies waiting CSS class when opponent is not ready', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={false} />);
    expect(container.firstChild).toHaveClass('turn-indicator--waiting');
  });
});
