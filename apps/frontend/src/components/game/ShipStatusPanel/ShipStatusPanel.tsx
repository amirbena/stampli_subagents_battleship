import React from 'react';
import type { ShipDto, ShipType } from '../../../types/game';
import { SHIP_DISPLAY_NAMES, ALL_SHIP_TYPES } from '../../../types/game';
import './ShipStatusPanel.css';

interface ShipStatusPanelProps {
  myShips: ShipDto[];
  opponentSunkTypes: ShipType[];
}

export function ShipStatusPanel({ myShips, opponentSunkTypes }: ShipStatusPanelProps): React.ReactElement {
  return (
    <div className="ship-status-panel">
      <div className="ship-status-section">
        <h4>My Fleet</h4>
        <ul className="ship-status-list">
          {myShips.map((ship) => (
            <li key={ship.shipType} className={`ship-status-item ${ship.sunk ? 'ship-status-item--sunk' : ''}`}>
              <span>{SHIP_DISPLAY_NAMES[ship.shipType]}</span>
              <span>{ship.sunk ? 'Sunk' : `${ship.cells.length - ship.hits.length}hp`}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ship-status-section">
        <h4>Enemy Sunk</h4>
        <ul className="ship-status-list">
          {ALL_SHIP_TYPES.map((type) => (
            <li key={type} className={`ship-status-item ${opponentSunkTypes.includes(type) ? 'ship-status-item--sunk' : 'ship-status-item--unknown'}`}>
              {SHIP_DISPLAY_NAMES[type]}: {opponentSunkTypes.includes(type) ? 'Sunk' : '?'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
