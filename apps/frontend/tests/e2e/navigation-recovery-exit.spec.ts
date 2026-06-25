/**
 * Full E2E specs for the Game Navigation / Recovery / Exit feature.
 *
 * Workflow Run ID: 20260625-223903-b071a6c
 * Mode: Full E2E (live backend on 8081 — API contract changed: NEW endpoint
 *       GET /api/v1/games/{code}/restore). Frontend auto-started on E2E port 3010 by
 *       playwright.config.ts with VITE_API_BASE_URL=http://localhost:8081; backend on
 *       8081 via `./mvnw spring-boot:run -Pe2e`.
 *
 * AC coverage (Architecture §AC-to-Test matrix — playwright-e2e-agent rows):
 *  - AC-1  : Direct game URL with no session → redirect to main; no game created.
 *  - AC-2  : Game view only reachable via start-computer OR valid code (negative nav).
 *  - AC-3  : Unloadable game (pointer → non-existent gameId) → redirect to main, no broken board.
 *  - AC-4  : Stale session pointer cleared on recovery → no redirect loop, Home usable.
 *  - AC-5  : Starting a computer game shows a popup containing the game code.
 *  - AC-7  : Main screen has a restore code-entry input.
 *  - AC-8  : Valid computer-game code restores the SAME game + its saved board state
 *            (own ships + prior shot progress).
 *  - AC-9  : Invalid/unknown code → friendly "not found" message, stays on main, no board.
 *  - AC-10 : Already-released code → behaves as AC-9 (stop the game, then restore → not found).
 *  - AC-11 : In an active game, browser Back → Stay/Leave popup.
 *  - AC-12 : Stay keeps the game with state.
 *  - AC-13 : Leave releases (existing Stop) and returns to main.
 *  - AC-14 : "Play Against Another User" button is disabled and reads "Coming Soon".
 *
 * Verified implementation facts (from src — selectors used below):
 *  - Active-game pointer:  localStorage key 'battleship_active_game',
 *                          value = JSON.stringify({ gameId, playerId, gameMode }).
 *  - Identity:             localStorage key 'battleship_player_id' = JSON.stringify(uuid).
 *  - Code popup:           GameCodePopup — role="dialog", text "Save your game code",
 *                          renders RoomCodeDisplay (room-code-value span), ack button
 *                          "Got it, start playing".
 *  - Restore input:        aria-label "Game code", submit button "Restore Game";
 *                          not-found inline text "Game not found or no longer available".
 *  - Coming Soon button:   "Play Against Another User (Coming Soon)" — disabled.
 *  - Leave modal:          LeaveConfirmModal — role="dialog", text "Leave this game?",
 *                          buttons "Stay" and "Leave". Game pushes a popstate sentinel; a
 *                          browser Back press opens it (Game.tsx popstate guard).
 *  - Recovery:             Game.tsx redirects to '/' (replace) + clears pointer on an
 *                          authoritative 404 (gameGone).
 *  - Restore endpoint:     GET /api/v1/games/{code}/restore (200 {gameId,playerId,gameMode,
 *                          status} / 404 GAME_NOT_FOUND).
 *
 * Strategy:
 *  - Set up an active game deterministically via the live API (create player + computer
 *    game), then drive the real UI for the behavior under test. Direct API calls are used
 *    only for fast setup (placement / firing), never to assert UI behavior.
 *  - Never hardcode gameId/playerId — always derive from API responses or the live pointer.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

const IDENTITY_KEY = 'battleship_player_id';
const ACTIVE_GAME_KEY = 'battleship_active_game';

const CODE_POPUP_TITLE = 'Save your game code';
const LEAVE_MODAL_TEXT = 'Leave this game?';
const NOT_FOUND_TEXT = 'Game not found or no longer available';

const SHIP_PLACEMENTS = [
  { shipType: 'CARRIER',    row: 0, col: 0, orientation: 'HORIZONTAL' }, // 5
  { shipType: 'BATTLESHIP', row: 1, col: 0, orientation: 'HORIZONTAL' }, // 4
  { shipType: 'CRUISER',    row: 2, col: 0, orientation: 'HORIZONTAL' }, // 3
  { shipType: 'SUBMARINE',  row: 3, col: 0, orientation: 'HORIZONTAL' }, // 3
  { shipType: 'DESTROYER',  row: 4, col: 0, orientation: 'HORIZONTAL' }, // 2
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// API helpers (fast deterministic setup only)
// ─────────────────────────────────────────────────────────────────────────────

async function createPlayerViaApi(
  request: APIRequestContext,
  displayName: string,
): Promise<{ playerId: string }> {
  const res = await request.post(`${API_BASE}/players`, { data: { displayName } });
  if (!res.ok()) throw new Error(`POST /players failed ${res.status()}: ${await res.text()}`);
  return res.json() as Promise<{ playerId: string }>;
}

/** Create a vs-COMPUTER game; returns { gameId, playerId }. Starts in PLACING_SHIPS. */
async function createComputerGame(
  request: APIRequestContext,
  playerId: string,
): Promise<{ gameId: string; playerId: string }> {
  const res = await request.post(`${API_BASE}/games`, {
    params: { mode: 'COMPUTER' },
    data: { playerId },
  });
  if (!res.ok()) throw new Error(`POST /games failed ${res.status()}: ${await res.text()}`);
  const body = (await res.json()) as { gameId: string; playerId: string };
  return { gameId: body.gameId, playerId: body.playerId };
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
    if (!res.ok()) throw new Error(`Place ${ship.shipType} failed: ${res.status()} ${await res.text()}`);
  }
}

