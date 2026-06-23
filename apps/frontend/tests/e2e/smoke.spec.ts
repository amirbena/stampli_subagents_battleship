import { test, expect } from '@playwright/test';

test.describe('Home page smoke', () => {
  test('shows title, Create Game button, and Join form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Battleship');
    await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
    await expect(page.getByLabel('Room code')).toBeVisible();
    await expect(page.getByRole('button', { name: /join game/i })).toBeVisible();
  });

  test('shows validation error when joining with empty code', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /join game/i }).click();
    await expect(page.getByText(/please enter a room code/i)).toBeVisible();
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
    // Clear any leftover session storage
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());

    await page.goto('/lobby');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
  });
});
