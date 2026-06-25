import React, { useEffect, useRef } from 'react';
import './LeaveConfirmModal.css';

/**
 * Product-locked leave-confirmation copy. Asserted verbatim in the component test so a
 * copy regression fails the build (AC-11). Do not edit without a spec change.
 */
export const LEAVE_MODAL_TEXT = 'Leave this game?';

interface LeaveConfirmModalProps {
  /** Stay — closes the modal, keeps the player in the game with full state (AC-12). */
  onStay: () => void;
  /** Leave — releases the game (existing Stop) and returns to the main screen (AC-13). */
  onLeave: () => void;
  /** Disables both buttons while the Leave (stop) request is in flight (prevents double-submit). */
  busy?: boolean;
}

/**
 * Stay/Leave confirmation shown when the player attempts to leave an active game —
 * including via the browser Back button (AC-11). Reuses the ResumeGameModal overlay/dialog
 * shell + CSS. Purely presentational: the parent (Game) owns the history guard, the stop
 * call, pointer clearing, and navigation. Stay must never lose game state; Leave must always
 * work.
 */
export function LeaveConfirmModal({ onStay, onLeave, busy = false }: LeaveConfirmModalProps): React.ReactElement {
  // Default focus to Stay (the safe, non-destructive choice) so an accidental Enter keeps
  // the player in the game rather than releasing it.
  const stayBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayBtnRef.current?.focus();
  }, []);

  return (
    <div className="resume-modal-overlay">
      <div
        className="resume-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-modal-title"
      >
        <p id="leave-modal-title" className="resume-modal-text">
          {LEAVE_MODAL_TEXT}
        </p>
        <p className="leave-modal-hint">Leaving releases this game and ends it. This cannot be undone.</p>
        <div className="resume-modal-actions">
          <button
            ref={stayBtnRef}
            className="btn btn--primary"
            type="button"
            onClick={onStay}
            disabled={busy}
          >
            Stay
          </button>
          <button
            className="btn btn--danger"
            type="button"
            onClick={onLeave}
            disabled={busy}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
