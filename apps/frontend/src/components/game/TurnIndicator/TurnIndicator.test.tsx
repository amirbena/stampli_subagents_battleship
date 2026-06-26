import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TurnIndicator } from './TurnIndicator';

describe('TurnIndicator', () => {
  it('shows waiting message when opponent is not ready', () => {
    render(<TurnIndicator isMyTurn={true} opponentReady={false} />);
    expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
  });

  it('renders nothing persistent when it is my turn and opponent is ready', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={true} />);
    expect(screen.queryByText(/your turn/i)).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows opponent turn message when it is not my turn', () => {
    render(<TurnIndicator isMyTurn={false} opponentReady={true} />);
    expect(screen.getByText(/opponent's turn/i)).toBeInTheDocument();
  });

  it('renders no turn-indicator element when it is my turn', () => {
    const { container } = render(<TurnIndicator isMyTurn={true} opponentReady={true} />);
    expect(container.querySelector('.turn-indicator')).toBeNull();
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
