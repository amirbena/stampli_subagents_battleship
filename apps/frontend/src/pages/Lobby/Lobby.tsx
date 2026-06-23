import React, { useEffect, useCallback, useState, useMemo } from 'react';
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

function emptyGrid() {
  return Array.from({ length: 10 }, () => Array<import('../../types/game').CellState>(10).fill('empty'));
}

export function Lobby(): React.ReactElement {
  const navigate = useNavigate();
  const gameId = sessionStorage.getItem('gameId') ?? '';
  const playerId = sessionStorage.getItem('playerId') ?? '';
  const [placementToastError, setPlacementToastError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const placement = usePlacement();
  const { gameState, isLoading } = useGamePolling(gameId, playerId, true);

  // Navigate to game once IN_PROGRESS
  useEffect(() => {
    if (gameState?.status === 'IN_PROGRESS') {
      navigate('/game');
    }
  }, [gameState?.status, navigate]);

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
        {gameId && <RoomCodeDisplay gameId={gameId} />}
      </header>

      {isWaiting && (
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
