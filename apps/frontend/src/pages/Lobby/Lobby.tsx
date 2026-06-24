import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { placeShip, removeShip, setReady } from '../../api/gameApi';
import { usePlacement } from '../../hooks/usePlacement';
import { useGamePolling } from '../../hooks/useGamePolling';
import { GameBoard } from '../../components/board/GameBoard/GameBoard';
import { FleetListPanel } from '../../components/placement/FleetListPanel/FleetListPanel';
import { RoomCodeDisplay } from '../../components/common/RoomCodeDisplay/RoomCodeDisplay';
import { PlacementErrorToast } from '../../components/common/PlacementErrorToast/PlacementErrorToast';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { LoadingSpinner } from '../../components/common/LoadingSpinner/LoadingSpinner';
import type { Coordinate, ShipType } from '../../types/game';
import { computeOwnBoardCells } from '../../utils/boardHelpers';
import './Lobby.css';

function emptyGrid() {
  return Array.from({ length: 10 }, () => Array<import('../../types/game').CellState>(10).fill('empty'));
}

export function Lobby(): React.ReactElement {
  const navigate = useNavigate();
  const gameId = sessionStorage.getItem('gameId') ?? '';
  const playerId = sessionStorage.getItem('playerId') ?? '';
  const gameMode = sessionStorage.getItem('gameMode') ?? 'HUMAN';
  const isVsComputer = gameMode === 'COMPUTER';
  const [placementToastError, setPlacementToastError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const placement = usePlacement(gameId);
  const { gameState, isLoading } = useGamePolling(gameId, playerId, true);

  // One-time guard so hydration runs exactly once per Lobby mount.
  const hydratedRef = useRef(false);

  // Rehydrate local placement state from the persisted server board on refresh/reconnect.
  // After a page refresh the backend still has the placed ships (gameState.myBoard.ships),
  // but usePlacement resets to empty — so the Fleet List panel desyncs from the board.
  // Conditions (ALL must hold) so we hydrate exactly once on the first server board carrying
  // ships and NEVER clobber a freshly placed optimistic ship on a later 2s poll:
  //   1. !hydratedRef.current        — we have not already hydrated this mount
  //   2. placedShips.length === 0    — local state is still empty (no optimistic placement yet)
  //   3. myBoard.ships.length > 0    — the server is actually carrying placed ships
  // The selected tool is intentionally NOT restored (hydrate clears selection to null).
  useEffect(() => {
    const serverShips = gameState?.myBoard?.ships;
    if (
      !hydratedRef.current &&
      placement.placedShips.length === 0 &&
      serverShips &&
      serverShips.length > 0
    ) {
      placement.hydrate(serverShips);
      hydratedRef.current = true;
    }
  }, [gameState?.myBoard?.ships, placement]);

  // Navigate to game once IN_PROGRESS.
  // Clear the placement sessionStorage key before navigating so stale ship positions
  // from this game do not bleed into a future game started in the same tab.
  useEffect(() => {
    if (gameState?.status === 'IN_PROGRESS') {
      try { window.sessionStorage.removeItem(`placement_ships_${gameId}`); } catch {}
      navigate('/game');
    }
  }, [gameState?.status, navigate, gameId]);

  // Redirect home if no session
  useEffect(() => {
    if (!gameId || !playerId) {
      navigate('/');
    }
  }, [gameId, playerId, navigate]);

  // Keyboard shortcut: R to rotate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        placement.toggleOrientation();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placement]);

  /**
   * Maps raw backend/internal error messages to user-friendly placement copy.
   * Prevents technical phase errors from appearing directly in the UI.
   */
  const toFriendlyPlacementError = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (lower.includes('occupied') || lower.includes('overlap')) {
      return 'This position is already occupied. Choose another cell.';
    }
    if (lower.includes('phase') || lower.includes('wrong_phase') || lower.includes('placing_ships')) {
      return 'Cannot place this ship here. Try another position.';
    }
    if (lower.includes('bounds') || lower.includes('invalid_placement')) {
      return 'Cannot place this ship here. Try another position.';
    }
    if (lower.includes('already placed') || lower.includes('already_placed')) {
      return 'That ship type has already been placed.';
    }
    return 'Cannot place this ship here. Try another position.';
  };

  const handleCellClick = useCallback(async (row: number, col: number) => {
    if (!placement.selectedShipType) return;
    const anchor: Coordinate = { row, col };
    const placed = placement.placeShip(anchor);
    if (!placed) {
      setPlacementToastError('This position is already occupied. Choose another cell.');
      return;
    }
    setPlacementToastError(null);
    try {
      await placeShip(gameId, playerId, {
        shipType: placed.shipType,
        row,
        col,
        orientation: placement.orientation,
      });
    } catch (e) {
      // Roll back local placement on backend rejection
      placement.removeShip(placed.shipType);
      const raw = e instanceof Error ? e.message : 'Placement failed';
      setPlacementToastError(toFriendlyPlacementError(raw));
    }
  }, [placement, gameId, playerId]);

  const handleRemoveShip = useCallback(async (type: ShipType) => {
    placement.removeShip(type);
    try {
      await removeShip(gameId, playerId, type);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Remove failed');
    }
  }, [placement, gameId, playerId]);

  const handleConfirmReady = async () => {
    setSubmitting(true);
    setGeneralError(null);
    try {
      await setReady(gameId, playerId);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Failed to confirm ready');
    } finally {
      setSubmitting(false);
    }
  };

  // Build board from local placement state.
  // Local optimistic placement is authoritative during the placement phase so a
  // freshly placed ship renders instantly, instead of waiting for the next 2s poll
  // to echo it back via gameState.myBoard. The server board is only used as a
  // fallback (e.g. reconnecting to a session that already has ships placed).
  const boardCells = useMemo(() => {
    if (placement.placedShips.length > 0) {
      const grid = emptyGrid();
      for (const ship of placement.placedShips) {
        for (const cell of ship.cells) {
          grid[cell.row][cell.col] = 'ship';
        }
      }
      return grid;
    }
    if (gameState?.myBoard) {
      return computeOwnBoardCells(gameState.myBoard);
    }
    return emptyGrid();
  }, [gameState?.myBoard, placement.placedShips]);

  const isWaiting = gameState?.status === 'WAITING_FOR_PLAYERS';
  const myReady = gameState?.myReady ?? false;

  return (
    <main className="lobby-page">
      <header className="lobby-header">
        <h1>Place Your Ships</h1>
        {!isVsComputer && gameId && <RoomCodeDisplay gameId={gameId} />}
      </header>

      {isVsComputer && (
        <div className="vs-computer-banner">Playing vs Computer — place your ships and ready up</div>
      )}
      {!isVsComputer && isWaiting && (
        <div className="waiting-banner">Waiting for opponent to join…</div>
      )}

      <PlacementErrorToast message={placementToastError} />
      <ErrorMessage message={generalError} />

      {isLoading && !gameState && <LoadingSpinner label="Loading game…" />}

      <div className="lobby-layout">
        <FleetListPanel
          placedShipTypes={placement.placedShips.map((s) => s.shipType)}
          selectedShipType={placement.selectedShipType}
          orientation={placement.orientation}
          onSelectShip={placement.selectShip}
          onToggleOrientation={placement.toggleOrientation}
          onRemoveShip={handleRemoveShip}
        />

        <div className="lobby-board-area">
          <GameBoard
            cells={boardCells}
            onCellClick={(r, c) => { void handleCellClick(r, c); }}
            onCellHover={(r, c) => placement.setPreview({ row: r, col: c })}
            onMouseLeave={() => placement.setPreview(null)}
            previewCells={placement.previewCells}
            previewValid={placement.previewValid}
            interactive={!!placement.selectedShipType}
            label="Your Board"
          />

          <button
            className="btn btn--primary confirm-ready-btn"
            onClick={() => { void handleConfirmReady(); }}
            disabled={!placement.allPlaced || myReady || submitting}
            type="button"
          >
            {myReady ? 'Waiting for opponent…' : submitting ? 'Confirming…' : 'Confirm Ready'}
          </button>
          {!placement.allPlaced && (
            <p className="placement-hint">
              Place all {5 - placement.placedShips.length} remaining ship(s) to continue
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
