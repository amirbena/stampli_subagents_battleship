import React from 'react';
import './TurnIndicator.css';

interface TurnIndicatorProps {
  isMyTurn: boolean;
  opponentReady: boolean;
  firing: boolean;
}

export function TurnIndicator({ isMyTurn, opponentReady, firing }: TurnIndicatorProps): React.ReactElement {
  if (!opponentReady) {
    return (
      <div className="turn-indicator turn-indicator--waiting">
        Waiting for opponent to be ready…
      </div>
    );
  }

  const showYourTurn = isMyTurn && !firing;

  return (
    <div className={`turn-indicator ${showYourTurn ? 'turn-indicator--my-turn' : 'turn-indicator--opponent-turn'}`}>
      {showYourTurn ? '🎯 Your Turn — Fire!' : "Opponent's Turn…"}
    </div>
  );
}
