import { test, expect } from '@playwright/test';

/**
 * Frontend-only smoke. Updated for the navigation/recovery/exit run
 * (Workflow Run ID: 20260625-223903-b071a6c): the room-creation UI
 * ("Create Game" / "Join Game" / "Room code" input) was replaced by the
 * restore-by-code UI ("Game code" input + "Restore Game").
 *
 * Updated again for the Human-vs-Human entry addendum
 * (Workflow Run ID: 20260627-164723-ddf33ca, AC-1..AC-4): the previously
 * disabled "Play Against Another User (Coming Soon)" placeholder is now an
 * ENABLED, real game mode with NO "Coming Soon" text, plus a dedicated
 * Join-by-code form for the second player.
 */

test.describe('Home page smoke', () => {
  test('shows title, Play vs Computer, and the Restore-by-code form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Battleship');
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeVisible();
    // Restore-by-code input replaces the old room-code/join input (AC-7).
    await expect(page.getByLabel('Game code', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /restore game/i })).toBeVisible();
  });

  test('shows name-entry form and disabled game-start button on first visit (AC-01)', async ({ page }) => {
    // First visit: no battleship_player_id in localStorage → name-entry gate shown,
    // the game-start button is disabled until the user enters a name.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('battleship_player_id');
      localStorage.removeItem('battleship_active_game');
    });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
  });

  test('human-vs-human entry is visible, enabled, and free of Coming Soon (AC-1/AC-2/AC-3)', async ({ page, request }) => {
    // Establish a REAL identity (POST /players) so the GET /players validation resolves to
    // 'identified' and the game-start buttons enable (AC-01 gate). A fake localStorage id
    // would 404 and drop back to 'needs-name' (button disabled).
    const res = await request.post('http://localhost:8081/api/v1/players', {
      data: { displayName: 'SmokeHvHIdentity' },
    });
    const { playerId } = (await res.json()) as { playerId: string };
    await page.goto('/');
    await page.evaluate((id) => {
      localStorage.setItem('battleship_player_id', JSON.stringify(id));
    }, playerId);
    await page.goto('/');
    const multiplayerBtn = page.getByRole('button', { name: /play against another user/i });
    // AC-1: visible
    await expect(multiplayerBtn).toBeVisible();
    // AC-3: no "Coming Soon" text
    await expect(multiplayerBtn).not.toContainText(/coming soon/i);
    // AC-2: enabled (clickable, not disabled) once identity is resolved.
    await expect(multiplayerBtn).toBeEnabled({ timeout: 10000 });
  });

  test('join-by-code form is present for the second player (AC-5)', async ({ page }) => {
    await page.goto('/');
    // The dedicated second-player join entry: a "Game code to join" input + Join Game button.
    await expect(page.getByLabel('Game code to join')).toBeVisible();
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible();
  });
});

test.describe('Lobby redirect smoke', () => {
  test('redirects to home when session is missing', async ({ page }) => {
    // The route guard (RequireActiveSession) reads the localStorage active-game pointer
    // ('battleship_active_game'). With no pointer, deep-linking to /lobby must redirect to /.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('battleship_active_game');
      sessionStorage.clear();
    });

    await page.goto('/lobby');
    await expect(page).toHaveURL('/');
    // Landed on a clean Home (the restore form is present), not a broken lobby.
    await expect(page.getByLabel('Game code', { exact: true })).toBeVisible();
  });
});
