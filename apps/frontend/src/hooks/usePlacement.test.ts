import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlacement } from './usePlacement';

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
});
