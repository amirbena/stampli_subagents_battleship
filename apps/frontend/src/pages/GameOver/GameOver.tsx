import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGamePolling } from '../../hooks/useGamePolling';
import { useActiveGame } from '../../hooks/useActiveGame';
import { displayOpponentName } from '../../utils/displayOpponentName';
import './GameOver.css';

export function GameOver(): React.ReactElement {
  const navigate = useNavigate();
  const { pointer, clear: clearActiveGame } = useActiveGame();

  // Capture the session ids ONCE at first render, before the clear-on-mount effect nulls
  // the pointer. The guard guaranteed the pointer was non-null on entry, so these are valid.
  // Using a ref keeps the polling hook fed with stable ids even after the pointer is cleared,
  // so the final-state fetch (winnerId) still completes (AC-14 clear must not break the result).
  const sessionRef = useRef({
    gameId: pointer?.gameId ?? '',
    playerId: pointer?.playerId ?? '',
    // Capture the belonging token too so the final-state poll authenticates after the
    // pointer is cleared on mount (architecture §4.5 — GET /state is belonging-gated).
    sessionToken: pointer?.sessionToken ?? '',
  });
  const { gameId, playerId, sessionToken } = sessionRef.current;

  const { gameState } = useGamePolling(gameId, playerId, sessionToken, true);

  // Reaching game-over means the session is finished — clear the active-game pointer so it
  // never re-triggers the resume modal on a later Home visit (AC-14). Runs once on mount.
  useEffect(() => {
    clearActiveGame();
  }, [clearActiveGame]);

  const didWin = gameState?.winnerId === playerId;

  // When the computer wins, winnerId is a "COMPUTER-<uuid>" sentinel.
  // displayOpponentName converts it to "Computer" so the raw UUID never shows (AC-16, EC-07).
  const winnerLabel = gameState?.winnerId
    ? displayOpponentName(gameState.winnerId)
    : null;

  const handlePlayAgain = () => {
    // The active-game pointer is already cleared on mount (AC-14); just return to a clean Home.
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
