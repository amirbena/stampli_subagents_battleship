import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '../../api/gameApi';
import { usePlayerIdentity } from '../../hooks/usePlayerIdentity';
import { useActiveGame } from '../../hooks/useActiveGame';
import { useResumeGame } from '../../hooks/useResumeGame';
import { useBelongingProbe } from '../../hooks/useBelongingProbe';
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

  // Belonging probe (architecture §6.2 step 2 — owned by frontend-api-agent). A READ-ONLY
  // check that, given the browser's own belonging record (gameId + playerId + sessionToken),
  // confirms with the backend whether the seat is still resumable. It NEVER mints, never
  // resumes, never writes a pointer. Outcomes:
  //   'eligible'  → belonging proven AND game non-terminal → popup may show.
  //   'cleared'   → 404/403 (gone / not-owned / terminal): the hook has already quiet-cleared
  //                 the belonging record. No popup, clean Home (AC-12, AC-13, Flow 5).
  //   'transient' → 5xx/network: record PRESERVED, no popup, retry allowed. A connectivity
  //                 blip never downgrades belonging (Error States).
  const { probe } = useBelongingProbe();

  // Resume-popup eligibility flag (architecture §6.2). Starts false and only becomes true
  // after BOTH (a) a stored belonging record with a non-empty sessionToken exists AND
  // (b) the belonging probe returns 'eligible'. Mere pointer/token presence is NOT enough —
  // the popup is gated on a *confirmed resumable* seat, never on knowledge of a code.
  const [probeEligible, setProbeEligible] = useState(false);

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

  // Step-1 belonging signal (architecture §6.2.1, AC-1/AC-2/AC-8): a stored belonging record
  // exists WITH a non-empty sessionToken. The token is set ONLY from a create/join mint
  // response (never from a read/restore), so its presence is what proves THIS browser minted
  // a seat — belonging, not mere knowledge of a code. A browser that only typed a code has no
  // token and therefore can never satisfy step 1, so it never even probes and never sees the
  // popup for that game (AC-2/AC-8).
  const hasBelongingToken = Boolean(pointer?.sessionToken);

  // Load-time belonging probe (architecture §6.2 step 2). Runs only when step 1 holds. We
  // never show the popup on token presence alone — the seat must be confirmed still resumable.
  // Dep array: re-probe when the belonging identity (gameId + token) changes. `probe` is a
  // stable useCallback from the hook. On 'eligible' we arm the popup; on 'cleared' the hook
  // already discarded the record (and we defensively clear our own pointer instance so the
  // modal can never linger); on 'transient' we leave everything intact and simply show no popup.
  useEffect(() => {
    if (!pointer || !hasBelongingToken) {
      setProbeEligible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const outcome = await probe(pointer);
      if (cancelled) return;
      if (outcome === 'eligible') {
        setProbeEligible(true);
      } else {
        // 'cleared' or 'transient' → no popup. On 'cleared' the belonging record is gone; we
        // also clear our own useActiveGame instance so a clean Home renders with no modal.
        setProbeEligible(false);
        if (outcome === 'cleared') clearActiveGame();
      }
    })();
    return () => {
      cancelled = true;
    };
    // gameId + sessionToken uniquely identify the seat being probed; re-run if either changes.
  }, [pointer?.gameId, pointer?.sessionToken, hasBelongingToken, probe, clearActiveGame, pointer]);

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
      await stopGame(pointer.gameId, pointer.playerId, pointer.sessionToken);
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
      // Persist the belonging record WITH the minted sessionToken (architecture §6.2.1). The
      // token comes only from this mint response — it is what makes THIS browser eligible for
      // the resume popup later (belonging, not mere code knowledge). Never sourced from a read.
      setPointer({
        gameId: res.gameId,
        playerId: res.playerId,
        gameMode: 'COMPUTER',
        sessionToken: res.sessionToken,
      });
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

  // Restore-by-code (AC-2/AC-7/AC-8). Restore is now a BELONGING PROBE (architecture §4.3):
  // the caller must prove ownership of the seat with its own playerId + sessionToken. We source
  // both from the stored pointer when present. A fresh/non-owning browser has no pointer (or a
  // token-less one): it passes empty credentials and the backend returns the generic 404
  // ("Game not found or not joinable"), so a code-bearer is NEVER handed another player's
  // identity and NO belonging record is written (requirement item 3). Trim whitespace first.
  // On not-found the hook sets `notFound`; we stay on Home and show the inline message.
  const handleRestore = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setRestoreValidation(null);
    const code = restoreCode.trim();
    if (!code) {
      setRestoreValidation('Please enter a game code');
      return;
    }
    try {
      // Caller's own credentials (empty when this browser holds no belonging) — a tokenless
      // probe correctly 404s rather than crashing or inheriting an identity.
      const data = await submitRestore(code, pointer?.playerId ?? '', pointer?.sessionToken ?? '');
      if (!data) {
        // Authoritative 404 — useRestoreGame set `notFound`; stay on Home, show inline message.
        return;
      }
      // Rehydrate the session pointer from the restore response, then route by status.
      // CRITICAL (architecture §6.2, requirement item 3): a belonging sessionToken is NEVER
      // sourced from a read/restore — only from a create/join mint. Restore by code therefore
      // does NOT write a new token. The backend already proved ownership (it only returns a
      // body to the owner holding the token; a non-owning browser got a 404 handled above and
      // never reaches here). The OWNING browser already holds its token, so we carry it forward
      // when the restored game matches the one we already belong to; otherwise we write a
      // token-less pointer (sufficient to view/route, but never popup-eligible — knowing a code
      // can rehydrate a view, it can never fabricate belonging).
      const preservedToken = pointer?.gameId === data.gameId ? pointer.sessionToken : '';
      setPointer({
        gameId: data.gameId,
        playerId: data.playerId,
        gameMode: data.gameMode,
        sessionToken: preservedToken,
      });
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
      {/* Blocking resume dialog — belonging-gated (architecture §6.2). Renders ONLY when ALL hold:
          (1) a stored belonging record with a non-empty sessionToken (hasBelongingToken) — proves
              this browser minted a seat, not mere code knowledge (AC-1/AC-2/AC-8);
          (2) the belonging probe confirmed the seat is still resumable (probeEligible) (AC-3/AC-12);
          (3) !computerCode — the freshly-created-code popup still takes precedence (preserved).
          A browser that only typed a code (no token) never reaches step 1, so it never sees the
          popup; a stale/terminal/not-owned seat fails the probe and the record is quietly cleared. */}
      {hasBelongingToken && probeEligible && !computerCode && (
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
