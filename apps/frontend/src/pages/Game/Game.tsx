import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fireShot, pauseGame, stopGame } from '../../api/gameApi';
import { useGamePolling } from '../../hooks/useGamePolling';
import { useTurnNotification } from '../../hooks/useTurnNotification';
import { useActiveGame } from '../../hooks/useActiveGame';
import { GameSessionControls } from '../../components/game/GameSessionControls/GameSessionControls';
import { GameBoard } from '../../components/board/GameBoard/GameBoard';
import { TurnIndicator } from '../../components/game/TurnIndicator/TurnIndicator';
import { ShotResultToast } from '../../components/game/ShotResultToast/ShotResultToast';
import { ShipStatusPanel } from '../../components/game/ShipStatusPanel/ShipStatusPanel';
import { FiringIndicator } from '../../components/game/FiringIndicator/FiringIndicator';
import { YourTurnToast } from '../../components/game/YourTurnToast/YourTurnToast';
import { CantShootToast } from '../../components/game/CantShootToast/CantShootToast';
import { ErrorMessage } from '../../components/common/ErrorMessage/ErrorMessage';
import { LoadingSpinner } from '../../components/common/LoadingSpinner/LoadingSpinner';
import { LeaveConfirmModal } from '../../components/common/LeaveConfirmModal/LeaveConfirmModal';
import { computeOwnBoardCells, computeOpponentBoardCells, getSunkShipTypes } from '../../utils/boardHelpers';
import { playShotSound } from '../../utils/sound';
import {
  COMPUTER_PLAYING_REVEAL_MS,
  COMPUTER_PLAYING_HOLD_MS,
} from '../../utils/turnTiming';
import type { ShotResult, ShipType, CellState } from '../../types/game';
import './Game.css';

