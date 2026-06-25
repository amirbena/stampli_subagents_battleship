import React, { useEffect, useRef } from 'react';
import { RoomCodeDisplay } from '../RoomCodeDisplay/RoomCodeDisplay';
import './GameCodePopup.css';

/**
 * Product-locked heading for the start-of-game code popup. Asserted verbatim in the
 * component test so a copy regression fails the build (AC-5).
 */
export const GAME_CODE_POPUP_TITLE = 'Save your game code';

interface GameCodePopupProps {
  /** The game's code (gameId) shown selectable + copyable so the player can save it (AC-6). */
  gameId: string;
  /** Acknowledge — dismisses the popup and proceeds into the game (AC-5, Flow A step 4). */
  onAcknowledge: () => void;
}

/**
 * Start-of-game code popup (AC-5/AC-6). Reuses the ResumeGameModal overlay/dialog pattern
 * and CSS so it looks and behaves like the app's other blocking dialogs. The code itself
 * is rendered via the existing RoomCodeDisplay, which already provides selectable text plus
 * a copy-to-clipboard affordance (AC-6 satisfied without duplicating clipboard logic).
 *
 * This dialog is additive: the parent (Home) renders it after a computer game is created and
 * proceeds into the game only once the player acknowledges. It owns no session state.
 */
export function GameCodePopup({ gameId, onAcknowledge }: GameCodePopupProps): React.ReactElement {
  const ackBtnRef = useRef<HTMLButtonElement>(null);

  // Land keyboard focus on the acknowledge action when the dialog opens (basic modal a11y;
  // matches ResumeGameModal — full focus-trap is out of scope for v1).
  useEffect(() => {
    ackBtnRef.current?.focus();
  }, []);

  return (
    <div className="resume-modal-overlay">
      <div
        className="resume-modal game-code-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-code-popup-title"
      >
        <p id="game-code-popup-title" className="resume-modal-text">
          {GAME_CODE_POPUP_TITLE}
        </p>
        <p className="game-code-popup-hint">
          Use this code later to return to this game.
        </p>
        <div className="game-code-popup-code">
          <RoomCodeDisplay gameId={gameId} />
        </div>
        <div className="resume-modal-actions">
          <button
            ref={ackBtnRef}
            className="btn btn--primary"
            type="button"
            onClick={onAcknowledge}
          >
            Got it, start playing
          </button>
        </div>
      </div>
    </div>
  );
}
