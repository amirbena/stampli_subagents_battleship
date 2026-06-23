import React, { useEffect, useState } from 'react';
import './PlacementErrorToast.css';

interface PlacementErrorToastProps {
  message: string | null;
}

/**
 * Auto-dismissing toast for ship placement errors.
 * Shown for 3 seconds then fades out — same lifecycle as ShotResultToast.
 * Technical backend messages are translated to user-friendly copy before reaching this component.
 */
export function PlacementErrorToast({ message }: PlacementErrorToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  // Show the toast whenever a new non-null message arrives; auto-dismiss after 3 s
  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div className="placement-error-toast" role="alert">
      {message}
    </div>
  );
}
