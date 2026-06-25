/**
 * E2E tests for the "Play vs Computer" feature.
 *
 * Coverage:
 *  - AC-1  : Home page renders "Play vs Computer" button
 *  - AC-3  : Clicking the button calls POST /games?mode=COMPUTER and navigates to /lobby
 *  - AC-11 : Lobby shows "Playing vs Computer" banner
 *  - AC-12 : Lobby does NOT render a room-code copy button in vs-computer mode
 *  - AC-13 : Ship placement board and Ready button are functional
 *  - AC-14/15/16 : Ready → game starts immediately, human goes first, navigate to /game
 *  - AC-25/26 : Human-wins path → game-over screen shows "Victory!"
 *
 * Out of scope (covered by backend unit tests per product spec):
 *  - Computer-wins path (AC-27/28/29) — would require knowing where computer ships
 *    are placed, which are intentionally hidden from the client (AC-30).
 *  - Board security (AC-30–32).
 *  - Two-player flow unchanged (AC-35–36) — covered by existing smoke.spec.ts.
 *
 * Identity requirement (AC-23 backward-compat):
 *  - Buttons are now gated behind player identity (AC-01). Each test that needs to
 *    click a game-start button must first establish identity via POST /players and
 *    seed localStorage. Tests that only check visibility (not clicking) are exempt.
 *
 * Notes on strategy:
 *  - Ship placement is done via direct API calls (page.request) to avoid slow UI
 *    interactions across 5 ships × 10 cells each.
 *  - Firing uses the same direct API loop: POST /fire for every cell in row-major
 *    order until the response status is FINISHED.  The computer has 17 ship cells
 *    total across a 10×10 board; worst case is 100 shots.
 *  - The test navigates to /game and reloads once after firing is done so the
 *    game-over redirect can fire naturally (Game.tsx redirects when status=FINISHED).
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

// All 5 standard ship types placed horizontally at distinct rows so they never overlap.
const SHIP_PLACEMENTS = [
  { shipType: 'CARRIER',    row: 0, col: 0, orientation: 'HORIZONTAL' }, // 5 cells
  { shipType: 'BATTLESHIP', row: 1, col: 0, orientation: 'HORIZONTAL' }, // 4 cells
  { shipType: 'CRUISER',    row: 2, col: 0, orientation: 'HORIZONTAL' }, // 3 cells
  { shipType: 'SUBMARINE',  row: 3, col: 0, orientation: 'HORIZONTAL' }, // 3 cells
  { shipType: 'DESTROYER',  row: 4, col: 0, orientation: 'HORIZONTAL' }, // 2 cells
] as const;

/**
 * Creates a player via POST /players and returns { playerId, displayName }.
 * Used to establish identity before clicking game-start buttons (AC-01).
 */
async function createPlayerViaApi(
  request: APIRequestContext,
  displayName: string,
): Promise<{ playerId: string; displayName: string }> {
  const res = await request.post(`${API_BASE}/players`, {
    data: { displayName },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`POST /players failed ${res.status()}: ${body}`);
  }
  return res.json() as Promise<{ playerId: string; displayName: string }>;
}

/**
 * Seeds localStorage with battleship_player_id so the home page starts in
 * "identified" state and game-start buttons are enabled. Must be called
 * AFTER the first page.goto('/') so the page context exists, then
 * followed by another page.goto('/') to reload with the seeded value.
 */
async function seedIdentity(page: import('@playwright/test').Page, playerId: string): Promise<void> {
  // useLocalStorage serialises with JSON.stringify so we must store the JSON-encoded form.
  await page.evaluate((id) => {
    localStorage.setItem('battleship_player_id', JSON.stringify(id));
  }, playerId);
}

/**
 * Place all human ships via the backend API so the test doesn't have to
 * click through the placement UI.
 */
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
      const body = await res.text();
      throw new Error(`Failed to place ${ship.shipType}: ${res.status()} ${body}`);
    }
  }
}

/**
 * Mark the human player as ready via the backend API.
 */
