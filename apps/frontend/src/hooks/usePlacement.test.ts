import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlacement } from './usePlacement';
import type { ShipDto, ShipType } from '../types/game';
import { SHIP_SIZES } from '../types/game';

/** Builds a horizontal ShipDto anchored at the given row, as the server would persist it. */
function makeShip(shipType: ShipType, row: number): ShipDto {
  const size = SHIP_SIZES[shipType];
  const cells = Array.from({ length: size }, (_, col) => ({ row, col }));
  return { shipType, cells, hits: [], sunk: false };
}

const FULL_FLEET: ShipDto[] = [
  makeShip('CARRIER', 0),
  makeShip('BATTLESHIP', 2),
  makeShip('CRUISER', 4),
  makeShip('SUBMARINE', 6),
  makeShip('DESTROYER', 8),
];

const PARTIAL_FLEET: ShipDto[] = [makeShip('CARRIER', 0), makeShip('DESTROYER', 8)];

describe('usePlacement', () => {
  it('starts with all ships remaining and nothing placed', () => {
    const { result } = renderHook(() => usePlacement());
    expect(result.current.placedShips).toHaveLength(0);
    expect(result.current.remainingShips).toHaveLength(5);
    expect(result.current.allPlaced).toBe(false);
  });

  it('starts with HORIZONTAL orientation', () => {
    const { result } = renderHook(() => usePlacement());
    expect(result.current.orientation).toBe('HORIZONTAL');
  });

  it('toggleOrientation switches to VERTICAL then back', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.toggleOrientation());
    expect(result.current.orientation).toBe('VERTICAL');
    act(() => result.current.toggleOrientation());
    expect(result.current.orientation).toBe('HORIZONTAL');
  });

  it('placeShip returns null when no ship is selected', () => {
    const { result } = renderHook(() => usePlacement());
    let placed: ReturnType<typeof result.current.placeShip>;
    act(() => { placed = result.current.placeShip({ row: 0, col: 0 }); });
    expect(placed!).toBeNull();
  });

  it('places a ship and removes it from remainingShips', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.selectShip('DESTROYER'));
    act(() => { result.current.placeShip({ row: 0, col: 0 }); });
    expect(result.current.placedShips).toHaveLength(1);
    expect(result.current.remainingShips).not.toContain('DESTROYER');
  });

  it('removeShip puts the ship back in remainingShips', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.selectShip('DESTROYER'));
    act(() => { result.current.placeShip({ row: 0, col: 0 }); });
    act(() => result.current.removeShip('DESTROYER'));
    expect(result.current.placedShips).toHaveLength(0);
    expect(result.current.remainingShips).toContain('DESTROYER');
  });

  it('reset clears all placed ships', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.selectShip('DESTROYER'));
    act(() => { result.current.placeShip({ row: 0, col: 0 }); });
    act(() => result.current.reset());
    expect(result.current.placedShips).toHaveLength(0);
    expect(result.current.remainingShips).toHaveLength(5);
    expect(result.current.orientation).toBe('HORIZONTAL');
  });

  it('allPlaced is true only after all 5 ships are placed', () => {
    const { result } = renderHook(() => usePlacement());
    const placements: [Parameters<typeof result.current.selectShip>[0], Parameters<typeof result.current.placeShip>[0]][] = [
      ['CARRIER',    { row: 0, col: 0 }],
      ['BATTLESHIP', { row: 2, col: 0 }],
      ['CRUISER',    { row: 4, col: 0 }],
      ['SUBMARINE',  { row: 6, col: 0 }],
      ['DESTROYER',  { row: 8, col: 0 }],
    ];
    for (const [ship, anchor] of placements) {
      act(() => result.current.selectShip(ship));
      act(() => { result.current.placeShip(anchor); });
    }
    expect(result.current.allPlaced).toBe(true);
  });

  it('hydrate seeds placedShips, clears selection and preview', () => {
    const { result } = renderHook(() => usePlacement());
    // Establish a non-empty selection + preview to prove hydrate clears them.
    act(() => result.current.selectShip('DESTROYER'));
    act(() => result.current.setPreview({ row: 0, col: 0 }));
    expect(result.current.selectedShipType).toBe('DESTROYER');
    expect(result.current.previewCells.length).toBeGreaterThan(0);

    act(() => result.current.hydrate(FULL_FLEET));

    expect(result.current.placedShips).toEqual(FULL_FLEET);
    expect(result.current.selectedShipType).toBeNull();
    expect(result.current.previewCells).toHaveLength(0);
    expect(result.current.previewValid).toBe(false);
  });

  it('hydrate with a full fleet makes remainingShips empty and allPlaced true', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.hydrate(FULL_FLEET));
    expect(result.current.placedShips).toHaveLength(5);
    expect(result.current.remainingShips).toHaveLength(0);
    expect(result.current.allPlaced).toBe(true);
  });

  it('hydrate with a partial fleet computes remainingShips and allPlaced correctly', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.hydrate(PARTIAL_FLEET));
    expect(result.current.placedShips).toHaveLength(2);
    expect(result.current.remainingShips).toHaveLength(3);
    expect(result.current.remainingShips).toEqual(
      expect.arrayContaining(['BATTLESHIP', 'CRUISER', 'SUBMARINE']),
    );
    expect(result.current.remainingShips).not.toContain('CARRIER');
    expect(result.current.remainingShips).not.toContain('DESTROYER');
    expect(result.current.allPlaced).toBe(false);
  });

  it('hydrate leaves orientation at its current value', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.toggleOrientation());
    expect(result.current.orientation).toBe('VERTICAL');
    act(() => result.current.hydrate(FULL_FLEET));
    expect(result.current.orientation).toBe('VERTICAL');
  });

  it('removeShip works on a hydrated ship', () => {
    const { result } = renderHook(() => usePlacement());
    act(() => result.current.hydrate(FULL_FLEET));
    act(() => result.current.removeShip('CARRIER'));
    expect(result.current.placedShips).toHaveLength(4);
    expect(result.current.remainingShips).toContain('CARRIER');
    expect(result.current.allPlaced).toBe(false);
  });
});
