import { useState, useCallback, useEffect } from 'react';
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
  hydrate: (ships: ShipDto[]) => void;
  reset: () => void;
}

/**
 * Manages the local ship placement state before the fleet is submitted to the backend.
 *
 * `gameId` is used as part of the sessionStorage key so placements are scoped per game.
 * On mount the hook reads from `sessionStorage` (key: `placement_ships_<gameId>`) so that
 * a page refresh restores placed ships instantly — no poll round-trip required for the
 * initial render. The sync effect writes back after every state change, and `reset()` removes
 * the key explicitly so no stale placement bleeds into a future game in the same tab.
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
 * @param gameId - The current game ID; used to scope the sessionStorage key.
 * @returns placement state and action handlers
 */
export function usePlacement(gameId: string): UsePlacementResult {
  // Lazy initialiser — reads persisted ships from sessionStorage on first render.
  // Falls back to [] if the key is absent, JSON parsing fails, or storage is unavailable.
  const [placedShips, setPlacedShips] = useState<ShipDto[]>(() => {
    if (!gameId) return [];
    try {
      const stored = window.sessionStorage.getItem(`placement_ships_${gameId}`);
      return stored ? (JSON.parse(stored) as ShipDto[]) : [];
    } catch {
      return [];
    }
  });
  const [selectedShipType, setSelectedShipType] = useState<ShipType | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('HORIZONTAL');
  const [previewCells, setPreviewCells] = useState<Coordinate[]>([]);
  const [previewValid, setPreviewValid] = useState(false);

  // Sync effect — writes placedShips to sessionStorage after every change (including hydrate).
  // Fires on placedShips change or when gameId changes (tab reused for a new game).
  // When placedShips is empty (e.g. after reset()), removes the key so no stale entry lingers.
  useEffect(() => {
    if (!gameId) return;
    try {
      if (placedShips.length === 0) {
        window.sessionStorage.removeItem(`placement_ships_${gameId}`);
      } else {
        window.sessionStorage.setItem(`placement_ships_${gameId}`, JSON.stringify(placedShips));
      }
    } catch {
      // sessionStorage write failed — continue with in-memory state
    }
  }, [placedShips, gameId]);

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

  /**
   * Seeds placement state from ships already persisted on the server board.
   *
   * Used by the Lobby to rehydrate after a page refresh: the backend re-renders
   * placed ships on the board (via `gameState.myBoard.ships`), but local placement
   * state would otherwise reset to empty, desyncing the Fleet List panel from the board.
   *
   * Replaces `placedShips` with the provided ships, clears any active selection and
   * preview, and intentionally leaves `orientation` untouched (selected tool is not
   * persisted across refresh — the user accepts "no tool selected" after rehydration).
   *
   * This is a pure state setter with no once-only guard — the caller (Lobby) owns the
   * guard. Wrapped in `useCallback` with an empty dependency array so its identity is
   * stable and a consumer can safely use it as an effect dependency.
   */
  const hydrate = useCallback((ships: ShipDto[]) => {
    setPlacedShips(ships);
    setSelectedShipType(null);
    setPreviewCells([]);
    setPreviewValid(false);
  }, []);

  /**
   * Resets all placement state — used when the player wants to start over.
   * The sync effect handles sessionStorage cleanup: when placedShips drops to [],
   * the effect calls removeItem, leaving no stale key for a future game in the same tab.
   */
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
    hydrate,
    reset,
  };
}
