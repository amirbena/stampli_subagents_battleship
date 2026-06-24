import { describe, it, expect } from 'vitest';
import { computeOpponentBoardCells } from './boardHelpers';
import type { BoardStateDto } from '../types/game';

function board(overrides: Partial<BoardStateDto> = {}): BoardStateDto {
  return { ships: [], missedShots: [], hits: [], ...overrides };
}

describe('computeOpponentBoardCells — hit rendering', () => {
  it('maps each hits coordinate to "hit" (AC-7)', () => {
    const grid = computeOpponentBoardCells(board({ hits: [{ row: 2, col: 3 }] }));
    expect(grid[2][3]).toBe('hit');
  });

  it('keeps un-fired cells empty — never leaks ship outline', () => {
    const grid = computeOpponentBoardCells(board({ hits: [{ row: 0, col: 0 }] }));
    expect(grid[0][1]).toBe('empty');
    expect(grid[5][5]).toBe('empty');
  });

  it('renders misses as "miss" (AC-9)', () => {
    const grid = computeOpponentBoardCells(board({ missedShots: [{ row: 4, col: 4 }] }));
    expect(grid[4][4]).toBe('miss');
  });

  it('lets hit and miss coexist without collision', () => {
    const grid = computeOpponentBoardCells(
      board({ hits: [{ row: 1, col: 1 }], missedShots: [{ row: 2, col: 2 }] }),
    );
    expect(grid[1][1]).toBe('hit');
    expect(grid[2][2]).toBe('miss');
  });

  it('gives sunk priority over a previously-hit cell (AC-8/AC-16 upgrade)', () => {
    // The sinking shot cell appears in BOTH hits and the sunk ship's cells.
    // Sunk must win so the cell renders distinct from a plain hit.
    const grid = computeOpponentBoardCells(
      board({
        hits: [{ row: 3, col: 3 }],
        ships: [
          {
            shipType: 'DESTROYER',
            cells: [
              { row: 3, col: 3 },
              { row: 3, col: 4 },
            ],
            hits: [
              { row: 3, col: 3 },
              { row: 3, col: 4 },
            ],
            sunk: true,
          },
        ],
      }),
    );
    expect(grid[3][3]).toBe('sunk');
    expect(grid[3][4]).toBe('sunk');
  });

  it('renders all three marker types together correctly', () => {
    const grid = computeOpponentBoardCells(
      board({
        hits: [{ row: 0, col: 0 }],
        missedShots: [{ row: 9, col: 9 }],
        ships: [
          { shipType: 'DESTROYER', cells: [{ row: 5, col: 5 }], hits: [{ row: 5, col: 5 }], sunk: true },
        ],
      }),
    );
    expect(grid[0][0]).toBe('hit');
    expect(grid[9][9]).toBe('miss');
    expect(grid[5][5]).toBe('sunk');
  });
});
