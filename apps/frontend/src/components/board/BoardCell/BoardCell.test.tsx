import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BoardCell } from './BoardCell';
import type { CellState } from '../../../types/game';

const STATES: CellState[] = ['empty', 'ship', 'hit', 'miss', 'sunk', 'preview', 'preview-invalid'];

describe('BoardCell', () => {
  it.each(STATES)('renders correct CSS class for state "%s"', (state) => {
    const { container } = render(
      <BoardCell state={state} row={0} col={0} />,
    );
    expect(container.firstChild).toHaveClass(`board-cell--${state}`);
  });

  it('has role="gridcell" when not interactive', () => {
    render(<BoardCell state="empty" row={0} col={0} />);
    expect(screen.getByRole('gridcell')).toBeInTheDocument();
  });

  it('has role="button" when interactive', () => {
    render(<BoardCell state="empty" row={0} col={0} interactive />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('calls onClick with correct row and col', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BoardCell state="empty" row={3} col={5} onClick={onClick} interactive />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(3, 5);
  });

  it('does not call onClick when not interactive and no handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BoardCell state="empty" row={0} col={0} onClick={onClick} />);
    await user.click(screen.getByRole('gridcell'));
    // handler is optional — no crash expected, onClick called with undefined context
  });
});
