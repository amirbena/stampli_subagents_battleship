import { test, expect } from '@playwright/test';

test.describe('Home page smoke', () => {
  test('shows title, Create Game button, and Join form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Battleship');
    await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
    await expect(page.getByLabel('Room code')).toBeVisible();
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible();
  });

  test('shows name-entry form and disabled buttons on first visit (AC-01)', async ({ page }) => {
    // First visit: no battleship_player_id in localStorage → name-entry gate shown,
    // all game-start buttons disabled until the user enters a name.
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: /display name/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create game/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /join game/i })).toBeDisabled();
  });

  test('shows Play vs Computer button alongside Create Game', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /play vs computer/i })).toBeVisible();
    // Both mode buttons must coexist on the home page (AC-1)
    await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
  });
});

test.describe('Lobby redirect smoke', () => {
  test('redirects to home when session is missing', async ({ page }) => {
    // Clear any leftover session — the route guard (RequireActiveSession) now reads
    // the localStorage active-game pointer ('battleship_active_game'), not
    // sessionStorage. With no pointer, deep-linking to /lobby must redirect to /.
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('battleship_active_game');
      sessionStorage.clear();
    });

    await page.goto('/lobby');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
  });
});
