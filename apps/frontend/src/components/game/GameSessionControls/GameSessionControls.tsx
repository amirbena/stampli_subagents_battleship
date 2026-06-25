import React from 'react';
import './GameSessionControls.css';

interface GameSessionControlsProps {
  /** Pause — backend marks PAUSED, pointer is KEPT, navigate Home (resume modal will appear). */
  onPause: () => void;
  /** Stop — backend deletes the session, pointer is CLEARED, navigate to a clean Home. */
  onStop: () => void;
  /** Disables both buttons while a pause/stop request is in flight. */
  busy?: boolean;
}

/**
 * In-game session controls: Pause and Stop.
 *
 * The two actions are deliberately distinct so a player does not accidentally end a
 * game they meant to pause (spec UX Expectations / Product Risk "Accidental Stop"):
 *   - Pause is a neutral/secondary button ("leave but keep it").
 *   - Stop carries danger weight ("end it") via .btn--danger and an explicit label.
 *
 * This component is presentational — it owns no session state and never calls the API
 * directly; Pause/Stop semantics (pointer keep vs clear, navigation) live in the page.
 */
export function GameSessionControls({ onPause, onStop, busy = false }: GameSessionControlsProps): React.ReactElement {
  return (
    <div className="game-session-controls" role="group" aria-label="Game session controls">
      <button
        className="btn btn--secondary game-session-controls__pause"
        type="button"
        onClick={onPause}
        disabled={busy}
      >
        Pause Game
      </button>
      <button
        className="btn btn--danger game-session-controls__stop"
        type="button"
        onClick={onStop}
        disabled={busy}
      >
        Stop Game
      </button>
    </div>
  );
}
