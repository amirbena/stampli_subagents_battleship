/**
 * Targeted layout test for the "Place Your Ships" (Lobby) screen.
 *
 * Uses page.route() to mock all backend API calls — no real backend needed.
 * Requires the frontend dev server to be running on port 3001.
 *
 * Run:
 *   $env:E2E_BASE_URL='http://localhost:3001'
 *   npx playwright test tests/e2e/lobby-layout.spec.ts --project=chromium
 *
 * If this test FAILS: capture the assertion error + screenshot from playwright-report/,
 * then route to frontend-ui-agent with the exact failing assertion and screenshot path.
 */

import { test, expect, type Page } from '@playwright/test';

const MOCK_GAME_STATE = {
  gameId: 'test-game-layout-001',
  status: 'PLACING_SHIPS',
  currentTurnPlayerId: null,
  winnerId: null,
  myBoard: { ships: [], missedShots: [], hits: [] },
  opponentBoard: { ships: [], missedShots: [], hits: [] },
  myReady: false,
  opponentReady: false,
  gameMode: 'COMPUTER',
};

async function setupLobby(page: Page) {
  // Intercept the polling endpoint so no real backend is needed
  await page.route('**/api/v1/games/*/state**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_GAME_STATE),
    })
  );

  // Seed the localStorage active-game pointer BEFORE navigating — RequireActiveSession
  // reads this single source of truth ('battleship_active_game') on mount and allows
  // the /lobby route only when it is non-null. The value is JSON.stringify of
  // { gameId, playerId, gameMode } (useLocalStorage serialization).
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'battleship_active_game',
      JSON.stringify({
        gameId: 'test-game-layout-001',
        playerId: 'test-player-layout-001',
        gameMode: 'COMPUTER',
      }),
    );
  });

  await page.goto('/lobby');

  // Wait for the layout to be rendered (not a redirect)
  await page.waitForSelector('.lobby-layout', { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Desktop layout
// ---------------------------------------------------------------------------

test.describe('Lobby layout — desktop (1280×800)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('fleet panel left edge aligns with page title', async ({ page }) => {
    await setupLobby(page);

    const h1Box = await page.locator('h1').boundingBox();
    const fleetBox = await page.locator('.fleet-list-panel').boundingBox();

    expect(h1Box, 'h1 must be visible').not.toBeNull();
    expect(fleetBox, '.fleet-list-panel must be visible').not.toBeNull();

    const offset = Math.abs(h1Box!.x - fleetBox!.x);
    expect(offset, `fleet panel left (${fleetBox!.x}px) should align with h1 left (${h1Box!.x}px) — offset was ${offset}px`).toBeLessThan(8);
  });

  test('board area is to the right of fleet panel', async ({ page }) => {
    await setupLobby(page);

    const fleetBox = await page.locator('.fleet-list-panel').boundingBox();
    const boardBox = await page.locator('.lobby-board-area').boundingBox();

    expect(fleetBox).not.toBeNull();
    expect(boardBox).not.toBeNull();

    expect(
      boardBox!.x,
      `board area (${boardBox!.x}px) must start to the right of fleet panel right edge (${fleetBox!.x + fleetBox!.width}px)`,
    ).toBeGreaterThan(fleetBox!.x + fleetBox!.width);
  });

  test('no horizontal overflow', async ({ page }) => {
    await setupLobby(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `page scrollWidth (${scrollWidth}px) must not exceed viewport width (1280px)`,
    ).toBeLessThanOrEqual(1280);
  });

  test('fleet panel, board, and Confirm Ready button are all visible', async ({ page }) => {
    await setupLobby(page);

    await expect(page.locator('.fleet-list-panel')).toBeVisible();
    await expect(page.locator('.game-board')).toBeVisible();
    await expect(page.locator('.confirm-ready-btn')).toBeVisible();
  });

  test('Confirm Ready button is inside board area (not floating separately)', async ({ page }) => {
    await setupLobby(page);

    const boardBox = await page.locator('.lobby-board-area').boundingBox();
    const btnBox  = await page.locator('.confirm-ready-btn').boundingBox();

    expect(boardBox).not.toBeNull();
    expect(btnBox).not.toBeNull();

    // Button must be horizontally within the board area
    expect(btnBox!.x, 'button left must be >= board area left').toBeGreaterThanOrEqual(boardBox!.x - 1);
    expect(btnBox!.x + btnBox!.width, 'button right must be <= board area right').toBeLessThanOrEqual(boardBox!.x + boardBox!.width + 1);
  });
});

// ---------------------------------------------------------------------------
// Mobile layout
// ---------------------------------------------------------------------------

test.describe('Lobby layout — mobile (390×844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no horizontal overflow on mobile', async ({ page }) => {
    await setupLobby(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `page scrollWidth (${scrollWidth}px) must not exceed viewport width (390px)`,
    ).toBeLessThanOrEqual(390);
  });

  test('board appears below fleet panel on mobile (vertical stack)', async ({ page }) => {
    await setupLobby(page);

    const fleetBox = await page.locator('.fleet-list-panel').boundingBox();
    const boardBox = await page.locator('.lobby-board-area').boundingBox();

    expect(fleetBox).not.toBeNull();
    expect(boardBox).not.toBeNull();

    expect(
      boardBox!.y,
      `board area top (${boardBox!.y}px) must be below fleet panel bottom (${fleetBox!.y + fleetBox!.height}px)`,
    ).toBeGreaterThan(fleetBox!.y + fleetBox!.height - 10);
  });

  test('fleet panel fills most of the screen width on mobile', async ({ page }) => {
    await setupLobby(page);

    const fleetBox = await page.locator('.fleet-list-panel').boundingBox();
    expect(fleetBox).not.toBeNull();

    expect(
      fleetBox!.width,
      `fleet panel width (${fleetBox!.width}px) should fill at least 80% of 390px viewport`,
    ).toBeGreaterThan(390 * 0.8);
  });

  test('Confirm Ready button fills most of screen width on mobile', async ({ page }) => {
    await setupLobby(page);

    const btnBox = await page.locator('.confirm-ready-btn').boundingBox();
    expect(btnBox).not.toBeNull();

    expect(
      btnBox!.width,
      `Confirm Ready button (${btnBox!.width}px) should be at least 80% of 390px viewport on mobile`,
    ).toBeGreaterThan(390 * 0.8);
  });
});

// ---------------------------------------------------------------------------
// Tablet layout
// ---------------------------------------------------------------------------

test.describe('Lobby layout — tablet (768×1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('two-column layout is active at 768px', async ({ page }) => {
    await setupLobby(page);

    const fleetBox = await page.locator('.fleet-list-panel').boundingBox();
    const boardBox = await page.locator('.lobby-board-area').boundingBox();

    expect(fleetBox).not.toBeNull();
    expect(boardBox).not.toBeNull();

    // On tablet, board must be to the RIGHT of the fleet panel (same row)
    expect(
      boardBox!.x,
      `at 768px tablet, board area (${boardBox!.x}px) must be to the right of fleet panel (right edge: ${fleetBox!.x + fleetBox!.width}px)`,
    ).toBeGreaterThan(fleetBox!.x + fleetBox!.width);
  });

  test('no horizontal overflow at 768px', async ({ page }) => {
    await setupLobby(page);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(768);
  });
});
