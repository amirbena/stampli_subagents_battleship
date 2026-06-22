import React from 'react';

interface TurnIndicatorProps {
  isMyTurn: boolean;
  opponentReady: boolean;
}

export function TurnIndicator({ isMyTurn, opponentReady }: TurnIndicatorProps): React.ReactElement {
  if (!opponentReady) {
    return (
      <div className="turn-indicator turn-indicator--waiting">
        Waiting for opponent to be ready…
      </div>
    );
  }

  return (
    <div className={`turn-indicator ${isMyTurn ? 'turn-indicator--my-turn' : 'turn-indicator--opponent-turn'}`}>
      {isMyTurn ? '🎯 Your Turn — Fire!' : "Opponent's Turn…"}
    </div>
  );
}
