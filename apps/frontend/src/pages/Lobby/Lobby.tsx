import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { placeShip, removeShip, setReady, pauseGame, stopGame } from '../../api/gameApi';
import { usePlacement } from '../../hooks/usePlacement';
import { useGamePolling } from '../../hooks/useGamePolling';
import { useActiveGame } from '../../hooks/useActiveGame';
import { GameSessionControls } from '../../components/game/GameSessionControls/GameSessionControls';
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
  // Session context now comes from the single localStorage active-game pointer, not
  // sessionStorage (so it survives refresh / tab close / restart — AC-1/2). The guard
  // already ensures the pointer is non-null before this page renders.
  const { pointer, clear: clearActiveGame } = useActiveGame();
  const gameId = pointer?.gameId ?? '';
  const playerId = pointer?.playerId ?? '';
  // Per-seat belonging secret threaded into every gated call (architecture §4.5). Same
  // source as gameId/playerId; '' when absent → the call 403s and existing error handling runs.
  const sessionToken = pointer?.sessionToken ?? '';
  const gameMode = pointer?.gameMode ?? 'HUMAN';
  const isVsComputer = gameMode === 'COMPUTER';
  const [placementToastError, setPlacementToastError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // True while a Pause/Stop request is in flight, so the session controls disable.
  const [sessionBusy, setSessionBusy] = useState(false);

  const placement = usePlacement(gameId);
  const { gameState, isLoading } = useGamePolling(gameId, playerId, sessionToken, true);

  // One-time guard so hydration runs exactly once per Lobby mount.
  const hydratedRef = useRef(false);
  // Set true the moment the user makes a local optimistic place/remove this mount. Once set,
  // backend hydration is suppressed so a later 2s poll can never clobber the user's in-progress
  // placement (distinguishes "user is actively placing" from "fresh resume/refresh").
  const userInteractedRef = useRef(false);

  // Rehydrate local placement state from the persisted server board on refresh/RESUME (AC-11).
  // Backend `myBoard.ships` is the source of truth. On resume into PLACING_SHIPS, the local
  // `usePlacement` lazy-init may carry a STALE `placement_ships_<gameId>` sessionStorage blob —
  // that scratch must NOT win over backend truth, or the board can render stuck/invalid cells.
  //
  // Hydrate exactly ONCE per mount on the first server board carrying ships, overwriting whatever
  // local placement existed (stale sessionStorage or empty). We deliberately DROP the old
  // "placedShips.length === 0" precondition — that precondition let a stale sessionStorage blob
  // block backend hydration, which is the exact AC-11 bug.
  //
  // The clobber-safety that "placedShips.length === 0" used to provide is now carried by
  // `userInteractedRef`: a freshly placed optimistic ship sets that flag, after which a later
  // poll echoing the full fleet is ignored. So:
  //   - Fresh resume/refresh (no interaction yet) → backend ships win over stale sessionStorage.
  //   - Active local placement (user interacted)   → later polls never clobber it.
  //   1. !hydratedRef.current        — we have not already hydrated this mount
  //   2. !userInteractedRef.current  — the user has not placed/removed locally this mount
  //   3. myBoard.ships.length > 0    — the server is actually carrying placed ships
  // The selected tool is intentionally NOT restored (hydrate clears selection to null).
  useEffect(() => {
    const serverShips = gameState?.myBoard?.ships;
    if (
      !hydratedRef.current &&
      !userInteractedRef.current &&
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

  // Defense-in-depth self-guard: reads the SAME active-game pointer the route guard reads
  // (never sessionStorage). The route guard already blocks pointer-null entry, so this only
  // fires if the pointer is cleared while the page is mounted (e.g. Stop).
  useEffect(() => {
    if (!gameId || !playerId) {
      navigate('/');
    }
  }, [gameId, playerId, navigate]);

  // A game that reaches FINISHED is no longer an active session — clear the pointer so it
  // never re-triggers the resume modal (AC-14). GameOver itself is reachable while the
  // pointer is briefly still set; we clear here as soon as the lobby observes FINISHED.
  useEffect(() => {
    if (gameState?.status === 'FINISHED') {
      clearActiveGame();
    }
  }, [gameState?.status, clearActiveGame]);

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
    // Mark local interaction so backend hydration cannot clobber the user's placement.
    userInteractedRef.current = true;
    const anchor: Coordinate = { row, col };
    const placed = placement.placeShip(anchor);
    if (!placed) {
      setPlacementToastError('This position is already occupied. Choose another cell.');
      return;
    }
    setPlacementToastError(null);
    try {
      // `silent: true` excludes placement from the app-wide top-bar loader — placing/
      // switching a ship is a high-frequency in-game action that must feel instant (AC group 1).
      await placeShip(gameId, playerId, {
        shipType: placed.shipType,
        row,
        col,
        orientation: placement.orientation,
      }, sessionToken, true);
    } catch (e) {
      // Roll back local placement on backend rejection
      placement.removeShip(placed.shipType);
      const raw = e instanceof Error ? e.message : 'Placement failed';
      setPlacementToastError(toFriendlyPlacementError(raw));
    }
  }, [placement, gameId, playerId, sessionToken]);

  const handleRemoveShip = useCallback(async (type: ShipType) => {
    userInteractedRef.current = true;
    placement.removeShip(type);
    try {
      // `silent: true` excludes removal from the app-wide top-bar loader — removing/
      // repositioning a ship is a high-frequency in-game action that must feel instant (AC group 1).
      await removeShip(gameId, playerId, type, sessionToken, true);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Remove failed');
    }
  }, [placement, gameId, playerId, sessionToken]);

  // Pause: backend marks PAUSED, the pointer is KEPT, and we return Home where the resume
  // modal will appear (AC-8). Stop is NOT involved — pause never clears the pointer.
  const handlePause = useCallback(async () => {
    setSessionBusy(true);
    setGeneralError(null);
    try {
      await pauseGame(gameId, playerId, sessionToken);
      navigate('/');
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Could not pause the game. Please try again.');
      setSessionBusy(false);
    }
  }, [gameId, playerId, sessionToken, navigate]);

  // Stop: backend deletes the session, we CLEAR the pointer, and return to a clean Home with
  // no resume modal (AC-9, AC-14). Stop is idempotent on the backend (204 even when gone).
  const handleStop = useCallback(async () => {
    setSessionBusy(true);
    setGeneralError(null);
    try {
      await stopGame(gameId, playerId, sessionToken);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Could not stop the game. Please try again.');
      setSessionBusy(false);
      return;
    }
    clearActiveGame();
    navigate('/');
  }, [gameId, playerId, sessionToken, navigate, clearActiveGame]);

  // Synchronous duplicate-submission guard. `submitting` (state) disables the button on the
  // next render, but rapid clicks within a single tick all fire before React re-renders — the
  // ref blocks the extra submissions immediately (AC-10). Reset in finally so a failed attempt
  // re-enables the control for retry (never permanently locked, AC-12).
  const submittingRef = useRef(false);
  const handleConfirmReady = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setGeneralError(null);
    try {
      await setReady(gameId, playerId, sessionToken);
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : 'Failed to confirm ready');
    } finally {
      submittingRef.current = false;
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
        <GameSessionControls
          onPause={() => { void handlePause(); }}
          onStop={() => { void handleStop(); }}
          busy={sessionBusy}
        />
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
          {/* Confirm Ready is an intentional major transition: while the ready request is in
              flight show a centered blocking loading state with transitional messaging. The
              `submitting` guard above keeps the control disabled (no double-submit); on failure
              the handler's finally resets `submitting`, clearing this state so the player can
              retry (the control is never permanently locked). */}
          {submitting && (
            <div className="confirm-ready-blocking" role="status">
              <LoadingSpinner label="Preparing game…" />
            </div>
          )}
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
