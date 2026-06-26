import React, { useEffect, useState } from 'react';
import type { ShotResult, ShipType } from '../../../types/game';
import { SHIP_DISPLAY_NAMES } from '../../../types/game';
import { RESULT_TOAST_HIT_MS, RESULT_TOAST_MISS_MS } from '../../../utils/turnTiming';
import './ShotResultToast.css';

interface ShotResultToastProps {
  result: ShotResult | null;
  sunkShipType: ShipType | null;
}

export function ShotResultToast({ result, sunkShipType }: ShotResultToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      // A successful shot (HIT/SUNK) lingers ~0.5s longer than a MISS; both are shorter
      // than the previous flat 2.5s. SUNK is treated as a hit for timing.
      const duration = result === 'MISS' ? RESULT_TOAST_MISS_MS : RESULT_TOAST_HIT_MS;
      const timer = setTimeout(() => setVisible(false), duration);
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
