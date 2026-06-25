/**
 * Full E2E specs for Guest & Persistent Player Identity.
 *
 * Coverage:
 *  - AC-01  : First-visit gate — name-entry shown, all game-start buttons disabled
 *  - AC-06  : localStorage['battleship_player_id'] written after POST /players
 *  - AC-07  : Returning visit — GET /players resolves, welcome banner shown, gate skipped
 *  - AC-08  : Stale ID → 404 → localStorage cleared → name-entry gate shown
 *  - AC-09  : Returning visitor never re-prompted if stored ID resolves successfully
 *  - AC-11  : vs Computer game created with playerId, echoed back; playerA linked
 *  - AC-13  : Human join with playerId; backend links playerB
 *  - AC-16  : Computer opponent shown as "Computer", not the COMPUTER-<uuid> sentinel
 *  - AC-22  : Existing game state endpoint unaffected
 *  - AC-23  : POST /games without playerId still works (backward-compat anonymous path)
 *
 * Also covers: empty room-code validation error AFTER identity is established
 * (scenario removed from smoke.spec.ts because buttons are identity-gated).
 *
 * Mode: Full E2E (live backend on 8081 required — API contract changed).
 * Both frontend (E2E port 3010) and backend (port 8081) are auto-started by playwright.config.ts.
 *
 * Strategy:
 *  - Never hardcode player IDs or game IDs; always derive from API responses.
 *  - Pre-seed localStorage via page.evaluate() BEFORE the final page.goto('/').
 *    IMPORTANT: useLocalStorage hook reads via JSON.parse(), so values must be
 *    stored as JSON.stringify(value) — e.g. '"my-uuid"' not 'my-uuid'.
 *    Seed helper below handles this correctly.
 *  - Use direct backend API calls (page.request) for setup steps that don't need UI
 *    (e.g. creating a player, placing ships, marking ready) to keep tests deterministic.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a player via POST /players and returns { playerId, displayName }.
 * Uses the Playwright request context so it runs through the live backend.
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
 * Seeds battleship_player_id in localStorage as a JSON-stringified value.
 * The useLocalStorage hook uses JSON.stringify on write and JSON.parse on read,
 * so raw UUID strings stored without JSON.stringify would be parsed as null.
 * Must be called while on an existing page context (after a page.goto).
 * Follow with another page.goto('/') so React reads the seeded value on init.
 */
async function seedPlayerId(page: Page, playerId: string): Promise<void> {
  await page.evaluate((id) => {
    // Store JSON.stringify(id) so the hook's JSON.parse reads it correctly.
    localStorage.setItem('battleship_player_id', JSON.stringify(id));
  }, playerId);
}

/**
 * Reads the JSON-deserialized battleship_player_id from localStorage.
 * Returns null if the key is absent or the stored value is JSON null.
 */
async function readStoredPlayerId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('battleship_player_id');
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as string | null;
    } catch {
      return null;
    }
  });
}

/**
 * Reads the localStorage active-game pointer ('battleship_active_game') written by
 * Home on create/join. gameId/playerId/gameMode migrated OUT of sessionStorage into
 * this single localStorage pointer (JSON.stringify of { gameId, playerId, gameMode }).
 */
async function readActivePointer(
  page: Page,
): Promise<{ gameId: string; playerId: string; gameMode: string } | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('battleship_active_game');
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as { gameId: string; playerId: string; gameMode: string } | null;
    } catch {
      return null;
    }
  });
}

