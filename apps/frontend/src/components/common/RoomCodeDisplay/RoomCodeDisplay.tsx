import React, { useState } from 'react';
import './RoomCodeDisplay.css';

interface RoomCodeDisplayProps {
  gameId: string;
}

export function RoomCodeDisplay({ gameId }: RoomCodeDisplayProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(gameId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback: select text
    });
  };

  return (
    <div className="room-code-display">
      <span className="room-code-label">Room Code</span>
      <span className="room-code-value">{gameId}</span>
      <button className="copy-btn" onClick={handleCopy} type="button">
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
