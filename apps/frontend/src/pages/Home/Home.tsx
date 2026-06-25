import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '../../api/gameApi';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import { useActiveGame } from '../../hooks/useActiveGame';
import { useResumeGame } from '../../hooks/useResumeGame';
import { useRestoreGame } from '../../hooks/useRestoreGame';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { PlayerNameEntry } from '../../components/common/PlayerNameEntry/PlayerNameEntry';
import { WelcomeBanner } from '../../components/common/WelcomeBanner/WelcomeBanner';
import { ResumeGameModal } from '../../components/common/ResumeGameModal/ResumeGameModal';
import { GameCodePopup } from '../../components/common/GameCodePopup/GameCodePopup';
import { stopGame } from '../../api/gameApi';
import './Home.css';

export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  // Restore-by-code (AC-7/AC-8/AC-9/AC-10). Data hook owns the request, loading, the
  // friendly 404 `notFound` signal, and transient errors. Navigation + pointer writes
  // (below) are this page's job.
  const { submit: submitRestore, isLoading: restoring, notFound: restoreNotFound, error: restoreError } = useRestoreGame();
  const [restoreCode, setRestoreCode] = useState('');
  // Gentle inline validation for an empty submit (AC: empty code → no nav, just a hint).
  const [restoreValidation, setRestoreValidation] = useState<string | null>(null);

  // When a COMPUTER game is created, hold its code here so the start-of-game popup renders
  // (AC-5/AC-6). The player proceeds into the game only after acknowledging it.
  const [computerCode, setComputerCode] = useState<string | null>(null);

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
  const gameActionsDisabled = status === 'needs-name' || creating;

  const handleCreateVsComputer = async () => {
    setError(null);
    setCreating(true);
    try {
      // Pass the resolved playerId so the backend links playerA to the Player record (AC-11).
      const res = await createGame('COMPUTER', player?.playerId);
      setPointer({ gameId: res.gameId, playerId: res.playerId, gameMode: 'COMPUTER' });
      // Show the start-of-game code popup (AC-5/AC-6) BEFORE entering the game. The player
      // proceeds into the game only on acknowledge (handleAcknowledgeCode). The pointer is
      // already written, so the guard admits the internal route once we navigate.
      setComputerCode(res.gameId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  // Acknowledge the code popup → dismiss it and proceed into the game (Flow A step 4).
  // A freshly created computer game starts at PLACING_SHIPS, so it enters via /lobby,
  // matching the existing computer-game start flow.
  const handleAcknowledgeCode = (): void => {
    setComputerCode(null);
    navigate('/lobby');
  };

  // Restore-by-code (AC-7/8/9/10). Trim whitespace before calling the hook (edge case).
  // On success: write the pointer from the response and route by status. On not-found:
  // the hook sets `notFound`; we stay on Home and show the inline message (no nav, no
  // broken board). Empty submit → gentle validation, no nav.
  const handleRestore = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setRestoreValidation(null);
    const code = restoreCode.trim();
    if (!code) {
      setRestoreValidation('Please enter a game code');
      return;
    }
    try {
      const data = await submitRestore(code);
      if (!data) {
        // Authoritative 404 — useRestoreGame set `notFound`; stay on Home, show inline message.
        return;
      }
      // Rehydrate the session pointer from the restore response, then route by status.
      setPointer({ gameId: data.gameId, playerId: data.playerId, gameMode: data.gameMode });
      if (data.status === 'IN_PROGRESS' || data.status === 'PAUSED') {
        navigate('/game');
      } else if (data.status === 'FINISHED') {
        navigate('/game-over');
      } else {
        // WAITING_FOR_PLAYERS / PLACING_SHIPS → continue placement in the lobby.
        navigate('/lobby');
      }
    } catch {
      // Transient/5xx/network — useRestoreGame set `error`; surfaced inline below. Stay on Home.
    }
  };

  return (
    <main className="home-page">
      {/* Blocking resume dialog — renders ONLY when an active/paused game pointer exists.
          A clean Home (pointer null) shows no modal and behaves exactly as before (AC-5, AC-7). */}
      {pointer && !computerCode && (
        <ResumeGameModal
          onResume={() => { void handleResume(); }}
          onStop={() => { void handleStopFromPrompt(); }}
          busy={modalBusy}
        />
      )}

      {/* Start-of-game code popup for a freshly created COMPUTER game (AC-5/AC-6).
          Acknowledging proceeds into the game. Takes precedence over the resume modal
          (a just-created game has no prior session to resume). */}
      {computerCode && (
        <GameCodePopup gameId={computerCode} onAcknowledge={handleAcknowledgeCode} />
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
            className="btn btn--secondary"
            onClick={() => { void handleCreateVsComputer(); }}
            disabled={gameActionsDisabled}
            type="button"
            aria-disabled={gameActionsDisabled}
          >
            {creating ? 'Creating…' : 'Play vs Computer'}
          </button>
          {/* Multiplayer is not ready (AC-14): the button is disabled (not clickable) and
              clearly reads "Coming Soon", not just inert on click. */}
          <button
            className="btn btn--primary"
            type="button"
            disabled
            aria-disabled="true"
            style={{ marginTop: '0.5rem' }}
          >
            Play Against Another User (Coming Soon)
          </button>
        </section>

        <div className="home-divider">or</div>

        <section className="home-section">
          <h2>Restore Game</h2>
          {/* Restore-by-code (AC-7/8/9/10): enter an existing game code to resume that
              computer game with its saved board state. */}
          <form onSubmit={(e) => { void handleRestore(e); }} className="join-form">
            <input
              className="room-code-input"
              type="text"
              placeholder="Enter game code"
              value={restoreCode}
              onChange={(e) => {
                setRestoreCode(e.target.value);
                // Clear stale validation/not-found hints as the user edits the code.
                if (restoreValidation) setRestoreValidation(null);
              }}
              maxLength={6}
              aria-label="Game code"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <button
              className="btn btn--secondary"
              type="submit"
              disabled={restoring}
              aria-disabled={restoring}
            >
              {restoring ? 'Restoring…' : 'Restore Game'}
            </button>
          </form>
          {/* Inline, near-the-input feedback — never a navigation to a broken page (AC-9). */}
          {restoreValidation && (
            <p className="restore-hint" role="alert">{restoreValidation}</p>
          )}
          {restoreNotFound && (
            <p className="restore-error" role="alert">Game not found or no longer available</p>
          )}
          {restoreError && !restoreNotFound && (
            <p className="restore-error" role="alert">{restoreError}</p>
          )}
        </section>
      </div>
    </main>
  );
}
