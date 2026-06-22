import React from 'react';
import type { Orientation } from '../../types/game';

interface RotateButtonProps {
  orientation: Orientation;
  onRotate: () => void;
}

export function RotateButton({ orientation, onRotate }: RotateButtonProps): React.ReactElement {
  return (
    <button
      className="rotate-btn"
      onClick={onRotate}
      type="button"
      aria-label={`Rotate ship (currently ${orientation.toLowerCase()})`}
      title="Press R to rotate"
    >
      ↻ {orientation === 'HORIZONTAL' ? 'Horizontal' : 'Vertical'}
    </button>
  );
}
