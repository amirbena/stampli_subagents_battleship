import { test, expect } from '@playwright/test';

/**
 * Frontend-only smoke. Updated for the navigation/recovery/exit run
 * (Workflow Run ID: 20260625-223903-b071a6c): the room-creation UI
 * ("Create Game" / "Join Game" / "Room code" input) was replaced by the
 * restore-by-code UI ("Game code" input + "Restore Game") and a disabled
 * "Play Against Another User (Coming Soon)" button (AC-7, AC-14).
 */

test.describe('Home page smoke', () => {
  test('shows title, Play vs Computer, and the Restore-by-code form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Battleship');
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeVisible();
    // Restore-by-code input replaces the old room-code/join input (AC-7).
    await expect(page.getByLabel('Game code')).toBeVisible();
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

  test('multiplayer button is disabled and reads Coming Soon (AC-14)', async ({ page }) => {
    await page.goto('/');
    const multiplayerBtn = page.getByRole('button', { name: /play against another user/i });
    await expect(multiplayerBtn).toBeVisible();
    await expect(multiplayerBtn).toContainText(/coming soon/i);
    await expect(multiplayerBtn).toBeDisabled();
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
    await expect(page.getByLabel('Game code')).toBeVisible();
  });
});
