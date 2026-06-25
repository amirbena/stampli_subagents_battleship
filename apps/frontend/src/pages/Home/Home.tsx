import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame, joinGame } from '../../api/gameApi';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import { useActiveGame } from '../../hooks/useActiveGame';
import { useResumeGame } from '../../hooks/useResumeGame';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { PlayerNameEntry } from '../../components/common/PlayerNameEntry/PlayerNameEntry';
import { WelcomeBanner } from '../../components/common/WelcomeBanner/WelcomeBanner';
import { ResumeGameModal } from '../../components/common/ResumeGameModal/ResumeGameModal';
import { stopGame } from '../../api/gameApi';
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

  // Single source of truth for "an active/paused game exists" (localStorage pointer).
  // The same pointer is read by the route guard (RequireActiveSession) — one source,
  // no redirect-loop / blocked-resume class of bug (AC-3 ↔ AC-6 interplay).
  const { pointer, setPointer, clear: clearActiveGame } = useActiveGame();

  // Resume sequence: GET /state → optional POST resume → GET /state; clears the pointer
  // on 404/FINISHED and returns the resolved GameStateResponse (or null) to route by phase.
  const { resume } = useResumeGame();

  // True only while a resume/stop action triggered from the modal is in flight, so the
  // dialog disables both buttons and cannot be double-submitted.
  const [modalBusy, setModalBusy] = useState(false);

  // Routes the resumed game into the correct internal route by backend phase (AC-6).
  // PLACING_SHIPS / WAITING_FOR_PLAYERS → /lobby; IN_PROGRESS → /game.
  // FINISHED or 404 resolve to a null state inside useResumeGame (pointer already cleared
  // there) — we simply stay on a clean Home, modal gone (AC-13, AC-14).
  const handleResume = async (): Promise<void> => {
    if (!pointer) return;
    setError(null);
    setModalBusy(true);
    try {
      const state = await resume(pointer);
      if (!state) {
        // Stale (404) or FINISHED. useResumeGame cleared ITS OWN useActiveGame instance, but
        // this page holds a separate instance — clear here too so the modal disappears and a
        // reload shows a clean Home (AC-13, AC-14). clear() is idempotent.
        clearActiveGame();
        return;
      }
      if (state.status === 'IN_PROGRESS') {
        navigate('/game');
      } else if (state.status === 'FINISHED') {
        // Defensive: a FINISHED game is never resumable — clear and stay on clean Home.
        clearActiveGame();
      } else {
        // WAITING_FOR_PLAYERS or PLACING_SHIPS → continue in the lobby.
        navigate('/lobby');
      }
    } catch (e) {
      // Transient / non-404 failure: keep the pointer (game stays resumable) and surface
      // a retryable error — do NOT silently destroy the session on a connectivity blip.
      setError(e instanceof Error ? e.message : 'Could not resume your game. Please try again.');
    } finally {
      setModalBusy(false);
    }
  };

  // No / Stop from the prompt: end the session and clear the pointer so no modal appears
  // on this or any subsequent reload (AC-7, AC-14). Stop is idempotent on the backend
  // (204 even when already gone), so a stale game never throws here.
  const handleStopFromPrompt = async (): Promise<void> => {
    if (!pointer) return;
    setError(null);
    setModalBusy(true);
    try {
      await stopGame(pointer.gameId, pointer.playerId);
    } catch (e) {
      // Backend is source of truth: if Stop genuinely failed, do not falsely show a clean
      // Home — surface the error and keep the pointer so the user can retry.
      setError(e instanceof Error ? e.message : 'Could not stop the game. Please try again.');
      setModalBusy(false);
      return;
    }
    clearActiveGame();
    setModalBusy(false);
  };

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
      // Persist the active-game pointer (localStorage) so the game survives refresh /
      // tab close / browser restart and the guard admits the internal routes (AC-1/2/3).
      setPointer({ gameId: res.gameId, playerId: res.playerId, gameMode: 'HUMAN' });
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
      setPointer({ gameId: res.gameId, playerId: res.playerId, gameMode: 'COMPUTER' });
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
      setPointer({ gameId: res.gameId, playerId: res.playerId, gameMode: 'HUMAN' });
      navigate('/lobby');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="home-page">
      {/* Blocking resume dialog — renders ONLY when an active/paused game pointer exists.
          A clean Home (pointer null) shows no modal and behaves exactly as before (AC-5, AC-7). */}
      {pointer && (
        <ResumeGameModal
          onResume={() => { void handleResume(); }}
          onStop={() => { void handleStopFromPrompt(); }}
          busy={modalBusy}
        />
      )}

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