const SHIP_PLACEMENTS = [
  { shipType: 'CARRIER',    row: 0, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'BATTLESHIP', row: 1, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'CRUISER',    row: 2, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'SUBMARINE',  row: 3, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'DESTROYER',  row: 4, col: 0, orientation: 'HORIZONTAL' },
] as const;

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
      if (!res.ok()) continue;
      const body = await res.json() as {
        gameStatus?: string;
        winnerId?: string | null;
        computerShot?: { winnerId?: string | null } | null;
      };
      if (body.gameStatus === 'FINISHED') {
        return body.winnerId === playerId ? 'human' : 'computer';
      }
      if (body.computerShot?.winnerId != null) {
        return body.computerShot.winnerId === playerId ? 'human' : 'computer';
      }
    }
  }
  throw new Error('Game did not finish after 100 shots');
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow 1 — First Visit (AC-01, AC-06)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Flow 1 — First visit (no localStorage)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page first so we can access localStorage, then clear it.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('battleship_player_id');
      sessionStorage.clear();
    });
  });

  test('AC-01: name-entry gate shown and all game-start buttons disabled', async ({ page }) => {
    await page.goto('/');

    // Name-entry section must be visible — use textbox role to avoid strict-mode
    // ambiguity with the section's aria-label ("Enter your display name").
    await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible();

    // The game-start action must be disabled until identity is established. (The old
    // "Create Game" / "Join Game" human-game buttons were removed this run — multiplayer
    // is disabled, AC-14 — so only "Play vs Computer" remains as an identity-gated action.)
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });

  test('AC-06: entering valid name calls POST /players, writes localStorage, enables buttons', async ({ page }) => {
    await page.goto('/');

    // Intercept POST /players to confirm the request is made with the name.
    const playerRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/players') && req.method() === 'POST',
    );

    // Type a valid name and submit.
    await page.getByRole('textbox', { name: /display name/i }).fill('TestPlayer');
    await page.getByRole('button', { name: /save name/i }).click();

    // Confirm POST /players was called.
    const playerRequest = await playerRequestPromise;
    const requestBody = JSON.parse(playerRequest.postData() ?? '{}') as { displayName?: string };
    expect(requestBody.displayName).toBe('TestPlayer');

    // After identity resolves, the game-start button must be enabled.
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeEnabled({ timeout: 8000 });

    // AC-06: localStorage must contain a valid UUID player ID.
    // useLocalStorage stores via JSON.stringify, so read with JSON.parse.
    const storedId = await readStoredPlayerId(page);
    expect(storedId).toBeTruthy();
    expect(storedId).toMatch(/^[0-9a-f-]{36}$/i); // UUID shape
  });

  test('AC-02: empty name submission shows inline validation error', async ({ page }) => {
    await page.goto('/');

    // Submit empty name.
    await page.getByRole('button', { name: /save name/i }).click();

    // Expect inline error — either the backend 400 message or the code-mapped string.
    await expect(page.getByRole('alert')).toContainText(/display name is required/i, { timeout: 5000 });

    // The game-start button must still be disabled.
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });

  test('AC-04: name with invalid chars shows inline error', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('textbox', { name: /display name/i }).fill('Bad<Name>!');
    await page.getByRole('button', { name: /save name/i }).click();

    await expect(page.getByRole('alert')).toContainText(
      /letters, numbers, spaces, hyphens, and underscores/i,
      { timeout: 5000 },
    );
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });

  // NOTE: the former "empty room-code join shows validation error" test was removed this
  // run — the human-game Join UI ("Join Game" button + room-code input) was replaced by the
  // restore-by-code flow (multiplayer disabled, AC-14). Empty-code validation for the new
  // restore input is covered by frontend Vitest unit tests; the restore happy/not-found
  // paths are covered by navigation-recovery-exit.spec.ts (AC-7/8/9/10).
});

// ─────────────────────────────────────────────────────────────────────────────
// Flow 2 — Returning Visit (AC-07, AC-08, AC-09)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Flow 2 — Returning visit', () => {
  test('AC-07/AC-09: valid localStorage ID → welcome banner shown, gate skipped', async ({ page, request }) => {
    // Create a real player so the backend can validate the stored ID.
    const { playerId, displayName } = await createPlayerViaApi(request, 'AlexReturning');

    // Seed localStorage with the JSON-encoded player ID (matches useLocalStorage format).
    await page.goto('/');
    await seedPlayerId(page, playerId);
    await page.goto('/');

    // Name-entry gate must NOT be shown.
    await expect(page.getByRole('textbox', { name: /display name/i })).not.toBeVisible({ timeout: 10000 });

    // Welcome banner must appear. Target the .welcome-banner element directly
    // to avoid strict-mode issues with getByText when displayName spans a <strong>.
    await expect(page.locator('.welcome-banner')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.welcome-banner__name')).toContainText(displayName);

    // The game-start button is enabled once identity resolves.
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeEnabled({ timeout: 10000 });
  });

  test('AC-08: stale ID (unknown to backend) → localStorage cleared, name-entry shown', async ({ page }) => {
    // Use a UUID that was never registered on the backend.
    const staleId = '00000000-0000-0000-0000-000000000000';

    await page.goto('/');
    await seedPlayerId(page, staleId);
    await page.goto('/');

    // After the GET /players 404, the hook clears localStorage and shows name-entry.
    await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible({ timeout: 12000 });

    // Wait until localStorage is cleared (React async state update may lag behind DOM).
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('battleship_player_id');
      if (raw === null) return true;
      try {
        return JSON.parse(raw) === null;
      } catch {
        return false;
      }
    }, null, { timeout: 5000 });

    const storedId = await readStoredPlayerId(page);
    expect(storedId).toBeNull();

    // The game-start button must remain disabled.
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-11 — Play vs Computer with identity (end-to-end, + AC-16 computer label)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AC-11 — vs Computer with player identity', () => {
  test('identified player creates vs-computer game; playerId echoed back; Computer label shown on game-over', async ({ page, request }) => {
    const { playerId, displayName } = await createPlayerViaApi(request, 'ComputerFighter');

    await page.goto('/');
    await seedPlayerId(page, playerId);
    await page.goto('/');

    // Wait for identity to resolve — check welcome banner visible.
    await expect(page.locator('.welcome-banner')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('.welcome-banner__name')).toContainText(displayName);

    // Intercept POST /games to verify the playerId is sent in the body.
    const createGameRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/games') && req.method() === 'POST' && !req.url().includes('/join'),
    );

    await page.getByRole('button', { name: /play vs computer/i }).click();
    // Acknowledge the start-of-game code popup (AC-5) before entering the game.
    await page.getByRole('button', { name: /got it, start playing/i }).click();
    await page.waitForURL(/\/lobby/, { timeout: 15000 });

    const createGameRequest = await createGameRequestPromise;
    const createBody = JSON.parse(createGameRequest.postData() ?? '{}') as { playerId?: string };

    // AC-11: the playerId sent matches the one we created.
    expect(createBody.playerId).toBe(playerId);

    // AC-11: the response echoes back the SAME playerId (same UUID end-to-end, OQ-3).
    // gameId/playerId now live in the localStorage active-game pointer.
    const pointer = await readActivePointer(page);
    const gameId  = pointer?.gameId ?? null;
    expect(pointer?.playerId).toBe(playerId);
    expect(gameId).toBeTruthy();

    // Place ships and mark ready via API to speed up the test.
    await placeAllShips(request, gameId!, playerId);
    await markReady(request, gameId!, playerId);

    // Navigate directly to game page.
    await page.goto('/game');
    await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });

    // Fire until the game ends.
    const winner = await fireUntilFinished(request, gameId!, playerId);

    // Navigate to game-over.
    await page.goto('/game-over');

    // AC-16: the game-over page must NEVER show a raw COMPUTER- sentinel UUID.
    const pageContent = await page.content();
    expect(pageContent).not.toMatch(/COMPUTER-[0-9a-f-]{36}/i);

    if (winner === 'computer') {
      // When the computer wins the defeat message reads "by Computer" — not by UUID.
      await expect(page.getByText(/by computer/i)).toBeVisible({ timeout: 8000 });
    } else {
      // Human wins — victory screen.
      await expect(page.getByText(/victory/i)).toBeVisible({ timeout: 8000 });
    }

    // Play Again button present regardless of outcome.
    await expect(page.getByRole('button', { name: /play again/i })).toBeVisible();
  });
});

