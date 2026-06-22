import React from 'react';
import { BoardCell } from './BoardCell';
import type { CellState, Coordinate } from '../../types/game';
import { coordKey } from '../../utils/boardHelpers';

interface GameBoardProps {
  cells: CellState[][];
  onCellClick?: (row: number, col: number) => void;
  onCellHover?: (row: number, col: number) => void;
  onMouseLeave?: () => void;
  previewCells?: Coordinate[];
  previewValid?: boolean;
  interactive?: boolean;
  label?: string;
}

export function GameBoard({
  cells,
  onCellClick,
  onCellHover,
  onMouseLeave,
  previewCells = [],
  previewValid = true,
  interactive = false,
  label,
}: GameBoardProps): React.ReactElement {
  const previewSet = new Set(previewCells.map(coordKey));

  const colLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  return (
    <div className="game-board-wrapper">
      {label && <div className="game-board-label">{label}</div>}
      <div className="game-board" role="grid" aria-label={label ?? 'Battleship board'}>
        {/* Column headers */}
        <div className="board-row board-row--header">
          <div className="board-corner" />
          {colLabels.map((l) => (
            <div key={l} className="board-header-cell">{l}</div>
          ))}
        </div>
        {cells.map((row, r) => (
          <div key={r} className="board-row">
            <div className="board-row-label">{r + 1}</div>
            {row.map((cellState, c) => {
              const key = coordKey({ row: r, col: c });
              const inPreview = previewSet.has(key);
              const effectiveState: CellState = inPreview
                ? previewValid ? 'preview' : 'preview-invalid'
                : cellState;
              return (
                <BoardCell
                  key={key}
                  state={effectiveState}
                  row={r}
                  col={c}
                  onClick={onCellClick}
                  onMouseEnter={onCellHover}
                  onMouseLeave={onMouseLeave}
                  interactive={interactive}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
