/**
 * Full E2E specs for the Game Pause / Resume / Stop lifecycle feature.
 *
 * Workflow Run ID: 20260625-204451-fa7a8b3
 * Mode: Full E2E (live backend on 8081 — API contract changed: new PAUSED status +
 *       POST pause/resume/stop endpoints). Frontend auto-started on 3001 by
 *       playwright.config.ts with VITE_API_BASE_URL=http://localhost:8081.
 *
 * Coverage (Architecture §AC-to-Test matrix — playwright-e2e-agent rows):
 *  - AC-1  : Refresh during active game → Home shows verbatim resume modal.
 *  - AC-2  : Tab close / restart simulated by a fresh context sharing the same
 *            localStorage origin → resume modal on Home (localStorage survives;
 *            sessionStorage would not).
 *  - AC-3  : Deep-link to /game, /lobby, /game-over with NO session → redirect to /.
 *  - AC-4  : Home is the only entry; deep-link never lands in an interactive screen.
 *  - AC-6  : Yes/Resume → restores from backend state, navigates into correct phase route.
 *  - AC-7  : No/Stop on Home modal → clean Home, no modal on subsequent reload.
 *  - AC-8  : In-game "Pause Game" → Home, game still resumable (modal appears).
 *  - AC-9  : In-game "Stop Game" → clean Home, no resume modal.
 *  - AC-10 : battleship_player_id identical before/after pause/stop/refresh/resume.
 *  - AC-11 : Resume into PLACING_SHIPS → board renders valid/interactive with placed ships.
 *  - AC-13 : Stale remembered game (bogus gameId) → Home/Resume degrades to clean Home.
 *
 * Verified implementation facts (from src):
 *  - Active-game pointer:  localStorage key 'battleship_active_game',
 *                          value = JSON.stringify({ gameId, playerId, gameMode }).
 *  - Identity:             localStorage key 'battleship_player_id' = JSON.stringify(uuid).
 *  - gameId/playerId/gameMode are NO LONGER in sessionStorage — they live only in the
 *    localStorage pointer (Home.tsx writes it on create/join/vs-computer).
 *  - Resume modal:         role="dialog", verbatim text
 *                          "Do you want to continue your existing game?",
 *                          buttons "Yes, Resume" and "No, Stop".
 *  - In-game controls:     buttons "Pause Game" and "Stop Game" (GameSessionControls).
 *  - Guard RequireActiveSession redirects /lobby,/game,/game-over → / when pointer null.
 *
 * Strategy:
 *  - Set up an active game deterministically: create a player + game via the live API,
 *    then seed BOTH localStorage keys (identity + active-game pointer). This is the exact
 *    state the app is in after a user creates/joins a game through Home, and is the
 *    standard "returning visit" seeding pattern already used by the other specs.
 *  - Never hardcode gameId/playerId — always derive from API responses.
 *  - Drive the real UI for the assertions under test (modal, Pause/Stop buttons, guard);
 *    use direct API calls only for setup (placement) to keep tests fast/deterministic.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

const IDENTITY_KEY = 'battleship_player_id';
const ACTIVE_GAME_KEY = 'battleship_active_game';
const RESUME_MODAL_TEXT = 'Do you want to continue your existing game?';

const SHIP_PLACEMENTS = [
  { shipType: 'CARRIER',    row: 0, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'BATTLESHIP', row: 1, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'CRUISER',    row: 2, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'SUBMARINE',  row: 3, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'DESTROYER',  row: 4, col: 0, orientation: 'HORIZONTAL' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createPlayerViaApi(
  request: APIRequestContext,
  displayName: string,
): Promise<{ playerId: string; displayName: string }> {
  const res = await request.post(`${API_BASE}/players`, { data: { displayName } });
  if (!res.ok()) {
    throw new Error(`POST /players failed ${res.status()}: ${await res.text()}`);
  }
  return res.json() as Promise<{ playerId: string; displayName: string }>;
}

/**
 * Create a vs-COMPUTER game for the given player via the live API.
 * Returns the gameId. The game starts in PLACING_SHIPS.
 */
