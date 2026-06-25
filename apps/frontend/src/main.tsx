import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home/Home';
import { Lobby } from './pages/Lobby/Lobby';
import { Game } from './pages/Game/Game';
import { GameOver } from './pages/GameOver/GameOver';
import { GlobalLoader } from './components/common/GlobalLoader/GlobalLoader';
import { RequireActiveSession } from './components/common/RequireActiveSession/RequireActiveSession';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Global non-blocking HTTP loader — visible for any user-initiated request. */}
      <GlobalLoader />
      <Routes>
        {/* Home is the only unguarded door — the guard only ever redirects *into* it. */}
        <Route path="/" element={<Home />} />
        {/* Internal routes require a valid active-game pointer (AC-3, AC-4); the guard
            reads the same useActiveGame source as the Home resume modal — no redirect loop. */}
        <Route element={<RequireActiveSession />}>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game" element={<Game />} />
          <Route path="/game-over" element={<GameOver />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
