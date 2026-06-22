import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { placeShip, removeShip, setReady } from '../api/gameApi';
import { usePlacement } from '../hooks/usePlacement';
import { useGamePolling } from '../hooks/useGamePolling';
import { GameBoard } from '../components/board/GameBoard';
import { FleetListPanel } from '../components/placement/FleetListPanel';
import { RoomCodeDisplay } from '../components/common/RoomCodeDisplay';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { Coordinate, ShipType } from '../types/game';
import { computeOwnBoardCells } from '../utils/boardHelpers';

function emptyGrid() {
  return Array.from({ length: 10 }, () => Array<import('../types/game').CellState>(10).fill('empty'));
}

export function Lobby(): React.ReactElement {
  const navigate = useNavigate();
  const gameId = sessionStorage.getItem('gameId') ?? '';
  const playerId = sessionStorage.getItem('playerId') ?? '';
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

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

  const handleCellClick = useCallback(async (row: number, col: number) => {
    if (!placement.selectedShipType) return;
    const anchor: Coordinate = { row, col };
    const placed = placement.placeShip(anchor);
    if (!placed) {
      setError('Invalid placement — try again');
      return;
    }
    setError(null);
    try {
      await placeShip(gameId, playerId, {
        shipType: placed.shipType,
        row,
        col,
        orientation: placement.orientation,
      });
    } catch (e) {
      // Roll back local placement
      placement.removeShip(placed.shipType);
      setError(e instanceof Error ? e.message : 'Placement failed');
    }
  }, [placement, gameId, playerId]);

  const handleRemoveShip = useCallback(async (type: ShipType) => {
    placement.removeShip(type);
    try {
      await removeShip(gameId, playerId, type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  }, [placement, gameId, playerId]);

  const handleConfirmReady = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await setReady(gameId, playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm ready');
    } finally {
      setSubmitting(false);
    }
  };

  // Build board from local placement state
  const boardCells = React.useMemo(() => {
    if (gameState?.myBoard) {
      return computeOwnBoardCells(gameState.myBoard);
    }
    const grid = emptyGrid();
    for (const ship of placement.placedShips) {
      for (const cell of ship.cells) {
        grid[cell.row][cell.col] = 'ship';
      }
    }
    return grid;
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

      <ErrorMessage message={error} />

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
