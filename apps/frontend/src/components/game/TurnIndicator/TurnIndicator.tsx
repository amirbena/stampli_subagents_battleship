import React from 'react';
import './TurnIndicator.css';

interface TurnIndicatorProps {
  isMyTurn: boolean;
  opponentReady: boolean;
  // vs-computer mode shows a persistent two-state title ("Your turn" / "Computer is
  // playing") driven by the local turn choreography rather than the polled turn owner
  // (which never flips in vs-computer — control returns to the player synchronously).
  vsComputer?: boolean;
  computerPlaying?: boolean;
}

export function TurnIndicator({
  isMyTurn,
  opponentReady,
  vsComputer = false,
  computerPlaying = false,
}: TurnIndicatorProps): React.ReactElement | null {
  if (!opponentReady) {
    return (
      <div className="turn-indicator turn-indicator--waiting">
        Waiting for opponent to be ready…
      </div>
    );
  }

  // vs-computer: always show a persistent turn title for both states so the player can
  // see when the computer is taking its turn (and is locked out of firing).
  if (vsComputer) {
    if (computerPlaying) {
      return (
        <div className="turn-indicator turn-indicator--computer">
          Computer is playing
        </div>
      );
    }
    return (
      <div className="turn-indicator turn-indicator--my-turn">
        Your turn
      </div>
    );
  }

  // HUMAN multiplayer (unchanged): the player's own turn is signalled by the separate
  // YourTurnToast, not a persistent banner — so render nothing here when it is my turn.
  if (isMyTurn) {
    return null;
  }

  return (
    <div className="turn-indicator turn-indicator--opponent-turn">
      Opponent's Turn…
    </div>
  );
}
