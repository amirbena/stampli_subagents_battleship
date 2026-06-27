/**
 * Presentation timing for the vs-computer turn choreography (all milliseconds).
 *
 * The backend already applies the 1–3s "computer move delay" inside the fireShot
 * request, then returns BOTH the player's result and the computer's shot together.
 * These constants govern only what the player SEES after the response lands:
 * a perceptible "Computer is playing" phase, then the computer's shot reveal, then
 * the return of control. They are not game rules — the backend remains authoritative.
 */

// Result popup (ShotResultToast) display time. A player HIT/SUNK lingers ~0.5s longer
// than a MISS so a successful shot feels rewarding; both are shorter than the old 2500ms.
export const RESULT_TOAST_MISS_MS = 1500;
export const RESULT_TOAST_HIT_MS = 2000;

// "Computer is playing" phase: a brisk-but-perceptible window before the computer's
// shot is revealed, then a short hold so the player sees the shot land under the title.
export const COMPUTER_PLAYING_REVEAL_MS = 900;
export const COMPUTER_PLAYING_HOLD_MS = 600;

// Transient "Can't shoot — computer is playing" notice when the player clicks during the lock.
export const CANT_SHOOT_NOTICE_MS = 1500;
