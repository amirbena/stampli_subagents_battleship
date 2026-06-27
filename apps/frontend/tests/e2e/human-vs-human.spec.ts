/**
 * Full E2E specs — Human-vs-Human Entry (Addendum, Part A).
 *
 * Workflow Run ID: 20260627-164723-ddf33ca
 * Mode: Full E2E (live backend on 8081). No contract change — this validates the
 *       re-enabled human-vs-human entry flow that reuses the PR #58 create/join/
 *       distinct-identity contract end-to-end with two isolated browser contexts.
 *
 * AC coverage:
 *  - AC-1/AC-2/AC-3/AC-4 : "Play Against Another User" visible, enabled, no "Coming
 *                          Soon", and clicking it starts the human-vs-human flow
 *                          (creates a HUMAN game, creator proceeds into the lobby).
 *  - AC-5                : Second player uses the dedicated Join-by-code entry on Home.
 *  - AC-6/AC-6b          : Creator sees a waiting-for-opponent state with the shareable
 *                          code surfaced; can leave/cancel back to Home.
 *  - AC-6a               : When the second player joins, the creator's waiting state ends
 *                          automatically (poll-driven) and the creator proceeds.
 *  - AC-6c               : Second player joins via the real UI as a DISTINCT identity
 *                          (token + playerId differ from the creator — honors PR #58);
 *                          both players end up in the game.
 *  - AC-6d               : A bad/unknown code shows the generic "not joinable" inline
 *                          message and the player stays on Home (no navigation, no crash).
 *
 * Two-context strategy: each test creates isolated browser contexts via
 * `browser.newContext()` so Browser A (creator) and Browser B (joiner) have
 * fully separate localStorage / session state and mint distinct identities.
 *
 * Identity is established via the real UI name-entry where the flow requires it,
 * or seeded into localStorage for setup-only steps — game create/join itself is
 * always driven through the production UI so the AC entry points are exercised.
 */

import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

const IDENTITY_KEY = 'battleship_player_id';
const ACTIVE_GAME_KEY = 'battleship_active_game';

const NOT_JOINABLE_TEXT = 'Game not found or no longer available';

interface BelongingRecord {
  gameId: string;
  playerId: string;
  gameMode: 'COMPUTER' | 'HUMAN';
  sessionToken: string;
}

/** Creates a player record via the backend so identity can be seeded for setup. */
async function createPlayerViaApi(
  request: APIRequestContext,
  displayName: string,
): Promise<{ playerId: string; displayName: string }> {
  const res = await request.post(`${API_BASE}/players`, { data: { displayName } });
  if (!res.ok()) throw new Error(`POST /players failed ${res.status()}: ${await res.text()}`);
  return res.json() as Promise<{ playerId: string; displayName: string }>;
}

/** Seeds an existing identity into localStorage (JSON-encoded, as useLocalStorage stores it). */
async function seedIdentity(page: Page, playerId: string): Promise<void> {
  await page.evaluate(
    ({ key, id }) => localStorage.setItem(key, JSON.stringify(id)),
    { key: IDENTITY_KEY, id: playerId },
  );
}

/** Reads the localStorage active-game belonging pointer, or null if absent. */
async function readActivePointer(page: Page): Promise<BelongingRecord | null> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as BelongingRecord; } catch { return null; }
  }, ACTIVE_GAME_KEY);
}

