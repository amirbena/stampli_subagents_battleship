import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  label?: string;
}

export function LoadingSpinner({ label = 'Loading…' }: LoadingSpinnerProps): React.ReactElement {
  return (
    <div className="loading-spinner" aria-label={label}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