export function Game(): React.ReactElement {
  const navigate = useNavigate();
  // Session context from the single localStorage active-game pointer (survives refresh /
  // tab close / restart). The route guard ensures it is non-null before this page renders.
  const { pointer, clear: clearActiveGame } = useActiveGame();
  const gameId = pointer?.gameId ?? '';
  const playerId = pointer?.playerId ?? '';
  // Per-seat belonging secret threaded into every gated call (architecture §4.5). Sourced
  // from the same active-game pointer as gameId/playerId; '' when absent (the call then 403s,
  // which the existing error/recovery paths already handle as "session no longer valid").
  const sessionToken = pointer?.sessionToken ?? '';
  const [error, setError] = useState<string | null>(null);
  const [firing, setFiring] = useState(false);
  // True while a Pause/Stop request is in flight, so the session controls disable.
  const [sessionBusy, setSessionBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ShotResult | null>(null);
  const [lastSunkShip, setLastSunkShip] = useState<ShipType | null>(null);
  // Optimistic overlay for computer's shot on my board before next poll
  const [computerShotOverlay, setComputerShotOverlay] = useState<{ row: number; col: number; state: CellState } | null>(null);
  // vs-computer turn choreography (presentation only — backend stays authoritative).
  // True while the computer's turn is being presented: the board is locked and the
  // title reads "Computer is playing".
  const [computerPlaying, setComputerPlaying] = useState(false);
  // Incremented on each blocked click during the lock to (re)show the "can't shoot" notice.
  const [cantShootTrigger, setCantShootTrigger] = useState(0);

  const { gameState, isLoading, gameGone, refresh } = useGamePolling(gameId, playerId, sessionToken, true);

  // Guards against state updates after unmount during the (longer) vs-computer choreography.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  // True while the Stay/Leave confirmation dialog is open (AC-11).
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // True while the Leave (stop) request is in flight, so the modal disables both actions.
  const [leaveBusy, setLeaveBusy] = useState(false);

  // Defense-in-depth self-guard reading the SAME active-game pointer the route guard reads
  // (never sessionStorage). Only fires if the pointer is cleared while mounted (e.g. Stop).
  useEffect(() => {
    if (!gameId || !playerId) navigate('/');
  }, [gameId, playerId, navigate]);

  // Recovery on unloadable game data (AC-3/AC-4). `gameGone` is set ONLY on an authoritative
  // 404 (server restart / released / missing game) — never on a transient blip. Clear the
  // stale pointer first so the route guard cannot re-admit the dead session (no redirect
  // loop, AC-4), then redirect to the main screen instead of rendering a broken board.
  useEffect(() => {
    if (gameGone) {
      clearActiveGame();
      navigate('/', { replace: true });
    }
  }, [gameGone, clearActiveGame, navigate]);

  // Back-button interception (AC-11). We want the browser Back button to trigger the
  // Stay/Leave confirmation instead of silently exiting. Strategy: push a sentinel history
  // entry on mount so a Back press pops to it; intercept that pop, re-push the sentinel
  // (so the user stays put), and open the confirmation dialog. A ref lets the Leave path
  // disarm the guard so the actual navigation isn't re-intercepted into a loop.
  const leavingRef = useRef(false);
  useEffect(() => {
    // Only arm the guard for an active session. A cleared pointer means recovery/Stop is
    // already navigating away — don't fight it.
    if (!gameId || !playerId) return;

    // Push a sentinel entry so the first Back press has something to pop to (and lands a
    // popstate we can intercept) rather than leaving the game view immediately.
    window.history.pushState({ battleshipGuard: true }, '');

    const onPopState = (): void => {
      // The Leave path disarmed the guard; allow the real navigation through.
      if (leavingRef.current) return;
      // Re-push the sentinel so Back keeps the player in the game (no state loss, AC-12)
      // and can be intercepted again on a subsequent press (edge case: repeated Back).
      window.history.pushState({ battleshipGuard: true }, '');
      setShowLeaveConfirm(true);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [gameId, playerId]);

  // Stay (AC-12): close the dialog and remain in the game. The sentinel was already
  // re-pushed in the popstate handler, so Back can be intercepted again.
  const handleStay = useCallback(() => {
    setShowLeaveConfirm(false);
  }, []);

  // Leave (AC-13): release the game via the existing Stop teardown, clear the pointer, and
  // return to the main screen. Disarm the Back guard first so navigation isn't re-trapped.
  const handleLeave = useCallback(async () => {
    setLeaveBusy(true);
    setError(null);
    try {
      await stopGame(gameId, playerId, sessionToken);
    } catch (e) {
      // Backend is source of truth: if Stop genuinely failed, surface it and keep the
      // player in the game rather than navigating to a possibly-still-live game (no double
      // release). Stop is idempotent (absent → success) so a stale game won't throw.
      setError(e instanceof Error ? e.message : 'Could not leave the game. Please try again.');
      setLeaveBusy(false);
      return;
    }
    leavingRef.current = true;
    clearActiveGame();
    setShowLeaveConfirm(false);
    setLeaveBusy(false);
    navigate('/', { replace: true });
  }, [gameId, playerId, sessionToken, clearActiveGame, navigate]);

  // On FINISHED, clear the active-game pointer BEFORE navigating to game-over so a
  // finished game never re-triggers the resume modal on a later Home visit (AC-14).
  useEffect(() => {
    if (gameState?.status === 'FINISHED') {
      clearActiveGame();
      navigate('/game-over');
    }
  }, [gameState?.status, navigate, clearActiveGame]);

  // Pause: backend PAUSED, pointer KEPT, return Home (resume modal appears) — AC-8.
  const handlePause = useCallback(async () => {
    setSessionBusy(true);
    setError(null);
    try {
      await pauseGame(gameId, playerId, sessionToken);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not pause the game. Please try again.');
      setSessionBusy(false);
    }
  }, [gameId, playerId, sessionToken, navigate]);

  // Stop: backend deletes the session, pointer CLEARED, clean Home, no resume modal — AC-9.
  const handleStop = useCallback(async () => {
    setSessionBusy(true);
    setError(null);
    try {
      await stopGame(gameId, playerId, sessionToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop the game. Please try again.');
      setSessionBusy(false);
      return;
    }
    clearActiveGame();
    navigate('/');
  }, [gameId, playerId, sessionToken, navigate, clearActiveGame]);

  // Clear the optimistic computer-shot overlay once the poll updates my board
  useEffect(() => {
    if (gameState && computerShotOverlay) {
      setComputerShotOverlay(null);
    }
  }, [gameState]);

  const isMyTurn = gameState?.currentTurnPlayerId === playerId;
  // vs-computer mode (from the polled state, falling back to the session pointer) drives
  // the persistent two-state turn title and the computer-turn lock.
  const vsComputer = (gameState?.gameMode ?? pointer?.gameMode) === 'COMPUTER';
  // Show "Your turn!" only on the opponent/computer → me transition (see hook). In
  // vs-computer the polled turn never flips, so this stays dormant; control returning
  // after the computer's move is conveyed by the board re-enabling (setComputerPlaying(false)).
  const showYourTurn = useTurnNotification(isMyTurn, gameState?.status);

  const opponentBoardCells = gameState ? computeOpponentBoardCells(gameState.opponentBoard) : undefined;

  const handleFireShot = (row: number, col: number): void => {
    // During the computer's turn the board is locked: no shot fires, but the player
    // gets explicit feedback ("Can't shoot — computer is playing") rather than a
    // silent dead click. Repeated clicks refresh the same notice (trigger bump).
    if (computerPlaying) {
      setCantShootTrigger((n) => n + 1);
      return;
    }
    // Gate: ignore the click entirely (no sound, no request) when it is not the
    // player's turn or a shot is already pending — prevents duplicate shots.
    if (!isMyTurn || firing) return;
    // Ignore cells already resolved as miss/sunk on the opponent board.
    const targetState = opponentBoardCells?.[row]?.[col];
    if (targetState === 'miss' || targetState === 'sunk') return;

    // Accepted shot — give immediate feedback as a direct result of the gesture.
    playShotSound();
    setError(null);
    setFiring(true);
    void submitShot(row, col);
  };

  const submitShot = async (row: number, col: number): Promise<void> => {
    try {
      // `silent: true` keeps firing off the app-wide top-bar loader — a shot is a
      // high-frequency in-game action that must feel instant and leave the board
      // interactive. Localized "Firing…" feedback (FiringIndicator) covers pending state.
      const res = await fireShot(gameId, playerId, row, col, sessionToken, true);
      setLastResult(res.result);
      setLastSunkShip(res.sunkShipType);

      // AC-7/AC-8/AC-9: pull the authoritative board immediately after the player's
      // own shot resolves — BEFORE any "Computer is playing" pacing delay. The delay
      // applies only to revealing the computer's response shot.
      setFiring(false);
      await refresh();
      if (!mountedRef.current) return;

      const cs = res.computerShot;
      if (cs) {
        // The computer is taking its turn. The player's own result is already on the
        // board (refresh above). Now present a visible, locked "Computer is playing"
        // phase (board cannot fire) BEFORE revealing the computer's shot, then return
        // control by re-enabling the board. The backend already resolved both
        // shots — this is purely the player-facing choreography for the COMPUTER's move.
        setComputerPlaying(true);

        await delay(COMPUTER_PLAYING_REVEAL_MS);
        if (!mountedRef.current) return;

        const cellState: CellState = cs.result === 'MISS' ? 'miss' : 'hit';
        setComputerShotOverlay({ row: cs.row, col: cs.col, state: cellState });
        // Pull the authoritative board again so the computer's shot shows for real.
        await refresh();
        if (!mountedRef.current) return;

        if (cs.winnerId) {
          // The computer's shot ended the game — go straight to game over;
          // control never returns to the player.
          navigate('/game-over');
          return;
        }

        // Brief hold so the player sees the shot land under "Computer is playing"
        // before control returns. Control returns by re-enabling the board.
        await delay(COMPUTER_PLAYING_HOLD_MS);
        if (!mountedRef.current) return;

        setComputerPlaying(false);
      }
      // No `else` branch needed: when there is no computer shot (HUMAN multiplayer, or
      // the player's shot ended the game / won — AC-13a), the immediate refresh() above
      // already pulled the authoritative board with the player's own result, with no
      // computer-response wait and no "Computer is playing" phase. The FINISHED-status
      // effect drives navigation to game-over on a winning shot.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shot failed. Please try again.');
      // Never leave the player stuck in a "Computer is playing" lock on failure.
      setComputerPlaying(false);
    } finally {
      // Always unlock the board on failure so the player can fire again.
      setFiring(false);
    }
  };

  const myBoardCellsBase = gameState ? computeOwnBoardCells(gameState.myBoard) : undefined;
  const myBoardCells = myBoardCellsBase && computerShotOverlay
    ? myBoardCellsBase.map((rowArr, r) =>
        rowArr.map((cell, c) =>
          r === computerShotOverlay.row && c === computerShotOverlay.col && cell !== 'hit' && cell !== 'miss' && cell !== 'sunk'
            ? computerShotOverlay.state
            : cell,
        ),
      )
    : myBoardCellsBase;
  // No per-cell pending overlay: fired cells resolve directly to hit/miss/sunk
  // once the backend responds. The firing guard still prevents duplicate shots.
  const opponentSunkTypes = gameState ? getSunkShipTypes(gameState.opponentBoard) : [];

  if (isLoading && !gameState) {
    return <LoadingSpinner label="Loading game…" />;
  }

  // Recovery in progress (AC-3): the game is gone and the effect above is redirecting to
  // Home. Render a neutral spinner instead of an empty/broken board to avoid a flash of a
  // broken board before the redirect completes (UX Expectation: smooth recovery).
  if (gameGone) {
    return <LoadingSpinner label="Returning to the main screen…" />;
  }

  return (
    <main className="game-page">
      {/* Stay/Leave confirmation (AC-11/12/13) — shown when the player attempts to leave,
          including via the browser Back button. */}
      {showLeaveConfirm && (
        <LeaveConfirmModal
          onStay={handleStay}
          onLeave={() => { void handleLeave(); }}
          busy={leaveBusy}
        />
      )}
      <header className="game-header">
        <h1>Battleship</h1>
        {gameState && (
          <TurnIndicator
            isMyTurn={isMyTurn}
            opponentReady={gameState.opponentReady}
            vsComputer={vsComputer}
            computerPlaying={computerPlaying}
          />
        )}
        <GameSessionControls
          onPause={() => { void handlePause(); }}
          onStop={() => { void handleStop(); }}
          busy={sessionBusy}
        />
      </header>

      {showYourTurn && <YourTurnToast />}
      <FiringIndicator active={firing} />
      <CantShootToast trigger={cantShootTrigger} />
      <ShotResultToast result={lastResult} sunkShipType={lastSunkShip} />
      <ErrorMessage message={error} />

      <div className="game-layout">
        <div className="game-boards">
          {opponentBoardCells && (
            <GameBoard
              cells={opponentBoardCells}
              onCellClick={handleFireShot}
              interactive={isMyTurn && !firing && !computerPlaying}
              label="Enemy Waters"
            />
          )}
          {myBoardCells && (
            <GameBoard
              cells={myBoardCells}
              label="Your Board"
            />
          )}
        </div>

        {gameState && (
          <ShipStatusPanel
            myShips={gameState.myBoard.ships}
            opponentSunkTypes={opponentSunkTypes}
          />
        )}
      </div>
    </main>
  );
}
