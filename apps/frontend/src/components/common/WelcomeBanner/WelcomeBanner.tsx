import React from 'react';
import './WelcomeBanner.css';

interface WelcomeBannerProps {
  displayName: string;
}

/** Shown on the home page when a returning visitor's identity resolves successfully (AC-07). */
export function WelcomeBanner({ displayName }: WelcomeBannerProps): React.ReactElement {
  return (
    <p className="welcome-banner" aria-live="polite">
      Welcome back, <strong className="welcome-banner__name">{displayName}</strong>!
    </p>
  );
}
