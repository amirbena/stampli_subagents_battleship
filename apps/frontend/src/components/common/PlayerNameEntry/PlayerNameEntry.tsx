import React, { useState } from 'react';
import './PlayerNameEntry.css';

interface PlayerNameEntryProps {
  /** Called when the user submits a valid-looking name. The component itself
   *  does NOT validate — it passes the raw value; errors come back as errorMessage. */
  onSubmit: (displayName: string) => Promise<void>;
  /** Backend or network error message to show inline (EC-05, EC-06, AC-02–04). */
  errorMessage: string | null;
}

// Error code → human-readable label mapping mirrors product-spec §Error States.
const ERROR_CODE_MESSAGES: Record<string, string> = {
  DISPLAY_NAME_REQUIRED: 'Display name is required',
  DISPLAY_NAME_TOO_LONG: 'Display name must be 30 characters or fewer',
  DISPLAY_NAME_INVALID_CHARS:
    'Display name may only contain letters, numbers, spaces, hyphens, and underscores',
};

/** Translate a raw error string (backend code or generic message) into a display string. */
function resolveErrorMessage(raw: string): string {
  return ERROR_CODE_MESSAGES[raw] ?? raw;
}

export function PlayerNameEntry({
  onSubmit,
  errorMessage,
}: PlayerNameEntryProps): React.ReactElement {
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(displayName);
    } catch {
      // The caller (usePlayerIdentity.createPlayer) owns error state propagation.
      // We only need to re-enable the button here so the user can retry (EC-06).
    } finally {
      setSubmitting(false);
    }
  };

  const resolvedError = errorMessage ? resolveErrorMessage(errorMessage) : null;

  return (
    <section className="player-name-entry" aria-label="Enter your display name">
      <h2 className="player-name-entry__title">Choose a display name</h2>
      <p className="player-name-entry__hint">
        You need a display name before you can start playing.
      </p>
      <form
        className="player-name-entry__form"
        onSubmit={(e) => { void handleSubmit(e); }}
        noValidate
      >
        <label className="player-name-entry__label" htmlFor="display-name-input">
          Display name
        </label>
        <input
          id="display-name-input"
          className={`player-name-entry__input${resolvedError ? ' player-name-entry__input--error' : ''}`}
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={31}
          autoComplete="nickname"
          autoFocus
          aria-describedby={resolvedError ? 'name-error' : undefined}
          aria-invalid={resolvedError ? 'true' : undefined}
          disabled={submitting}
        />
        {resolvedError && (
          <p
            id="name-error"
            className="player-name-entry__error"
            role="alert"
          >
            {resolvedError}
          </p>
        )}
        <button
          className="btn btn--primary player-name-entry__submit"
          type="submit"
          // EC-05: disabled while a submission is in flight to prevent duplicate POSTs.
          disabled={submitting}
        >
          {submitting ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </section>
  );
}
