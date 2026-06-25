import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, joinGame } from '../../api/gameApi';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { PlayerNameEntry } from '../../components/common/PlayerNameEntry/PlayerNameEntry';
import { WelcomeBanner } from '../../components/common/WelcomeBanner/WelcomeBanner';
import './Home.css';

export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Identity hook: resolves the player from localStorage (+ backend GET /players).
  // Returns 'loading' while the background check runs, 'identified' once resolved,
  // or 'needs-name' when no valid identity exists yet.
  const { player, status, createPlayer, error: identityError } = usePlayerIdentity();

  // Local name-entry error: captures errors thrown by createPlayer (validation / network).
  // The hook's `error` field covers GET /players errors; this covers POST /players errors.
  const [nameEntryError, setNameEntryError] = useState<string | null>(null);

  const handleCreatePlayer = async (displayName: string): Promise<void> => {
    setNameEntryError(null);
    try {
      await createPlayer(displayName);
    } catch (e) {
      // Extract the error code or message from the backend error (EC-05, EC-06, AC-02–04).
      // The axios interceptor normalises { error, code } responses into Error(message) where
      // message is the backend `error` field. We store the raw message; PlayerNameEntry
      // maps known codes to display strings.
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setNameEntryError(msg);
      // Re-throw so PlayerNameEntry's try/catch can re-enable the submit button.
      throw e;
    }
  };

  // Game-start buttons are disabled until identity is resolved (AC-01, AC-15).
  // Exception: if a localStorage id exists, buttons are optimistically enabled while
  // the background GET /players validates — they only get disabled back to 'needs-name'
  // if that call returns 404 (UX Expectations, product-spec).
  const gameActionsDisabled = status === 'needs-name' || creating || joining;

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      // Pass the resolved playerId so the backend links playerA to the Player record (AC-12).
      const res = await createGame(undefined, player?.playerId);
      sessionStorage.setItem('gameId', res.gameId);
      sessionStorage.setItem('playerId', res.playerId);
      sessionStorage.setItem('gameMode', 'HUMAN');
      navigate('/lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateVsComputer = async () => {
    setError(null);
    setCreating(true);
    try {
      // Pass the resolved playerId so the backend links playerA to the Player record (AC-11).
      const res = await createGame('COMPUTER', player?.playerId);
      sessionStorage.setItem('gameId', res.gameId);
      sessionStorage.setItem('playerId', res.playerId);
      sessionStorage.setItem('gameMode', 'COMPUTER');
      navigate('/lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Please enter a room code');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      // Pass the resolved playerId so the backend links playerB to the Player record (AC-13).
      const res = await joinGame(code, player?.playerId);
      sessionStorage.setItem('gameId', res.gameId);
      sessionStorage.setItem('playerId', res.playerId);
      sessionStorage.setItem('gameMode', 'HUMAN');
      navigate('/lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="home-page">
      <h1 className="home-title">⚓ Battleship</h1>
      <p className="home-subtitle">Multiplayer naval combat</p>

      {/* Welcome back banner shown only when identity is resolved (AC-07). */}
      {status === 'identified' && player && (
        <WelcomeBanner displayName={player.displayName} />
      )}

      {/* Name-entry gate: shown when no valid identity exists (AC-01). */}
      {status === 'needs-name' && (
        <PlayerNameEntry
          onSubmit={handleCreatePlayer}
          errorMessage={nameEntryError ?? identityError}
        />
      )}

      <ErrorMessage message={error} />

      <div className="home-actions">
        <section className="home-section">
          <h2>New Game</h2>
          <button
            className="btn btn--primary"
            onClick={() => { void handleCreate(); }}
            // Disabled until identity is identified (AC-01, AC-15).
            disabled={gameActionsDisabled}
            type="button"
            aria-disabled={gameActionsDisabled}
          >
            {creating ? 'Creating…' : 'Create Game'}
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => { void handleCreateVsComputer(); }}
            disabled={gameActionsDisabled}
            type="button"
            aria-disabled={gameActionsDisabled}
            style={{ marginTop: '0.5rem' }}
          >
            {creating ? 'Creating…' : 'Play vs Computer'}
          </button>
        </section>

        <div className="home-divider">or</div>

        <section className="home-section">
          <h2>Join Game</h2>
          <form onSubmit={(e) => { void handleJoin(e); }} className="join-form">
            <input
              className="room-code-input"
              type="text"
              placeholder="Enter room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={6}
              aria-label="Room code"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button
              className="btn btn--secondary"
              type="submit"
              // Disabled until identity is identified (AC-01, AC-15).
              disabled={gameActionsDisabled}
              aria-disabled={gameActionsDisabled}
            >
              {joining ? 'Joining…' : 'Join Game'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
