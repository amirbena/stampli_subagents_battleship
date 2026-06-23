import React from 'react';
import type { CellState } from '../../../types/game';
import './BoardCell.css';

interface BoardCellProps {
  state: CellState;
  row: number;
  col: number;
  onClick?: (row: number, col: number) => void;
  onMouseEnter?: (row: number, col: number) => void;
  onMouseLeave?: () => void;
  interactive?: boolean;
}

export function BoardCell({
  state,
  row,
  col,
  onClick,
  onMouseEnter,
  onMouseLeave,
  interactive = false,
}: BoardCellProps): React.ReactElement {
  const handleClick = () => onClick?.(row, col);
  const handleMouseEnter = () => onMouseEnter?.(row, col);

  return (
    <div
      className={`board-cell board-cell--${state}${interactive ? ' board-cell--interactive' : ''}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={handleClick}
      role={interactive ? 'button' : 'gridcell'}
      aria-label={`Row ${row + 1} Col ${col + 1}: ${state}`}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
    />
  );
}
