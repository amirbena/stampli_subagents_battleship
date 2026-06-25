import React, { useEffect, useRef } from 'react';
import './ResumeGameModal.css';

/**
 * Exact, product-locked resume prompt copy. Asserted verbatim in the component test
 * so a copy regression fails the build (AC-5). Do not edit without a spec change.
 */
export const RESUME_MODAL_TEXT = 'Do you want to continue your existing game?';

interface ResumeGameModalProps {
  /** Yes / Resume — runs the resume sequence and navigates by resolved phase. */
  onResume: () => void;
  /** No / Stop — ends the session, clears the pointer, returns to a clean Home. */
  onStop: () => void;
  /** Disables both buttons while a resume/stop request is in flight (prevents double-submit). */
  busy?: boolean;
}

/**
 * Blocking foreground dialog shown on Home when an active/paused game pointer exists.
 *
 * This is a true dialog (role="dialog", aria-modal), NOT a toast — it requires a
 * deliberate Yes/No choice and must not auto-dismiss (spec UX Expectations / A4).
 * The parent (Home) controls whether it renders at all (pointer non-null); this
 * component is purely presentational and owns no session state.
 */
export function ResumeGameModal({ onResume, onStop, busy = false }: ResumeGameModalProps): React.ReactElement {
  const resumeBtnRef = useRef<HTMLButtonElement>(null);

  // Move focus to the primary action when the dialog opens so keyboard users land
  // inside the dialog rather than behind it (basic modal a11y; full focus-trap is
  // out of scope for v1 and not required by the spec).
  useEffect(() => {
    resumeBtnRef.current?.focus();
  }, []);

  return (
    <div className="resume-modal-overlay">
      <div
        className="resume-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-modal-title"
      >
        <p id="resume-modal-title" className="resume-modal-text">
          {RESUME_MODAL_TEXT}
        </p>
        <div className="resume-modal-actions">
          <button
            ref={resumeBtnRef}
            className="btn btn--primary"
            type="button"
            onClick={onResume}
            disabled={busy}
          >
            Yes, Resume
          </button>
          <button
            className="btn btn--danger"
            type="button"
            onClick={onStop}
            disabled={busy}
          >
            No, Stop
          </button>
        </div>
      </div>
    </div>
  );
}
