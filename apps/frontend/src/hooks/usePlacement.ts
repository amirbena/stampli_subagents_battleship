import { useState, useCallback } from 'react';
import type { ShipType, Orientation, Coordinate, ShipDto } from '../types/game';
import { ALL_SHIP_TYPES, SHIP_SIZES } from '../types/game';
import { isValidPlacement, getPreviewCells } from '../utils/placementValidator';
import { getShipCells } from '../utils/boardHelpers';

interface PlacementState {
  placedShips: ShipDto[];
  selectedShipType: ShipType | null;
  orientation: Orientation;
  previewCells: Coordinate[];
  previewValid: boolean;
  remainingShips: ShipType[];
  allPlaced: boolean;
}

interface UsePlacementResult extends PlacementState {
  selectShip: (type: ShipType) => void;
  toggleOrientation: () => void;
  setPreview: (anchor: Coordinate | null) => void;
  placeShip: (anchor: Coordinate) => ShipDto | null;
  removeShip: (type: ShipType) => void;
  reset: () => void;
}

/**
 * Manages the local ship placement state before the fleet is submitted to the backend.
 *
 * The placement flow is:
 *   1. `selectShip(type)` — player clicks a ship in the fleet list
 *   2. `setPreview(anchor)` — player hovers over the board; renders a ghost overlay
 *   3. `placeShip(anchor)` — player clicks a valid cell; ship is added to `placedShips`
 *   4. `removeShip(type)` — player removes a placed ship to reposition it
 *   5. When `allPlaced === true`, the Lobby page calls the backend `setReady` endpoint
 *
 * Client-side validation in `placeShip` mirrors backend rules (bounds + overlap) to
 * give instant feedback, but the backend re-validates on submission — this is defence in depth.
 *
 * @returns placement state and action handlers
 */
export function usePlacement(): UsePlacementResult {
  const [placedShips, setPlacedShips] = useState<ShipDto[]>([]);
  const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('HORIZONTAL');
  const [previewCells, setPreviewCells] = useState<Coordinate[]>([]);
  const [previewValid, setPreviewValid] = useState(false);

  const remainingShips = ALL_SHIP_TYPES.filter(
    (t) => !placedShips.some((s) => s.shipType === t),
  );

  const allPlaced = remainingShips.length === 0;

  /** Sets the active ship type. Clears any existing preview so the ghost doesn't linger. */
  const selectShip = useCallback((type: ShipType) => {
    setSelectedShipType(type);
    setPreviewCells([]);
    setPreviewValid(false);
  }, []);

  /** Flips orientation between HORIZONTAL and VERTICAL. Clears preview to avoid stale ghosts. */
  const toggleOrientation = useCallback(() => {
    setOrientation((prev) => (prev === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'));
    setPreviewCells([]);
    setPreviewValid(false);
  }, []);

  /**
   * Updates the ghost preview cells when the cursor moves over the board.
   * Called on cell hover; passing null clears the preview (cursor left the board).
   */
  const setPreview = useCallback(
    (anchor: Coordinate | null) => {
      if (!anchor || !selectedShipType) {
        setPreviewCells([]);
        setPreviewValid(false);
        return;
      }
      const { cells, valid } = getPreviewCells(anchor, selectedShipType, orientation, placedShips);
      setPreviewCells(cells);
      setPreviewValid(valid);
    },
    [selectedShipType, orientation, placedShips],
  );

  /**
   * Attempts to place the selected ship at the given anchor.
   * Returns the placed ship on success or null if placement is invalid.
   * On success, clears the selection so the player must choose the next ship explicitly.
   */
  const placeShip = useCallback(
    (anchor: Coordinate): ShipDto | null => {
      if (!selectedShipType) return null;
      if (!isValidPlacement(selectedShipType, anchor, orientation, placedShips)) return null;

      const cells = getShipCells(anchor, SHIP_SIZES[selectedShipType], orientation);
      const newShip: ShipDto = {
        shipType: selectedShipType,
        cells,
        hits: [],
        sunk: false,
      };

      setPlacedShips((prev) => [...prev, newShip]);
      setSelectedShipType(null);
      setPreviewCells([]);
      setPreviewValid(false);
      return newShip;
    },
    [selectedShipType, orientation, placedShips],
  );

  /** Removes a placed ship by type, returning it to the unplaced fleet list. */
  const removeShip = useCallback((type: ShipType) => {
    setPlacedShips((prev) => prev.filter((s) => s.shipType !== type));
  }, []);

  /** Resets all placement state — used when the player wants to start over. */
  const reset = useCallback(() => {
    setPlacedShips([]);
    setSelectedShipType(null);
    setOrientation('HORIZONTAL');
    setPreviewCells([]);
    setPreviewValid(false);
  }, []);

  return {
    placedShips,
    selectedShipType,
    orientation,
    previewCells,
    previewValid,
    remainingShips,
    allPlaced,
    selectShip,
    toggleOrientation,
    setPreview,
    placeShip,
    removeShip,
    reset,
  };
}
