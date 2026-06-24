import React from 'react';
import './YourTurnToast.css';

/**
 * Transient banner shown when it becomes the player's turn.
 *
 * This component is purely presentational — the parent controls when it mounts
 * (driven by the turn-transition signal), so it has no timing logic of its own.
 */
export function YourTurnToast(): React.ReactElement {
  return (
    <div className="your-turn-toast" role="status" aria-live="assertive">
      🎯 Your turn!
    </div>
  );
}
