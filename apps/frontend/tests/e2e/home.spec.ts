import { test, expect } from '@playwright/test';

/**
 * Home page smoke checks — updated for the navigation/recovery/exit run
 * (Workflow Run ID: 20260625-223903-b071a6c).
 *
 * The old "Create Game" / "Join Game" room-creation UI was replaced:
 *  - "Create Game"      → disabled "Play Against Another User (Coming Soon)" (AC-14).
 *  - "Join Game" + "Room code" input → restore-by-code "Game code" input (AC-7).
 * These checks track that new surface so a regression in the Home shell fails here.
 */

test('home page renders the Play vs Computer button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /play vs computer/i })).toBeVisible();
});

test('home page shows the restore-by-code (Game code) input', async ({ page }) => {
  await page.goto('/');
  // The restore input replaces the old room-code/join input (AC-7).
  await expect(page.getByLabel('Game code')).toBeVisible();
  await expect(page.getByRole('button', { name: /restore game/i })).toBeVisible();
});