async function createComputerGame(
  request: APIRequestContext,
  playerId: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/games`, {
    params: { mode: 'COMPUTER' },
    data: { playerId },
  });
  if (!res.ok()) {
    throw new Error(`POST /games failed ${res.status()}: ${await res.text()}`);
  }
  const body = (await res.json()) as { gameId: string; playerId: string };
  return body.gameId;
}

async function placeAllShips(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<void> {
  for (const ship of SHIP_PLACEMENTS) {
    const res = await request.post(
      `${API_BASE}/games/${gameId}/players/${playerId}/ships`,
      { data: ship },
    );
    if (!res.ok()) {
      throw new Error(`Failed to place ${ship.shipType}: ${res.status()} ${await res.text()}`);
    }
  }
}

async function markReady(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/ready`);
  if (!res.ok()) {
    throw new Error(`Failed to mark ready: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Seed identity + active-game pointer into localStorage, matching the exact
 * serialization the app uses (useLocalStorage → JSON.stringify on write).
 * Must run after an initial page.goto('/') so the origin exists; follow with
 * another page.goto('/') so React reads the seeded values on mount.
 */
async function seedSession(
  page: Page,
  args: { playerId: string; gameId: string; gameMode: 'HUMAN' | 'COMPUTER' },
): Promise<void> {
  await page.evaluate(
    ({ identityKey, pointerKey, playerId, gameId, gameMode }) => {
      localStorage.setItem(identityKey, JSON.stringify(playerId));
      localStorage.setItem(pointerKey, JSON.stringify({ gameId, playerId, gameMode }));
    },
    {
      identityKey: IDENTITY_KEY,
      pointerKey: ACTIVE_GAME_KEY,
      playerId: args.playerId,
      gameId: args.gameId,
      gameMode: args.gameMode,
    },
  );
}

async function readIdentity(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as string | null;
    } catch {
      return null;
    }
  }, IDENTITY_KEY);
}

async function readPointer(
  page: Page,
): Promise<{ gameId: string; playerId: string; gameMode: string } | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as { gameId: string; playerId: string; gameMode: string } | null;
    } catch {
      return null;
    }
  }, ACTIVE_GAME_KEY);
}

const resumeModal = (page: Page) => page.getByRole('dialog');
const resumeButton = (page: Page) => page.getByRole('button', { name: 'Yes, Resume' });
const stopModalButton = (page: Page) => page.getByRole('button', { name: 'No, Stop' });

/**
 * Establish identity + a PLACING_SHIPS active game, returning ids.
 */
async function setupActiveGame(
  page: Page,
  request: APIRequestContext,
  displayName: string,
): Promise<{ gameId: string; playerId: string }> {
  const { playerId } = await createPlayerViaApi(request, displayName);
  const gameId = await createComputerGame(request, playerId);
  await page.goto('/');
  await seedSession(page, { playerId, gameId, gameMode: 'COMPUTER' });
  return { gameId, playerId };
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-1 — Refresh during active game → resume modal on Home (verbatim copy)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-1: refresh during an active game → Home shows verbatim resume modal', async ({ page, request }) => {
  await setupActiveGame(page, request, 'RefreshPlayer');

  // Simulate a browser refresh: reload the page so React re-mounts and reads the
  // localStorage pointer fresh.
  await page.goto('/');

  // The resume modal must appear with the EXACT copy and two choices.
  const modal = resumeModal(page);
  await expect(modal).toBeVisible({ timeout: 12000 });
  await expect(modal).toContainText(RESUME_MODAL_TEXT);
  await expect(resumeButton(page)).toBeVisible();
  await expect(stopModalButton(page)).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-2 — Tab close / restart simulated by a fresh context on the same origin
// ─────────────────────────────────────────────────────────────────────────────

test('AC-2: tab-close/restart (new context, same localStorage) → resume modal on Home', async ({ browser, request }) => {
  const { playerId } = await createPlayerViaApi(request, 'RestartPlayer');
  const gameId = await createComputerGame(request, playerId);

  // First "tab": seed the pointer, then close it entirely.
  const ctx1 = await browser.newContext();
  const page1 = await ctx1.newPage();
  await page1.goto('/');
  await seedSession(page1, { playerId, gameId, gameMode: 'COMPUTER' });
  const exportedState = await ctx1.storageState();
  await ctx1.close();

  // Second "tab/restart": a brand-new context that inherits the persisted
  // localStorage (this is what survives a real browser restart — sessionStorage
  // would NOT). Loading Home must surface the resume modal.
  const ctx2 = await browser.newContext({ storageState: exportedState });
  const page2 = await ctx2.newPage();
  try {
    await page2.goto('/');
    const modal = resumeModal(page2);
    await expect(modal).toBeVisible({ timeout: 12000 });
    await expect(modal).toContainText(RESUME_MODAL_TEXT);
  } finally {
    await ctx2.close();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-3 / AC-4 — Deep-link to internal routes with no session → redirect to Home
// ─────────────────────────────────────────────────────────────────────────────

for (const route of ['/game', '/lobby', '/game-over'] as const) {
  test(`AC-3/AC-4: deep-link to ${route} with no session → redirected to / (Home)`, async ({ page }) => {
    // Ensure a clean origin: no identity, no active-game pointer.
    await page.goto('/');
    await page.evaluate(
      ({ identityKey, pointerKey }) => {
        localStorage.removeItem(identityKey);
        localStorage.removeItem(pointerKey);
        sessionStorage.clear();
      },
      { identityKey: IDENTITY_KEY, pointerKey: ACTIVE_GAME_KEY },
    );

    // Direct address-bar navigation into the guarded route.
    await page.goto(route);

    // The guard must bounce us to Home — never land on an interactive game screen.
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // AC-4: no resume modal (no session) and we are genuinely on Home, not a
    // half-initialized game screen. The Game/Lobby page roots must be absent.
    await expect(resumeModal(page)).toHaveCount(0);
    await expect(page.locator('.game-page')).toHaveCount(0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-6 / AC-11 — Yes/Resume into PLACING_SHIPS → lobby with valid interactive board
// ─────────────────────────────────────────────────────────────────────────────

test('AC-6/AC-11: Resume into PLACING_SHIPS restores from backend and renders a valid interactive board', async ({ page, request }) => {
  const { gameId, playerId } = await setupActiveGame(page, request, 'ResumePlacing');

  // Place all 5 ships via API so the backend myBoard carries placed ships. Resume
  // must hydrate the Lobby board from this backend truth (AC-11), not stale scratch.
  await placeAllShips(request, gameId, playerId);

  // Reload Home so the seeded pointer triggers the resume modal.
  await page.goto('/');
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });

  // Choose Yes / Resume.
  await resumeButton(page).click();

  // AC-6: PLACING_SHIPS routes to /lobby, restored from backend state.
  await page.waitForURL(/\/lobby/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/lobby/);

  // AC-11: the "Your Board" grid renders and carries placed ship cells hydrated
  // from backend myBoard.ships (board-cell--ship). 17 total ship cells were placed.
  const board = page.getByRole('grid', { name: /your board/i });
  await expect(board).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => board.locator('.board-cell--ship').count(), { timeout: 10000 })
    .toBeGreaterThan(0);

  // No cell may be stuck in an invalid/blocked placement preview state — the board
  // is valid and interactive (AC-11: "no stuck/blocked placement cells").
  await expect(board.locator('.board-cell--preview-invalid')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-6 (IN_PROGRESS) — Resume into a started game routes to /game
// ─────────────────────────────────────────────────────────────────────────────

test('AC-6: Resume into IN_PROGRESS routes to /game restored from backend', async ({ page, request }) => {
  const { gameId, playerId } = await setupActiveGame(page, request, 'ResumeInProgress');

  // Drive the game to IN_PROGRESS: place ships + ready (vs COMPUTER starts immediately).
  await placeAllShips(request, gameId, playerId);
  await markReady(request, gameId, playerId);

  await page.goto('/');
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await resumeButton(page).click();

  // IN_PROGRESS → /game.
  await page.waitForURL(/\/game(?!-over)/, { timeout: 15000 });
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Enemy Waters')).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-7 — No/Stop on the Home modal → clean Home, no modal on subsequent reload
// ─────────────────────────────────────────────────────────────────────────────

test('AC-7: No/Stop on Home modal ends session — clean Home, no modal on reload', async ({ page, request }) => {
  await setupActiveGame(page, request, 'StopFromHome');

  await page.goto('/');
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });

  // Choose No / Stop.
  await stopModalButton(page).click();

  // Modal dismisses; we remain on a clean Home.
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 10000 });
  await expect(page).toHaveURL('/');

  // The active-game pointer must be cleared (session ended).
  await expect.poll(async () => readPointer(page), { timeout: 10000 }).toBeNull();

  // Reload Home — no resume modal must reappear (AC-7).
  await page.goto('/');
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 8000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-8 — In-game Pause button → Home, game still resumable (modal appears)
// ─────────────────────────────────────────────────────────────────────────────

test('AC-8: in-game "Pause Game" returns to Home and the game remains resumable', async ({ page, request }) => {
  const { gameId, playerId } = await setupActiveGame(page, request, 'PausePlayer');

  // Enter the lobby (PLACING_SHIPS) through Resume so we are inside the game UI.
  await placeAllShips(request, gameId, playerId);
  await page.goto('/');
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await resumeButton(page).click();
  await page.waitForURL(/\/lobby/, { timeout: 15000 });

  // Click the in-game Pause button.
  const pauseBtn = page.getByRole('button', { name: 'Pause Game' });
  await expect(pauseBtn).toBeVisible({ timeout: 10000 });
  await pauseBtn.click();

  // Pause returns to Home and keeps the pointer (game stays resumable).
  await expect(page).toHaveURL('/', { timeout: 12000 });
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await expect(resumeModal(page)).toContainText(RESUME_MODAL_TEXT);

  // Pointer must still be present (Pause never clears it).
  await expect.poll(async () => readPointer(page), { timeout: 8000 }).not.toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-9 — In-game Stop button → clean Home, no resume modal
// ─────────────────────────────────────────────────────────────────────────────

test('AC-9: in-game "Stop Game" ends session — clean Home, no resume modal', async ({ page, request }) => {
  const { gameId, playerId } = await setupActiveGame(page, request, 'StopPlayer');

  await placeAllShips(request, gameId, playerId);
  await page.goto('/');
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await resumeButton(page).click();
  await page.waitForURL(/\/lobby/, { timeout: 15000 });

  // Click the in-game Stop button.
  const stopBtn = page.getByRole('button', { name: 'Stop Game' });
  await expect(stopBtn).toBeVisible({ timeout: 10000 });
  await stopBtn.click();

  // Stop returns to a clean Home with the pointer cleared and no resume modal.
  await expect(page).toHaveURL('/', { timeout: 12000 });
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 10000 });
  await expect.poll(async () => readPointer(page), { timeout: 10000 }).toBeNull();

  // Reload confirms no re-prompt.
  await page.goto('/');
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 8000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10 — battleship_player_id is identical across pause / stop / refresh / resume
// ─────────────────────────────────────────────────────────────────────────────

test('AC-10: player identity key is unchanged across refresh, resume, pause, and stop', async ({ page, request }) => {
  const { gameId, playerId } = await setupActiveGame(page, request, 'IdentityStable');

  await placeAllShips(request, gameId, playerId);

  // Baseline identity after seeding.
  await page.goto('/');
  const idInitial = await readIdentity(page);
  expect(idInitial).toBe(playerId);

  // Refresh: identity unchanged.
  await page.goto('/');
  expect(await readIdentity(page)).toBe(idInitial);

  // Resume into the lobby: identity unchanged.
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await resumeButton(page).click();
  await page.waitForURL(/\/lobby/, { timeout: 15000 });
  expect(await readIdentity(page)).toBe(idInitial);

  // Pause back to Home: identity unchanged.
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await expect(page).toHaveURL('/', { timeout: 12000 });
  expect(await readIdentity(page)).toBe(idInitial);

  // Stop from the Home modal: pointer clears, but identity must remain.
  await expect(resumeModal(page)).toBeVisible({ timeout: 12000 });
  await stopModalButton(page).click();
  await expect.poll(async () => readPointer(page), { timeout: 10000 }).toBeNull();
  expect(await readIdentity(page)).toBe(idInitial);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-13 — Stale remembered game (bogus gameId) → graceful clean Home
// ─────────────────────────────────────────────────────────────────────────────

test('AC-13: stale remembered game (non-existent gameId) → Resume degrades gracefully to clean Home', async ({ page, request }) => {
  // Real identity, but a bogus active-game pointer to a gameId the backend never had.
  const { playerId } = await createPlayerViaApi(request, 'StaleGamePlayer');
  const bogusGameId = 'NON_EXISTENT_GAME_404';

  await page.goto('/');
  await seedSession(page, { playerId, gameId: bogusGameId, gameMode: 'COMPUTER' });
  await page.goto('/');

  // The pointer is non-null, so the modal may render. Attempting Resume must hit a
  // 404 from the backend and degrade gracefully — no error screen, no infinite spinner.
  const modal = resumeModal(page);
  if (await modal.isVisible().catch(() => false)) {
    await resumeButton(page).click();
  }

  // We must end on a clean Home: no modal, no crash, pointer cleared by the 404 path.
  await expect(page).toHaveURL('/', { timeout: 12000 });
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 12000 });
  await expect.poll(async () => readPointer(page), { timeout: 12000 }).toBeNull();

  // No app error boundary / broken screen — the Home name/welcome surface is reachable.
  // (Either the name-entry gate or the welcome banner renders for a clean Home.)
  await expect(page.locator('.game-page')).toHaveCount(0);

  // Subsequent reload stays clean (pointer was cleared, not re-promptable).
  await page.goto('/');
  await expect(resumeModal(page)).toHaveCount(0, { timeout: 8000 });
});