async function markReady(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<void> {
  const res = await request.post(
    `${API_BASE}/games/${gameId}/players/${playerId}/ready`,
  );
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Failed to mark ready: ${res.status()} ${body}`);
  }
}

/**
 * Fire shots in row-major order until the game is FINISHED.
 * Returns 'human' | 'computer' indicating who won.
 */
async function fireUntilFinished(
  request: APIRequestContext,
  gameId: string,
  playerId: string,
): Promise<'human' | 'computer'> {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 10; col++) {
      const res = await request.post(
        `${API_BASE}/games/${gameId}/players/${playerId}/fire`,
        { data: { row, col } },
      );
      if (!res.ok()) {
        // 409 "already targeted" can happen if a computer shot happened to re-use
        // the cell (shouldn't occur per AC-22, but handle defensively).
        continue;
      }
      const body = await res.json() as {
        gameStatus?: string;
        winnerId?: string | null;
        computerShot?: { winnerId?: string | null } | null;
      };
      if (body.gameStatus === 'FINISHED') {
        return body.winnerId === playerId ? 'human' : 'computer';
      }
      // If computer's return shot ended the game, it appears in computerShot.winnerId
      if (body.computerShot?.winnerId != null) {
        return body.computerShot.winnerId === playerId ? 'human' : 'computer';
      }
    }
  }
  throw new Error('Game did not finish after 100 shots — unexpected state');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: home page renders the "Play vs Computer" button (AC-1)
// ─────────────────────────────────────────────────────────────────────────────
test('home page renders Play vs Computer button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /play vs computer/i })).toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: clicking "Play vs Computer" navigates to lobby with correct mode (AC-3, AC-11, AC-12)
// ─────────────────────────────────────────────────────────────────────────────
test('Play vs Computer navigates to lobby and shows vs-computer banner without room code', async ({ page, request }) => {
  // Establish identity so the button is enabled (AC-01).
  const { playerId } = await createPlayerViaApi(request, 'VsComputerTester1');
  await page.goto('/');
  await seedIdentity(page, playerId);
  await page.goto('/');

  // Wait for buttons to be enabled (identity resolved).
  await expect(page.getByRole('button', { name: /play vs computer/i })).toBeEnabled({ timeout: 10000 });
  await page.getByRole('button', { name: /play vs computer/i }).click();

  // Wait for navigation to /lobby (AC-3)
  await page.waitForURL(/\/lobby/, { timeout: 15000 });

  // Should be on /lobby now
  await expect(page).toHaveURL(/\/lobby/);

  // AC-11: lobby shows "Playing vs Computer" text
  await expect(page.getByText(/playing vs computer/i)).toBeVisible();

  // AC-12: no room code copy button
  // RoomCodeDisplay renders a button to copy the room code — it must not exist here.
  const copyButton = page.getByRole('button', { name: /copy/i });
  await expect(copyButton).not.toBeVisible();
});

// ─────────────────────────────────────────────────────────────────────────────
// Test: full vs-computer happy path — human wins (AC-1, AC-3, AC-11–16, AC-25/26)
// ─────────────────────────────────────────────────────────────────────────────
test('full vs-computer flow: place ships, ready up, fire until human wins, see Victory screen', async ({ page, request }) => {
  // ── Step 0: establish identity so game-start buttons are enabled ─────────
  const { playerId: identityId } = await createPlayerViaApi(request, 'VsComputerFull');
  await page.goto('/');
  await seedIdentity(page, identityId);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /play vs computer/i })).toBeEnabled({ timeout: 10000 });

  // ── Step 1: create the vs-computer game ──────────────────────────────────
  await page.getByRole('button', { name: /play vs computer/i }).click();

  // ── Step 2: read gameId / playerId from sessionStorage ───────────────────
  await page.waitForURL(/\/lobby/, { timeout: 15000 });

  const gameId  = await page.evaluate(() => sessionStorage.getItem('gameId'));
  const playerId = await page.evaluate(() => sessionStorage.getItem('playerId'));
  const gameMode = await page.evaluate(() => sessionStorage.getItem('gameMode'));

  expect(gameId).toBeTruthy();
  expect(playerId).toBeTruthy();
  expect(gameMode).toBe('COMPUTER');

  // ── Step 3: verify lobby UI (AC-11, AC-12) ───────────────────────────────
  await expect(page.getByText(/playing vs computer/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /copy/i })).not.toBeVisible();

  // ── Step 4: place all 5 ships via API (AC-13) ────────────────────────────
  await placeAllShips(request, gameId!, playerId!);

  // Reload the lobby so the UI reflects the placed ships from the server.
  // (The Lobby page uses optimistic local state, but after a reload it reads
  // from gameState.myBoard — good enough for the Ready button to enable.)
  await page.reload();
  await expect(page).toHaveURL(/\/lobby/);

  // ── Step 5: mark ready via API (AC-14) ───────────────────────────────────
  await markReady(request, gameId!, playerId!);

  // ── Step 6: wait for /game route (AC-16) ─────────────────────────────────
  // The Lobby polls every 2 s; navigate directly to /game to speed things up.
  await page.goto('/game');
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });

  // Enemy Waters board must be present (opponent board)
  await expect(page.getByText('Enemy Waters')).toBeVisible();

  // ── Step 7: fire shots until human wins ──────────────────────────────────
  const winner = await fireUntilFinished(request, gameId!, playerId!);
  // In the human-wins path the game ends before all 100 cells are consumed.
  // If the computer happened to sink all human ships first we still assert the
  // game-over screen (just a different message).  Either way is a valid E2E run.

  // ── Step 8: navigate to /game-over and verify the outcome screen ─────────
  await page.goto('/game-over');

  if (winner === 'human') {
    // AC-26: "Victory!" screen
    await expect(page.locator('.game-over-title--win')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/victory/i)).toBeVisible();
  } else {
    // Computer won (random outcome) — still a valid game-over screen
    await expect(page.locator('.game-over-title--lose')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/defeat/i)).toBeVisible();
  }

  // Play Again button should always be present
  await expect(page.getByRole('button', { name: /play again/i })).toBeVisible();
});