async function markReady(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/ready`);
  if (!res.ok()) throw new Error(`Ready failed: ${res.status()} ${await res.text()}`);
}

async function fireOneShot(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
  row: number,
  col: number,
): Promise<void> {
  const res = await request.post(
    `${API_BASE}/games/${gameId}/players/${playerId}/fire`,
    { data: { row, col } },
  );
  if (!res.ok()) throw new Error(`Fire failed: ${res.status()} ${await res.text()}`);
}

async function stopGameViaApi(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<void> {
  const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/stop`);
  // 204 on success; 404 idempotent (already gone) is also acceptable.
  if (!res.ok() && res.status() !== 404) {
    throw new Error(`Stop failed: ${res.status()} ${await res.text()}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage helpers
// ─────────────────────────────────────────────────────────────────────────────

async function seedSession(
  page: Page,
  args: { playerId: string; gameId: string; gameMode: 'HUMAN' | 'COMPUTER' },
): Promise<void> {
  await page.evaluate(
    ({ identityKey, pointerKey, playerId, gameId, gameMode }) => {
      localStorage.setItem(identityKey, JSON.stringify(playerId));
      localStorage.setItem(pointerKey, JSON.stringify({ gameId, playerId, gameMode }));
    },
    { identityKey: IDENTITY_KEY, pointerKey: ACTIVE_GAME_KEY, ...args },
  );
}

async function seedIdentityOnly(page: Page, playerId: string): Promise<void> {
  await page.evaluate(
    ({ identityKey, id }) => localStorage.setItem(identityKey, JSON.stringify(id)),
    { identityKey: IDENTITY_KEY, id: playerId },
  );
}

async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(
    ({ identityKey, pointerKey }) => {
      localStorage.removeItem(identityKey);
      localStorage.removeItem(pointerKey);
      sessionStorage.clear();
    },
    { identityKey: IDENTITY_KEY, pointerKey: ACTIVE_GAME_KEY },
  );
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

// ─────────────────────────────────────────────────────────────────────────────
// AC-1 / AC-2 — Direct game URL with no session → redirect to main; no game created
// ─────────────────────────────────────────────────────────────────────────────

for (const route of ['/game', '/lobby', '/game-over'] as const) {
  test(`AC-1/AC-2: deep-link to ${route} with no session → redirect to / (no game created)`, async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);

    // Direct address-bar navigation into a guarded route.
    await page.goto(route);

    // Guard bounces to Home — never lands on an interactive game screen.
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // No game was created out of nowhere: the active-game pointer is still absent (AC-2).
    await expect.poll(async () => readPointer(page), { timeout: 8000 }).toBeNull();

    // No broken/empty board rendered.
    await expect(page.locator('.game-page')).toHaveCount(0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-3 / AC-4 — Unloadable game (stale pointer to a non-existent game) → recovery
// ─────────────────────────────────────────────────────────────────────────────

test('AC-3/AC-4: stale pointer to a non-existent game → redirect to main, pointer cleared, no loop', async ({ page, request }) => {
  // Real identity, but a pointer to a gameId the backend never had (simulates a backend
  // restart that wiped in-memory state while the client still believes a game exists).
  const { playerId } = await createPlayerViaApi(request, 'RecoveryPlayer');
  const bogusGameId = 'ZZZ999';

  await page.goto('/');
  await seedSession(page, { playerId, gameId: bogusGameId, gameMode: 'COMPUTER' });

  // Navigate straight into the game view. The polling hook hits 404 GAME_NOT_FOUND →
  // gameGone → Game.tsx clears the pointer and redirects to '/'.
  await page.goto('/game');

  // AC-3: redirected to the main screen instead of a broken board.
  await expect(page).toHaveURL('/', { timeout: 12000 });
  await expect(page.locator('.game-page')).toHaveCount(0);

  // AC-4: stale pointer cleared, so the route guard cannot re-admit the dead session.
  await expect.poll(async () => readPointer(page), { timeout: 12000 }).toBeNull();

  // No resume modal re-prompting a dead game; Home is usable normally.
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 8000 });

  // Re-navigating to /game again must NOT loop back into a broken board — it redirects
  // straight to Home (pointer is gone, guard bounces immediately).
  await page.goto('/game');
  await expect(page).toHaveURL('/', { timeout: 10000 });
  await expect(page.locator('.game-page')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-5 — Starting a computer game shows a popup containing the game code
// ─────────────────────────────────────────────────────────────────────────────

test('AC-5: starting a computer game shows a code popup containing the game code', async ({ page, request }) => {
  // Establish identity so the "Play vs Computer" button is enabled.
  const { playerId } = await createPlayerViaApi(request, 'CodePopupPlayer');
  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');

  await expect(page.getByRole('button', { name: /play vs computer/i })).toBeEnabled({ timeout: 10000 });
  await page.getByRole('button', { name: /play vs computer/i }).click();

  // The code popup must appear (AC-5).
  const popup = page.getByRole('dialog');
  await expect(popup).toBeVisible({ timeout: 12000 });
  await expect(popup).toContainText(CODE_POPUP_TITLE);

  // It must contain the actual game code. Derive the code from the live pointer (never
  // hardcode), then assert it is the text shown in the popup's RoomCodeDisplay.
  const pointer = await readPointer(page);
  expect(pointer?.gameId).toBeTruthy();
  const code = pointer!.gameId;
  await expect(popup.locator('.room-code-value')).toHaveText(code);

  // Acknowledging proceeds into the game (Flow A step 4 → /lobby for PLACING_SHIPS).
  await page.getByRole('button', { name: /got it, start playing/i }).click();
  await page.waitForURL(/\/lobby/, { timeout: 15000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-7 / AC-8 — Restore input on main; valid code restores same game + saved board state
// ─────────────────────────────────────────────────────────────────────────────

test('AC-7/AC-8: valid code restores the same game with its saved board state (own ships + progress)', async ({ page, request }) => {
  // Build a real, in-progress computer game with placed ships and a prior shot so there is
  // saved board state to restore. All via API for determinism/speed.
  const { playerId: identityId } = await createPlayerViaApi(request, 'RestorePlayer');
  const { gameId, playerId } = await createComputerGame(request, identityId);
  await placeAllShips(request, gameId, playerId);
  await markReady(request, gameId, playerId); // vs COMPUTER → IN_PROGRESS, human first
  await fireOneShot(request, gameId, playerId, 9, 9); // prior shot progress (a corner → likely miss)

  // Fresh main screen with identity but NO active pointer — the user restores by code.
  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');

  // AC-7: the restore input is present on the main screen.
  const codeInput = page.getByLabel('Game code');
  await expect(codeInput).toBeVisible({ timeout: 10000 });

  // Submit the valid code.
  await codeInput.fill(gameId);
  await page.getByRole('button', { name: /restore game/i }).click();

  // AC-8: restored into the SAME game (IN_PROGRESS → /game). The pointer now points at the
  // exact same gameId, proving "the same game" was restored.
  await page.waitForURL(/\/game(?!-over)/, { timeout: 15000 });
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });
  const pointer = await readPointer(page);
  expect(pointer?.gameId).toBe(gameId);

  // Saved board state is rehydrated: the player's own ships render on "Your Board" (17 ship
  // cells were placed), and the prior shot progress shows (the fired cell is resolved as
  // miss/sunk, not pristine). This is read from the backend via getGameState, proving the
  // saved layout + progress came back — not a fresh board.
  await expect(page.getByText('Your Board')).toBeVisible({ timeout: 10000 });
  const myBoard = page.getByRole('grid', { name: /your board/i });
  await expect(myBoard).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => myBoard.locator('.board-cell--ship').count(), { timeout: 10000 })
    .toBeGreaterThan(0);

  // Prior shot progress: the enemy board carries at least one resolved (miss/sunk/hit) cell
  // from the shot fired before restore — proving progress was preserved, not reset.
  await expect(page.getByText('Enemy Waters')).toBeVisible();
  const enemyBoard = page.getByRole('grid', { name: /enemy waters/i });
  await expect
    .poll(
      async () =>
        enemyBoard
          .locator('.board-cell--miss, .board-cell--hit, .board-cell--sunk')
          .count(),
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-9 — Invalid/unknown code → friendly not-found message, stays on main, no board
// ─────────────────────────────────────────────────────────────────────────────

test('AC-9: invalid/unknown code → friendly not-found message, stays on main, no broken board', async ({ page, request }) => {
  const { playerId } = await createPlayerViaApi(request, 'BadCodePlayer');
  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');

  const codeInput = page.getByLabel('Game code');
  await expect(codeInput).toBeVisible({ timeout: 10000 });

  // A syntactically-valid but unknown code (6 chars, never issued).
  await codeInput.fill('NOPE99');
  await page.getByRole('button', { name: /restore game/i }).click();

  // Friendly inline message; stays on main; no navigation; no broken board.
  await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL('/');
  await expect(page.locator('.game-page')).toHaveCount(0);
  await expect.poll(async () => readPointer(page), { timeout: 8000 }).toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-10 — Already-released code → behaves as not-found
// ─────────────────────────────────────────────────────────────────────────────

test('AC-10: already-released (stopped) code → behaves as not-found, stays on main', async ({ page, request }) => {
  // Create a real computer game, then release it via the existing Stop endpoint.
  const { playerId: identityId } = await createPlayerViaApi(request, 'ReleasedCodePlayer');
  const { gameId, playerId } = await createComputerGame(request, identityId);
  await stopGameViaApi(request, gameId, playerId); // releases/deletes the game

  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');

  const codeInput = page.getByLabel('Game code');
  await expect(codeInput).toBeVisible({ timeout: 10000 });

  await codeInput.fill(gameId);
  await page.getByRole('button', { name: /restore game/i }).click();

  // Same outcome as AC-9: friendly message, stay on main, no broken board.
  await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL('/');
  await expect(page.locator('.game-page')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-11 / AC-12 — Browser Back in an active game → Stay/Leave popup; Stay keeps the game
// ─────────────────────────────────────────────────────────────────────────────

test('AC-11/AC-12: browser Back in an active game opens Stay/Leave popup; Stay keeps the game', async ({ page, request }) => {
  // Drive a real IN_PROGRESS game and enter the /game view through the UI so the Game
  // page's popstate sentinel guard is armed.
  const { playerId: identityId } = await createPlayerViaApi(request, 'BackStayPlayer');
  const { gameId, playerId } = await createComputerGame(request, identityId);
  await placeAllShips(request, gameId, playerId);
  await markReady(request, gameId, playerId);

  // Restore into the game via the Home code input (this is a real navigation that lands
  // /game with a clean history entry below it for Back to pop to).
  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');
  await page.getByLabel('Game code').fill(gameId);
  await page.getByRole('button', { name: /restore game/i }).click();
  await page.waitForURL(/\/game(?!-over)/, { timeout: 15000 });
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });

  // Press the browser Back button.
  await page.goBack();

  // AC-11: the Stay/Leave confirmation popup appears instead of silently exiting.
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal).toContainText(LEAVE_MODAL_TEXT);
  await expect(page.getByRole('button', { name: 'Stay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();

  // AC-12: choosing Stay closes the popup and keeps the player in the game with state.
  await page.getByRole('button', { name: 'Stay' }).click();
  await expect(modal).toHaveCount(0, { timeout: 8000 });
  await expect(page).toHaveURL(/\/game(?!-over)/);
  await expect(page.locator('.game-page')).toBeVisible();
  // Game state intact: the boards are still rendered.
  await expect(page.getByText('Enemy Waters')).toBeVisible();
  await expect(page.getByText('Your Board')).toBeVisible();
  // Pointer still present (Stay never releases the game).
  await expect.poll(async () => readPointer(page), { timeout: 8000 }).not.toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-13 — Leave releases (existing Stop) and returns to main
// ─────────────────────────────────────────────────────────────────────────────

test('AC-13: Leave releases the game (existing Stop) and returns to main', async ({ page, request }) => {
  const { playerId: identityId } = await createPlayerViaApi(request, 'BackLeavePlayer');
  const { gameId, playerId } = await createComputerGame(request, identityId);
  await placeAllShips(request, gameId, playerId);
  await markReady(request, gameId, playerId);

  await page.goto('/');
  await seedIdentityOnly(page, playerId);
  await page.goto('/');
  await page.getByLabel('Game code').fill(gameId);
  await page.getByRole('button', { name: /restore game/i }).click();
  await page.waitForURL(/\/game(?!-over)/, { timeout: 15000 });
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });

  // Back → popup → Leave.
  await page.goBack();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await expect(modal).toContainText(LEAVE_MODAL_TEXT);
  await page.getByRole('button', { name: 'Leave' }).click();

  // AC-13: returned to the main screen, pointer cleared (existing Stop teardown).
  await expect(page).toHaveURL('/', { timeout: 12000 });
  await expect(page.locator('.game-page')).toHaveCount(0);
  await expect.poll(async () => readPointer(page), { timeout: 10000 }).toBeNull();

  // The game was genuinely released: restoring its code now behaves as not-found (AC-10
  // overlap, proving Leave used the real Stop release).
  await page.getByLabel('Game code').fill(gameId);
  await page.getByRole('button', { name: /restore game/i }).click();
  await expect(page.getByText(NOT_FOUND_TEXT)).toBeVisible({ timeout: 10000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-14 — Multiplayer button disabled with "Coming Soon"
// ─────────────────────────────────────────────────────────────────────────────

test('AC-14: "Play Against Another User" button is disabled and reads "Coming Soon"', async ({ page }) => {
  await page.goto('/');
  const multiplayerBtn = page.getByRole('button', { name: /play against another user/i });
  await expect(multiplayerBtn).toBeVisible();
  await expect(multiplayerBtn).toContainText(/coming soon/i);
  await expect(multiplayerBtn).toBeDisabled();
});
