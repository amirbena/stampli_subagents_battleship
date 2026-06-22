import type { Coordinate, ShipDto, ShipType } from '../types/game';
import { SHIP_SIZES } from '../types/game';
import { getShipCells, coordKey } from './boardHelpers';

export function isValidPlacement(
  shipType: ShipType,
  anchor: Coordinate,
  orientation: 'HORIZONTAL' | 'VERTICAL',
  existingShips: ShipDto[],
): boolean {
  const size = SHIP_SIZES[shipType];
  const cells = getShipCells(anchor, size, orientation);

  // Bounds check
  for (const cell of cells) {
    if (cell.row < 0 || cell.row > 9 || cell.col < 0 || cell.col > 9) {
      return false;
    }
  }

  // Overlap check
  const occupied = new Set<string>();
  for (const ship of existingShips) {
    for (const cell of ship.cells) {
      occupied.add(coordKey(cell));
    }
  }

  for (const cell of cells) {
    if (occupied.has(coordKey(cell))) {
      return false;
    }
  }

  return true;
}

export function getPreviewCells(
  anchor: Coordinate,
  shipType: ShipType,
  orientation: 'HORIZONTAL' | 'VERTICAL',
  existingShips: ShipDto[],
): { cells: Coordinate[]; valid: boolean } {
  const size = SHIP_SIZES[shipType];
  const cells = getShipCells(anchor, size, orientation);
  const valid = isValidPlacement(shipType, anchor, orientation, existingShips);
  return { cells, valid };
}
