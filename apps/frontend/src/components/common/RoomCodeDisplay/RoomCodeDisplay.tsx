import React, { useRef, useState } from 'react';
import './RoomCodeDisplay.css';

interface RoomCodeDisplayProps {
  gameId: string;
}

// Feedback states for the copy interaction:
// - idle:     default "Copy" button.
// - copied:   programmatic clipboard write succeeded.
// - fallback: clipboard API is unavailable or rejected, so we selected the
//             text for the user and prompt them to copy manually (Ctrl/Cmd+C).
type CopyState = 'idle' | 'copied' | 'fallback';

export function RoomCodeDisplay({ gameId }: RoomCodeDisplayProps): React.ReactElement {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const valueRef = useRef<HTMLSpanElement>(null);

  // Fallback path: programmatically select the room-code text so the user can
  // copy it manually. Used when the Clipboard API is missing (insecure context)
  // or rejects (permission denied / document not focused). Never a silent no-op.
  const selectRoomCodeText = () => {
    const node = valueRef.current;
    const selection = window.getSelection();
    if (node && selection) {
      const range = document.createRange();
      range.selectNodeContents(node);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setCopyState('fallback');
  };

  const handleCopy = () => {
    // Guard: navigator.clipboard is undefined in insecure (non-HTTPS) contexts
    // and some embedded webviews — never call .writeText on undefined.
    if (!navigator.clipboard?.writeText) {
      selectRoomCodeText();
      return;
    }

    navigator.clipboard
      .writeText(gameId)
      .then(() => {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch(() => {
        // Real fallback (not silent): select text + prompt manual copy.
        selectRoomCodeText();
      });
  };

  const buttonLabel =
    copyState === 'copied'
      ? 'Copied!'
      : copyState === 'fallback'
        ? 'Press Ctrl+C to copy'
        : 'Copy';

  return (
    <div className="room-code-display">
      <span className="room-code-label">Room Code</span>
      <span className="room-code-value" ref={valueRef}>
        {gameId}
      </span>
      <button
        className="copy-btn"
        onClick={handleCopy}
        type="button"
        aria-live="polite"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
