import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fireShot, pauseGame, stopGame } from '../../api/gameApi';
import { useGamePolling } from '../../hooks/useGamePolling';
import { useTurnNotification } from '../../hooks/useTurnNotification';
import { useActiveGame } from '../../hooks/useActiveGame';
import { GameSessionControls } from '../../components/game/GameSessionControls/GameSessionControls';
import { GameBoard } from '../../components/board/GameBoard/GameBoard';
import { TurnIndicator } from '../../components/game/TurnIndicator/TurnIndicator';
import { ShotResultToast } from '../../components/game/ShotResultToast/ShotResultToast';
import { ShipStatusPanel } from '../../components/game/ShipStatusPanel/ShipStatusPanel';
import { FiringIndicator } from '../../components/game/FiringIndicator/FiringIndicator';
import { YourTurnToast } from '../../components/game/YourTurnToast/YourTurnToast';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { LoadingSpinner } from '../../components/common/LoadingSpinner/LoadingSpinner';
import { computeOwnBoardCells, computeOpponentBoardCells, getSunkShipTypes } from '../../utils/boardHelpers';
import { playShotSound } from '../../utils/sound';
import type { ShotResult, ShipType, CellState, Coordinate } from '../../types/game';
import './Game.css';

export function Game(): React.ReactElement {
  const navigate = useNavigate();
  // Session context from the single localStorage active-game pointer (survives refresh /
  // tab close / restart). The route guard ensures it is non-null before this page renders.
  const { pointer, clear: clearActiveGame } = useActiveGame();
  const gameId = pointer?.gameId ?? '';
  const playerId = pointer?.playerId ?? '';
  const [error, setError] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  // True while a Pause/Stop request is in flight, so the session controls disable.
  const [sessionBusy, setSessionBusy] = useState(false);
  // The cell the player just fired at, shown as a pending shot until the result arrives.
  const [pendingShot, setPendingShot] = useState<Coordinate | null>(null);
  const [lastResult, setLastResult] = useState<ShotResult | null>(null);
  const [lastSunkShip, setLastSunkShip] = useState<ShipType | null>(null);
  // Optimistic overlay for computer's shot on my board before next poll
  const [computerShotOverlay, setComputerShotOverlay] = useState<{ row: number; col: number; state: CellState } | null>(null);

  const { gameState, isLoading, refresh } = useGamePolling(gameId, playerId, true);

  // Defense-in-depth self-guard reading the SAME active-game pointer the route guard reads
  // (never sessionStorage). Only fires if the pointer is cleared while mounted (e.g. Stop).
  useEffect(() => {
    if (!gameId || !playerId) navigate('/');
  }, [gameId, playerId, navigate]);

  // On FINISHED, clear the active-game pointer BEFORE navigating to game-over so a
  // finished game never re-triggers the resume modal on a later Home visit (AC-14).
  useEffect(() => {
    if (gameState?.status === 'FINISHED') {
      clearActiveGame();
      navigate('/game-over');
    }
  }, [gameState?.status, navigate, clearActiveGame]);

  // Pause: backend PAUSED, pointer KEPT, return Home (resume modal appears) — AC-8.
  const handlePause = useCallback(async () => {
    setSessionBusy(true);
    setError(null);
    try {
      await pauseGame(gameId, playerId);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pause the game. Please try again.');
      setSessionBusy(false);
    }
  }, [gameId, playerId, navigate]);

  // Stop: backend deletes the session, pointer CLEARED, clean Home, no resume modal — AC-9.
  const handleStop = useCallback(async () => {
    setSessionBusy(true);
    setError(null);
    try {
      await stopGame(gameId, playerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop the game. Please try again.');
      setSessionBusy(false);
      return;
    }
    clearActiveGame();
    navigate('/');
  }, [gameId, playerId, navigate, clearActiveGame]);

  // Clear the optimistic computer-shot overlay once the poll updates my board
  useEffect(() => {
    if (gameState && computerShotOverlay) {
      setComputerShotOverlay(null);
    }
  }, [gameState]);

  const isMyTurn = gameState?.currentTurnPlayerId === playerId;
  // Show "Your turn!" only on the opponent/computer → me transition (see hook).
  const showYourTurn = useTurnNotification(isMyTurn, gameState?.status);

  const opponentBoardCells = gameState ? computeOpponentBoardCells(gameState.opponentBoard) : undefined;

  const handleFireShot = (row: number, col: number): void => {
    // Gate: ignore the click entirely (no sound, no request) when it is not the
    // player's turn or a shot is already pending — prevents duplicate shots.
    if (!isMyTurn || firing) return;
    // Ignore cells already resolved as miss/sunk on the opponent board.
    const targetState = opponentBoardCells?.[row]?.[col];
    if (targetState === 'miss' || targetState === 'sunk') return;

    // Accepted shot — give immediate feedback as a direct result of the gesture.
    playShotSound();
    setError(null);
    setPendingShot({ row, col });
    setFiring(true);
    void submitShot(row, col);
  };

  const submitShot = async (row: number, col: number): Promise<void> => {
    try {
      const res = await fireShot(gameId, playerId, row, col);
      setLastResult(res.result);
      setLastSunkShip(res.sunkShipType);
      if (res.computerShot) {
        const cs = res.computerShot;
        const cellState: CellState = cs.result === 'MISS' ? 'miss' : 'hit';
        setComputerShotOverlay({ row: cs.row, col: cs.col, state: cellState });
        if (cs.winnerId) {
          navigate('/game-over');
        }
      }
      // Pull the authoritative board immediately so the result shows without
      // waiting for the next poll interval.
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shot failed. Please try again.');
    } finally {
      // Always clear pending + unlock the board, even on failure, so the
      // indicator never sticks and the player can fire again.
      setFiring(false);
      setPendingShot(null);
    }
  };

  const myBoardCellsBase = gameState ? computeOwnBoardCells(gameState.myBoard) : undefined;
  const myBoardCells = myBoardCellsBase && computerShotOverlay
    ? myBoardCellsBase.map((rowArr, r) =>
        rowArr.map((cell, c) =>
          r === computerShotOverlay.row && c === computerShotOverlay.col && cell !== 'hit' && cell !== 'miss' && cell !== 'sunk'
            ? computerShotOverlay.state
            : cell,
        ),
      )
    : myBoardCellsBase;
  // Overlay the pending shot onto the opponent board so the target cell shows a
  // loading state immediately, before the backend result replaces it.
  const opponentBoardCellsWithPending = opponentBoardCells && pendingShot
    ? opponentBoardCells.map((rowArr, r) =>
        rowArr.map((cell, c) =>
          r === pendingShot.row && c === pendingShot.col ? 'pending' : cell,
        ),
      )
    : opponentBoardCells;
  const opponentSunkTypes = gameState ? getSunkShipTypes(gameState.opponentBoard) : [];

  if (isLoading && !gameState) {
    return <LoadingSpinner label="Loading game…" />;
  }

  return (
    <main className="game-page">
      <header className="game-header">
        <h1>Battleship</h1>
        {gameState && (
          <TurnIndicator
            isMyTurn={isMyTurn}
            opponentReady={gameState.opponentReady}
          />
        )}
        <GameSessionControls
          onPause={() => { void handlePause(); }}
          onStop={() => { void handleStop(); }}
          busy={sessionBusy}
        />
      </header>

      {showYourTurn && <YourTurnToast />}
      <FiringIndicator active={firing} />
      <ShotResultToast result={lastResult} sunkShipType={lastSunkShip} />
      <ErrorMessage message={error} />

      <div className="game-layout">
        <div className="game-boards">
          {opponentBoardCellsWithPending && (
            <GameBoard
              cells={opponentBoardCellsWithPending}
              onCellClick={handleFireShot}
              interactive={isMyTurn && !firing}
              label="Enemy Waters"
            />
          )}
          {myBoardCells && (
            <GameBoard
              cells={myBoardCells}
              label="Your Board"
            />
          )}
        </div>

        {gameState && (
          <ShipStatusPanel
            myShips={gameState.myBoard.ships}
            opponentSunkTypes={opponentSunkTypes}
          />
        )}
      </div>
    </main>
  );
}
