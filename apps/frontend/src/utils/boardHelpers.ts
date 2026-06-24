import type { BoardStateDto, CellState, Coordinate, ShipType } from '../types/game';

export function computeOwnBoardCells(board: BoardStateDto): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () =>
    Array<CellState>(10).fill('empty'),
  );

  for (const ship of board.ships) {
    const sunkSet = new Set(ship.hits.map(coordKey));
    for (const cell of ship.cells) {
      if (ship.sunk) {
        grid[cell.row][cell.col] = 'sunk';
      } else if (sunkSet.has(coordKey(cell))) {
        grid[cell.row][cell.col] = 'hit';
      } else {
        grid[cell.row][cell.col] = 'ship';
      }
    }
  }

  for (const miss of board.missedShots) {
    grid[miss.row][miss.col] = 'miss';
  }

  return grid;
}

export function computeOpponentBoardCells(board: BoardStateDto): CellState[][] {
  const grid: CellState[][] = Array.from({ length: 10 }, () =>
    Array<CellState>(10).fill('empty'),
  );

  // Requester's own non-sunk hits (green). Painted first so the sunk-ship loop
  // below can upgrade any cell that has since become part of a destroyed ship.
  for (const hit of board.hits) {
    grid[hit.row][hit.col] = 'hit';
  }

  // Requester's own misses (red). Disjoint from hits by construction — a single
  // coordinate has exactly one shot result — so miss and hit never collide.
  for (const miss of board.missedShots) {
    grid[miss.row][miss.col] = 'miss';
  }

  // Only sunk ships are present in opponentBoard per sanitization rule. Runs last
  // so a destroyed ship's cells render as 'sunk' (distinct from a plain 'hit'),
  // never downgraded back to 'hit'.
  for (const ship of board.ships) {
    for (const cell of ship.cells) {
      grid[cell.row][cell.col] = 'sunk';
    }
  }

  return grid;
}

export function coordKey(c: Coordinate): string {
  return `${c.row},${c.col}`;
}

export function getShipCells(
  anchor: Coordinate,
  size: number,
  orientation: 'HORIZONTAL' | 'VERTICAL',
): Coordinate[] {
  const cells: Coordinate[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      orientation === 'HORIZONTAL'
        ? { row: anchor.row, col: anchor.col + i }
        : { row: anchor.row + i, col: anchor.col },
    );
  }
  return cells;
}

export function getSunkShipTypes(board: BoardStateDto): ShipType[] {
  return board.ships.filter((s) => s.sunk).map((s) => s.shipType);
}
