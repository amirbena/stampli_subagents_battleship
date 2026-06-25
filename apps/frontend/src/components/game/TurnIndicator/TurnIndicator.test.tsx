import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnIndicator } from './TurnIndicator';

describe('TurnIndicator', () => {
  it('shows waiting message when opponent is not ready', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={false} firing={false} />);
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('shows "Your Turn" when it is my turn, opponent is ready, and no shot in flight', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={true} firing={false} />);
    expect(screen.getByText(/your turn/i)).toBeInTheDocument();
  });

  it('hides "Your Turn" message when it is my turn but a shot is in flight', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={true} firing={true} />);
    expect(screen.queryByText(/your turn/i)).not.toBeInTheDocument();
  });

  it('shows opponent turn message when it is not my turn and no shot in flight', () => {
    render(<TurnIndicator isMyTurn={false} opponentReady={true} firing={false} />);
    expect(screen.getByText(/opponent's turn/i)).toBeInTheDocument();
  });

  it('applies my-turn CSS class when it is my turn and firing is false', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={true} firing={false} />);
    expect(container.firstChild).toHaveClass('turn-indicator--my-turn');
  });

  it('applies opponent-turn CSS class when it is my turn but firing is true', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={true} firing={true} />);
    expect(container.firstChild).toHaveClass('turn-indicator--opponent-turn');
  });

  it('applies opponent-turn CSS class when it is not my turn', () => {
    const { container } = render(<TurnIndicator isMyTurn={false} opponentReady={true} firing={false} />);
    expect(container.firstChild).toHaveClass('turn-indicator--opponent-turn');
  });

  it('applies waiting CSS class when opponent is not ready', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={false} firing={false} />);
    expect(container.firstChild).toHaveClass('turn-indicator--waiting');
  });
});
