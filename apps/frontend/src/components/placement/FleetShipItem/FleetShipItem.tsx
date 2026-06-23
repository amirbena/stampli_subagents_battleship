import React from 'react';
import type { ShipType } from '../../../types/game';
import { SHIP_DISPLAY_NAMES, SHIP_SIZES } from '../../../types/game';
import './FleetShipItem.css';

interface FleetShipItemProps {
  shipType: ShipType;
  placed: boolean;
  selected: boolean;
  onSelect: (type: ShipType) => void;
}

export function FleetShipItem({
  shipType,
  placed,
  selected,
  onSelect,
}: FleetShipItemProps): React.ReactElement {
  const size = SHIP_SIZES[shipType];

  return (
    <button
      className={`fleet-ship-item${selected ? ' fleet-ship-item--selected' : ''}${placed ? ' fleet-ship-item--placed' : ''}`}
      onClick={() => !placed && onSelect(shipType)}
      type="button"
      aria-pressed={selected}
      aria-label={`${SHIP_DISPLAY_NAMES[shipType]}, size ${size}${placed ? ', placed' : ''}`}
      disabled={placed}
    >
      <span className="fleet-ship-name">{SHIP_DISPLAY_NAMES[shipType]}</span>
      <span className="fleet-ship-size">
        {Array.from({ length: size }).map((_, i) => (
          <span key={i} className="fleet-ship-block" />
        ))}
      </span>
      {placed && <span className="fleet-ship-badge">Placed</span>}
    </button>
  );
}
