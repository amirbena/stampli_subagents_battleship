import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, joinGame } from '../../api/gameApi';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import './Home.css';

export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await createGame();
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
      const res = await createGame('COMPUTER');
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
      const res = await joinGame(code);
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

      <ErrorMessage message={error} />

      <div className="home-actions">
        <section className="home-section">
          <h2>New Game</h2>
          <button
            className="btn btn--primary"
            onClick={() => { void handleCreate(); }}
            disabled={creating}
            type="button"
          >
            {creating ? 'Creating…' : 'Create Game'}
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => { void handleCreateVsComputer(); }}
            disabled={creating}
            type="button"
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
              disabled={joining}
            >
              {joining ? 'Joining…' : 'Join Game'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
