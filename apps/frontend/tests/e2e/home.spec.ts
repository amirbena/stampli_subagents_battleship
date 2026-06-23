import { test, expect } from '@playwright/test';

test('home page loads and shows Create Game button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /create game/i })).toBeVisible();
});

test('home page shows Join Game input', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('textbox')).toBeVisible();
});
