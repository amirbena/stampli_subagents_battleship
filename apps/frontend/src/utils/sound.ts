/**
 * Shot sound effect, synthesised with the native Web Audio API.
 *
 * WHY Web Audio instead of an asset file: the sound is bundled in code, works
 * fully offline (no CDN/network dependency), and needs no binary asset. It is a
 * short descending "fire" blip.
 *
 * This function NEVER throws. Browsers block audio until a user gesture has
 * occurred, and some environments expose no AudioContext at all — in every such
 * case we silently no-op so gameplay is never interrupted (requirement: audio
 * failure must not break the game).
 */

type AudioContextCtor = typeof AudioContext;

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  // Reuse a single context — browsers cap how many can exist per page.
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

/**
 * Play the short shot sound. Call this only as a direct result of the user's
 * fire gesture (a click/tap), never from a background poll — otherwise browser
 * autoplay policy will block it. Safe to call unconditionally; any failure is
 * swallowed.
 */
export function playShotSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Autoplay policy may leave the context suspended until a gesture resumes it.
    // Swallow any resume rejection so it never surfaces as an unhandled rejection.
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Audio is best-effort feedback only — never let it break the game loop.
  }
}

/** Test-only reset of the memoised AudioContext. */
export function __resetAudioContextForTests(): void {
  sharedContext = null;
}