// NOTE: the former "AC-13 — Human game join with player identity" describe block was
// removed this run. The human-vs-human create/join UI ("Create Game" / "Join Game" +
// room-code input) no longer exists — multiplayer is disabled and surfaced only as the
// disabled "Play Against Another User (Coming Soon)" button (AC-14). The backend join
// contract itself is unchanged and still covered by backend tests; there is simply no UI
// path to exercise it end-to-end, so the browser-level human-join flow is intentionally
// dropped from E2E. The vs-Computer identity flow above retains full coverage.

// ─────────────────────────────────────────────────────────────────────────────
// AC-22/AC-23 — Backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AC-22/AC-23 — Backward compatibility', () => {
  test('AC-23: POST /games without playerId still creates a game (anonymous path)', async ({ request }) => {
    // The backend must accept POST /games with no body (anonymous backward-compat path).
    const res = await request.post(`${API_BASE}/games`, {
      params: { mode: 'COMPUTER' },
      // Explicitly send no body — this mirrors the old pre-identity flow.
    });
    expect(res.status()).toBe(201);
    const body = await res.json() as { gameId?: string; playerId?: string; status?: string; gameMode?: string };
    expect(body.gameId).toBeTruthy();
    expect(body.playerId).toBeTruthy(); // server-generated anonymous UUID
    expect(body.status).toBe('PLACING_SHIPS');
    expect(body.gameMode).toBe('COMPUTER');
  });

  test('AC-22: GET /games/{gameId}/state still returns sanitised state (unchanged shape)', async ({ request }) => {
    // Create an anonymous game and fetch its state — verifies the existing endpoint is unaffected.
    const createRes = await request.post(`${API_BASE}/games`, {
      params: { mode: 'COMPUTER' },
    });
    expect(createRes.status()).toBe(201);
    const { gameId, playerId } = await createRes.json() as { gameId: string; playerId: string };

    const stateRes = await request.get(`${API_BASE}/games/${gameId}/state`, {
      params: { playerId },
    });
    expect(stateRes.status()).toBe(200);
    const state = await stateRes.json() as Record<string, unknown>;

    // Shape must include the known fields (AC-22 — endpoint shape unchanged).
    expect(state).toHaveProperty('gameId');
    expect(state).toHaveProperty('status');
    expect(state).toHaveProperty('myBoard');
    expect(state).toHaveProperty('opponentBoard');

    // No un-hit opponent ship positions must be present (hidden-ship invariant, AC-21).
    const opponentBoard = state['opponentBoard'] as { ships?: unknown[] } | undefined;
    expect(Array.isArray(opponentBoard?.ships)).toBe(true);
    // At PLACING_SHIPS phase the opponent's ships array is empty for the requester.
    expect(opponentBoard?.ships).toHaveLength(0);
  });
});
