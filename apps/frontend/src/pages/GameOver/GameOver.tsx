import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGamePolling } from '../../hooks/useGamePolling';
import { displayOpponentName } from '../../utils/displayOpponentName';
import './GameOver.css';

export function GameOver(): React.ReactElement {
  const navigate = useNavigate();
  const gameId = sessionStorage.getItem('gameId') ?? '';
  const playerId = sessionStorage.getItem('playerId') ?? '';

  const { gameState } = useGamePolling(gameId, playerId, true);

  const didWin = gameState?.winnerId === playerId;

  // When the computer wins, winnerId is a "COMPUTER-<uuid>" sentinel.
  // displayOpponentName converts it to "Computer" so the raw UUID never shows (AC-16, EC-07).
  const winnerLabel = gameState?.winnerId
    ? displayOpponentName(gameState.winnerId)
    : null;

  const handlePlayAgain = () => {
    sessionStorage.removeItem('gameId');
    sessionStorage.removeItem('playerId');
    navigate('/');
  };

  return (
    <main className="game-over-page">
      <div className="game-over-content">
        <h1 className={`game-over-title ${didWin ? 'game-over-title--win' : 'game-over-title--lose'}`}>
          {didWin ? '🏆 Victory!' : '💀 Defeat'}
        </h1>
        <p className="game-over-message">
          {didWin
            ? 'You sunk the entire enemy fleet!'
            : `Your fleet was destroyed${winnerLabel ? ` by ${winnerLabel}` : ''}.`}
        </p>
        <button
          className="btn btn--primary"
          onClick={handlePlayAgain}
          type="button"
        >
          Play Again
        </button>
      </div>
    </main>
  );
}
