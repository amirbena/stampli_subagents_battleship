import React, { useEffect, useState } from 'react';
import { CANT_SHOOT_NOTICE_MS } from '../../../utils/turnTiming';
import './CantShootToast.css';

interface CantShootToastProps {
  // Incremented by the parent each time the player clicks the board during the
  // computer's turn. A new value (re)shows the notice and resets its timer, so
  // repeated clicks refresh a single notice rather than stacking many.
  trigger: number;
}

export function CantShootToast({ trigger }: CantShootToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  // Re-run on every trigger change (including repeated blocked clicks) to refresh the
  // notice and restart the auto-dismiss timer. trigger === 0 is the initial idle state.
  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), CANT_SHOOT_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="cant-shoot-toast" role="status" aria-live="polite">
      Can't shoot — computer is playing
    </div>
  );
}
