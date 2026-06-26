import React from 'react';
import './TurnIndicator.css';

interface TurnIndicatorProps {
  isMyTurn: boolean;
  opponentReady: boolean;
}

export function TurnIndicator({ isMyTurn, opponentReady }: TurnIndicatorProps): React.ReactElement | null {
  if (!opponentReady) {
    return (
      <div className="turn-indicator turn-indicator--waiting">
        Waiting for opponent to be ready…
      </div>
    );
  }

  // The player's own turn is signalled by the separate YourTurnToast, not a persistent
  // banner — so render nothing here when it is my turn and the opponent is ready.
  if (isMyTurn) {
    return null;
  }

  return (
    <div className="turn-indicator turn-indicator--opponent-turn">
      Opponent's Turn…
    </div>
  );
}
