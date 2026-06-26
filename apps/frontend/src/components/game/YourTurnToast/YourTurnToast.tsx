import React from 'react';
import './YourTurnToast.css';

interface YourTurnToastProps {
  // Override the default copy — used for the "Your turn again!" cue when control
  // returns to the player after the computer's turn in vs-computer mode.
  message?: string;
}

/**
 * Transient banner shown when it becomes the player's turn.
 *
 * This component is purely presentational — the parent controls when it mounts
 * (driven by the turn-transition signal), so it has no timing logic of its own.
 */
export function YourTurnToast({ message = '🎯 Your turn!' }: YourTurnToastProps = {}): React.ReactElement {
  return (
    <div className="your-turn-toast" role="status" aria-live="assertive">
      {message}
    </div>
  );
}
