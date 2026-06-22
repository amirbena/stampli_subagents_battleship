import React, { useEffect, useState } from 'react';
import type { ShotResult, ShipType } from '../../types/game';
import { SHIP_DISPLAY_NAMES } from '../../types/game';

interface ShotResultToastProps {
  result: ShotResult | null;
  sunkShipType: ShipType | null;
}

export function ShotResultToast({ result, sunkShipType }: ShotResultToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!visible || !result) return null;

  const message =
    result === 'SUNK' && sunkShipType
      ? `SUNK! You sunk their ${SHIP_DISPLAY_NAMES[sunkShipType]}!`
      : result === 'HIT'
        ? 'HIT!'
        : 'MISS';

  return (
    <div className={`shot-result-toast shot-result-toast--${result.toLowerCase()}`} role="status">
      {message}
    </div>
  );
}
