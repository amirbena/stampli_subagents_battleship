import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fireShot } from '../../api/gameApi';
import { useGamePolling } from '../../hooks/useGamePolling';
import { GameBoard } from '../../components/board/GameBoard/GameBoard';
import { TurnIndicator } from '../../components/game/TurnIndicator/TurnIndicator';
import { ShotResultToast } from '../../components/game/ShotResultToast/ShotResultToast';
import { ShipStatusPanel } from '../../components/game/ShipStatusPanel/ShipStatusPanel';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { LoadingSpinner } from '../../components/common/LoadingSpinner/LoadingSpinner';
import { computeOwnBoardCells, computeOpponentBoardCells, getSunkShipTypes } from '../../utils/boardHelpers';
import type { ShotResult, ShipType } from '../../types/game';
import './Game.css';

export function Game(): React.ReactElement {
  const navigate = useNavigate();
  const gameId = sessionStorage.getItem('gameId') ?? '';
  const playerId = sessionStorage.getItem('playerId') ?? '';
  const [error, setError] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  const [lastResult, setLastResult] = useState<ShotResult | null>(null);
  const [lastSunkShip, setLastSunkShip] = useState<ShipType | null>(null);

  const { gameState, isLoading } = useGamePolling(gameId, playerId, true);

  useEffect(() => {
    if (!gameId || !playerId) navigate('/');
  }, [gameId, playerId, navigate]);

  useEffect(() => {
    if (gameState?.status === 'FINISHED') {
      navigate('/game-over');
    }
  }, [gameState?.status, navigate]);

  const isMyTurn = gameState?.currentTurnPlayerId === playerId;

  const handleFireShot = async (row: number, col: number) => {
    if (!isMyTurn || firing) return;
    setError(null);
    setFiring(true);
    try {
      const res = await fireShot(gameId, playerId, row, col);
      setLastResult(res.result);
      setLastSunkShip(res.sunkShipType);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shot failed');
    } finally {
      setFiring(false);
    }
  };

  const myBoardCells = gameState ? computeOwnBoardCells(gameState.myBoard) : undefined;
  const opponentBoardCells = gameState ? computeOpponentBoardCells(gameState.opponentBoard) : undefined;
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
      </header>

      <ShotResultToast result={lastResult} sunkShipType={lastSunkShip} />
      <ErrorMessage message={error} />

      <div className="game-layout">
        <div className="game-boards">
          {opponentBoardCells && (
            <GameBoard
              cells={opponentBoardCells}
              onCellClick={(r, c) => { void handleFireShot(r, c); }}
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
