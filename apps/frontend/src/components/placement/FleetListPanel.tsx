import React from 'react';
import type { ShipType, Orientation } from '../../types/game';
import { ALL_SHIP_TYPES } from '../../types/game';
import { FleetShipItem } from './FleetShipItem';
import { RotateButton } from './RotateButton';

interface FleetListPanelProps {
  placedShipTypes: ShipType[];
  selectedShipType: ShipType | null;
  orientation: Orientation;
  onSelectShip: (type: ShipType) => void;
  onToggleOrientation: () => void;
  onRemoveShip: (type: ShipType) => void;
}

export function FleetListPanel({
  placedShipTypes,
  selectedShipType,
  orientation,
  onSelectShip,
  onToggleOrientation,
  onRemoveShip,
}: FleetListPanelProps): React.ReactElement {
  return (
    <div className="fleet-list-panel">
      <h3 className="fleet-list-title">Your Fleet</h3>
      <div className="fleet-list">
        {ALL_SHIP_TYPES.map((type) => (
          <div key={type} className="fleet-ship-row">
            <FleetShipItem
              shipType={type}
              placed={placedShipTypes.includes(type)}
              selected={selectedShipType === type}
              onSelect={onSelectShip}
            />
            {placedShipTypes.includes(type) && (
              <button
                className="remove-ship-btn"
                onClick={() => onRemoveShip(type)}
                type="button"
                aria-label={`Remove ${type}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {selectedShipType && (
        <div className="rotate-section">
          <RotateButton orientation={orientation} onRotate={onToggleOrientation} />
          <p className="rotate-hint">Or press <kbd>R</kbd> to rotate</p>
        </div>
      )}
    </div>
  );
}