async function newIsolatedContext(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

/**
 * Drives the real UI to establish identity (if needed) and create a HUMAN game by
 * clicking "Play Against Another User". Lands the creator on /lobby. Returns the
 * creator's belonging pointer (gameId + playerId + sessionToken).
 */
async function createHumanGameViaUi(
  page: Page,
  request: APIRequestContext,
  displayName: string,
): Promise<BelongingRecord> {
  const player = await createPlayerViaApi(request, displayName);
  await page.goto('/');
  await seedIdentity(page, player.playerId);
  await page.goto('/');

  const createBtn = page.getByRole('button', { name: /play against another user/i });
  await expect(createBtn).toBeEnabled({ timeout: 10000 });
  await createBtn.click();

  // Creator routes straight into the lobby (human game starts WAITING_FOR_PLAYERS).
  await page.waitForURL(/\/lobby/, { timeout: 15000 });

  const pointer = await readActivePointer(page);
  if (!pointer?.gameId || !pointer.sessionToken) {
    throw new Error('Creator pointer missing after human game create');
  }
  return pointer;
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-1/AC-2/AC-3/AC-4 — entry available + clicking starts the human flow
// ─────────────────────────────────────────────────────────────────────────────

test('AC-1/2/3/4: "Play Against Another User" is visible, enabled, has no "Coming Soon", and starts the human flow',
  async ({ browser, request }) => {
    const ctx = await newIsolatedContext(browser);
    const page = ctx.page;
    try {
      const player = await createPlayerViaApi(request, 'EntryCreator');
      await page.goto('/');
      await seedIdentity(page, player.playerId);
      await page.goto('/');

      const btn = page.getByRole('button', { name: /play against another user/i });
      await expect(btn).toBeVisible();                       // AC-1
      await expect(btn).not.toContainText(/coming soon/i);   // AC-3
      await expect(btn).toBeEnabled({ timeout: 10000 });     // AC-2

      await btn.click();                                     // AC-4
      // Not a dead/no-op control: a real HUMAN game is created and the creator advances.
      await page.waitForURL(/\/lobby/, { timeout: 15000 });
      const pointer = await readActivePointer(page);
      expect(pointer?.gameMode).toBe('HUMAN');
      expect(pointer?.gameId).toBeTruthy();
      expect(pointer?.sessionToken).toBeTruthy();
    } finally {
      await ctx.context.close();
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AC-6 / AC-6b — creator waiting state surfaces shareable code + can leave to Home
// ─────────────────────────────────────────────────────────────────────────────

test('AC-6/AC-6b: creator sees waiting-for-opponent state with shareable code and can leave back to Home',
  async ({ browser, request }) => {
    const ctx = await newIsolatedContext(browser);
    const page = ctx.page;
    try {
      const creator = await createHumanGameViaUi(page, request, 'WaitingCreator');

      // AC-6: waiting banner is shown and the shareable Room Code (gameId) is surfaced.
      await expect(page.getByText(/waiting for opponent to join/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Room Code')).toBeVisible();
      await expect(page.getByText(creator.gameId, { exact: true })).toBeVisible();
      // The waiting screen is not frozen/errored — placement UI is interactive.
      await expect(page.getByRole('grid', { name: /your board/i })).toBeVisible();

      // AC-6b: the creator can leave/cancel the wait and return Home. Use the Stop control.
      const stopBtn = page.getByRole('button', { name: /stop|leave|quit|exit/i }).first();
      await stopBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
      await expect(page.getByLabel('Game code to join')).toBeVisible();
      // Pointer cleared on stop — no lingering session.
      const ptr = await readActivePointer(page);
      expect(ptr).toBeNull();
    } finally {
      await ctx.context.close();
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AC-5 / AC-6a / AC-6c — two contexts: creator waits; second player joins by code via
// the real UI as a distinct identity; creator auto-transitions; both are in the game.
// ─────────────────────────────────────────────────────────────────────────────

test('AC-5/AC-6a/AC-6c: second player joins by code via UI as a distinct identity; creator auto-transitions; both in game',
  async ({ browser, request }) => {
    test.setTimeout(45000);

    const ctxA = await newIsolatedContext(browser);
    const ctxB = await newIsolatedContext(browser);
    const pageA = ctxA.page;
    const pageB = ctxB.page;

    try {
      // --- Browser A: create a HUMAN game via the UI and wait ---
      const creator = await createHumanGameViaUi(pageA, request, 'JoinCreatorA');
      await expect(pageA.getByText(/waiting for opponent to join/i)).toBeVisible({ timeout: 10000 });

      // --- Browser B: establish a SEPARATE identity, then JOIN via the real UI Join form (AC-5) ---
      const playerB = await createPlayerViaApi(request, 'JoinerB');
      await pageB.goto('/');
      await seedIdentity(pageB, playerB.playerId);
      await pageB.goto('/');

      await pageB.getByLabel('Game code to join').fill(creator.gameId);
      await pageB.getByRole('button', { name: /join game/i }).click();

      // AC-6c: Browser B enters the game (lobby placement) as a distinct identity.
      await pageB.waitForURL(/\/lobby|\/game/, { timeout: 15000 });
      const ptrB = await readActivePointer(pageB);
      expect(ptrB?.gameId).toBe(creator.gameId);            // same game
      expect(ptrB?.playerId).not.toBe(creator.playerId);    // distinct seat (PR #58)
      expect(ptrB?.sessionToken).toBeTruthy();
      expect(ptrB?.sessionToken).not.toBe(creator.sessionToken); // distinct token (PR #58)

      // AC-6a: the creator's waiting state ends automatically (poll-driven), no creator action.
      // The Lobby polls every 2s; once B joined, the game is no longer WAITING_FOR_PLAYERS,
      // so the "Waiting for opponent" banner disappears and the creator stays in the lobby
      // placement / proceeds — both players are now in the game.
      await expect(pageA.getByText(/waiting for opponent to join/i)).toBeHidden({ timeout: 15000 });
      // Creator is still in the active game (lobby or game), not bounced Home.
      await expect(pageA).toHaveURL(/\/lobby|\/game/);
      const ptrA = await readActivePointer(pageA);
      expect(ptrA?.gameId).toBe(creator.gameId);
    } finally {
      await ctxA.context.close();
      await ctxB.context.close();
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AC-6d — bad/unknown code via UI Join → generic not-joinable inline message, stays Home
// ─────────────────────────────────────────────────────────────────────────────

test('AC-6d: second player entering an unknown code sees the generic not-joinable message and stays on Home',
  async ({ browser, request }) => {
    const ctx = await newIsolatedContext(browser);
    const page = ctx.page;
    try {
      const player = await createPlayerViaApi(request, 'BadCodeJoiner');
      await page.goto('/');
      await seedIdentity(page, player.playerId);
      await page.goto('/');

      // An unknown 6-char code that no game uses.
      await page.getByLabel('Game code to join').fill('ZZZZZZ');
      await page.getByRole('button', { name: /join game/i }).click();

      // Generic PR #58 not-joinable inline message, near the input.
      await expect(page.getByText(NOT_JOINABLE_TEXT)).toBeVisible({ timeout: 10000 });
      // No navigation into a game — still on Home (the join form is present).
      await expect(page).toHaveURL('/');
      await expect(page.getByLabel('Game code to join')).toBeVisible();
      // No belonging pointer written for a failed join.
      const ptr = await readActivePointer(page);
      expect(ptr).toBeNull();
      // No crash: the create entry is still functional/visible.
      await expect(page.getByRole('button', { name: /play against another user/i })).toBeVisible();
    } finally {
      await ctx.context.close();
    }
  });
