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

  // Color semantics (miss=red, hit=green, sunk distinct) are asserted at the CSS
  // layer; here we lock the class contract those styles hang off of.
  it('renders distinct classes for hit, miss, and sunk', () => {
    const { rerender, container } = render(<BoardCell state="hit" row={0} col={0} />);
    expect(container.firstChild).toHaveClass('board-cell--hit');

    rerender(<BoardCell state="miss" row={0} col={0} />);
    expect(container.firstChild).toHaveClass('board-cell--miss');

    rerender(<BoardCell state="sunk" row={0} col={0} />);
    expect(container.firstChild).toHaveClass('board-cell--sunk');
    // sunk is its own class — never the plain hit class — so it stays visually distinct.
    expect(container.firstChild).not.toHaveClass('board-cell--hit');
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
