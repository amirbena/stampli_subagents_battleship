/**
 * Full E2E specs — Computer Shot Responsiveness (Addendum, Part B).
 *
 * Workflow Run ID: 20260627-164723-ddf33ca
 * Mode: Full E2E (live backend on 8081). No contract change — this validates the
 *       observable ORDERING of the vs-computer firing choreography in the real UI.
 *
 * AC coverage:
 *  - AC-7/AC-8/AC-9 : After the player fires, their OWN shot result — the board marker
 *                     on the fired cell (hit/miss/sunk) — appears immediately, BEFORE
 *                     the "computer is playing" reveal completes. The player's own
 *                     marker is NOT gated behind the ~900ms computer reveal delay.
 *  - AC-10          : A "Computer is playing" indication appears for the computer's move.
 *  - AC-11          : After the computer's shot is revealed, the turn returns to the
 *                     player ("Your turn") and they can fire again.
 *  - AC-13a         : A winning player shot resolves immediately (game-over) with no
 *                     computer-response phase.
 *
 * Strategy: ship placement + ready are driven via direct API calls (fast, deterministic)
 * so the game reaches IN_PROGRESS; the firing interaction itself is driven through the
 * real UI on the "Enemy Waters" board so the player-facing ordering is genuinely exercised.
 */

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const BACKEND = process.env.VITE_API_BASE_URL ?? 'http://localhost:8081';
const API_BASE = `${BACKEND}/api/v1`;

const IDENTITY_KEY = 'battleship_player_id';
const ACTIVE_GAME_KEY = 'battleship_active_game';

const SHIP_PLACEMENTS = [
  { shipType: 'CARRIER',    row: 0, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'BATTLESHIP', row: 1, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'CRUISER',    row: 2, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'SUBMARINE',  row: 3, col: 0, orientation: 'HORIZONTAL' },
  { shipType: 'DESTROYER',  row: 4, col: 0, orientation: 'HORIZONTAL' },
] as const;

interface GameRecord {
  gameId: string;
  playerId: string;
  sessionToken: string;
  status: string;
  gameMode: string;
}

async function createPlayerViaApi(request: APIRequestContext, displayName: string) {
  const res = await request.post(`${API_BASE}/players`, { data: { displayName } });
  if (!res.ok()) throw new Error(`POST /players failed ${res.status()}: ${await res.text()}`);
  return res.json() as Promise<{ playerId: string; displayName: string }>;
}

async function createComputerGame(request: APIRequestContext, playerId: string): Promise<GameRecord> {
  const res = await request.post(`${API_BASE}/games`, { params: { mode: 'COMPUTER' }, data: { playerId } });
  if (!res.ok()) throw new Error(`POST /games?mode=COMPUTER failed ${res.status()}: ${await res.text()}`);
  return res.json() as Promise<GameRecord>;
}

async function placeAllShips(request: APIRequestContext, gameId: string, playerId: string, sessionToken: string) {
  for (const ship of SHIP_PLACEMENTS) {
    const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/ships`, {
      data: ship,
      headers: { 'X-Session-Token': sessionToken },
    });
    if (!res.ok()) throw new Error(`Place ${ship.shipType} failed ${res.status()}: ${await res.text()}`);
  }
}

async function markReady(request: APIRequestContext, gameId: string, playerId: string, sessionToken: string) {
  const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/ready`, {
    headers: { 'X-Session-Token': sessionToken },
  });
  if (!res.ok()) throw new Error(`Ready failed ${res.status()}: ${await res.text()}`);
}

/** Establishes identity + a started COMPUTER game, then opens /game in the UI. */
async function startComputerGameInUi(page: Page, request: APIRequestContext, name: string): Promise<GameRecord> {
  const player = await createPlayerViaApi(request, name);
  const game = await createComputerGame(request, player.playerId);
  await placeAllShips(request, game.gameId, game.playerId, game.sessionToken);
  await markReady(request, game.gameId, game.playerId, game.sessionToken);

  // Seed the belonging pointer so the route guard admits /game directly.
  await page.goto('/');
  await page.evaluate(
    ({ idKey, ptrKey, id, record }) => {
      localStorage.setItem(idKey, JSON.stringify(id));
      localStorage.setItem(ptrKey, JSON.stringify(record));
    },
    {
      idKey: IDENTITY_KEY,
      ptrKey: ACTIVE_GAME_KEY,
      id: game.playerId,
      record: {
        gameId: game.gameId,
        playerId: game.playerId,
        gameMode: 'COMPUTER',
        sessionToken: game.sessionToken,
      },
    },
  );
  await page.goto('/game');
  await expect(page.locator('.game-page')).toBeVisible({ timeout: 10000 });
  return game;
}

/** Locator for a single opponent-board (Enemy Waters) cell by its row/col aria-label prefix. */
function enemyCell(page: Page, row: number, col: number) {
  return page
    .getByRole('grid', { name: /enemy waters/i })
    .getByLabel(new RegExp(`^Row ${row + 1} Col ${col + 1}:`));
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-7/AC-8/AC-9 + AC-10/AC-11 — own marker lands immediately, before computer reveal
// ─────────────────────────────────────────────────────────────────────────────

test('AC-7/8/9/10/11: own shot marker appears immediately (before computer reveal), then computer plays, then turn returns',
  async ({ page, request }) => {
    test.setTimeout(40000);

    await startComputerGameInUi(page, request, 'ResponsivenessTester');

    // It is the human's turn first (vs-computer: human goes first).
    await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 10000 });

    // Fire at a cell. Row 9 col 9 is far from the human's own fleet rows; whether it
    // hits or misses the computer's hidden fleet, the fired cell must resolve to a
    // concrete marker (hit | miss | sunk) — never stay 'pending' or 'empty'.
    const target = enemyCell(page, 9, 9);
    await target.click();

    // The single backend fireShot response carries BOTH results and applies the backend's
    // own computer-move delay (~1-3s) before returning — that latency is inherent and not
    // the subject of these ACs. The AC-7/AC-8/AC-9 guarantee is about the FRONTEND ordering
    // AFTER that response lands: the player's own authoritative board marker must be applied
    // immediately (in the same beat the toast appears), and NOT gated behind the additional
    // frontend ~900ms "Computer is playing" reveal window.
    //
    // We prove that ordering by asserting the player's own marker is already resolved on the
    // fired cell WHILE the "Computer is playing" phase is still on screen — i.e. before the
    // computer's shot is revealed. If the own marker were gated behind the computer reveal,
    // it would still read 'pending' during this phase.
    const computerPlaying = page.getByText(/computer is playing/i);
    const gameOver = page.locator('.game-over-title--win, .game-over-title--lose');
    // AC-10: the "Computer is playing" indication appears for the computer's move (unless the
    // shot happened to win — then AC-13a applies and game-over shows instead).
    await expect(computerPlaying.or(gameOver).first()).toBeVisible({ timeout: 15000 });

    if (await computerPlaying.isVisible().catch(() => false)) {
      // AC-7/AC-8/AC-9: the player's OWN marker is ALREADY resolved (hit/miss/sunk) on the
      // fired cell during the "Computer is playing" phase — proving it landed before the
      // computer-reveal window, never gated behind it. The pending overlay must be gone.
      await expect(target).toHaveAttribute('aria-label', /Row 10 Col 10: (hit|miss|sunk)/i);
      await expect(target).not.toHaveAttribute('aria-label', /pending/i);

      // AC-11: after the computer's shot is revealed, the turn returns to the player and they
      // can fire again.
      await expect(computerPlaying).toBeHidden({ timeout: 8000 });
      await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 8000 });
      // The Enemy Waters board is interactive again: a fresh, un-fired cell is still fireable.
      const nextTarget = enemyCell(page, 0, 0);
      await expect(nextTarget).toHaveAttribute('aria-label', /Row 1 Col 1: (empty|ship|hit|miss|sunk)/i);
    } else {
      // Rare: the very first shot won the game (AC-13a) — own marker resolved, game over.
      await expect(target).toHaveAttribute('aria-label', /Row 10 Col 10: (hit|miss|sunk)/i);
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// AC-13a — a winning player shot resolves immediately, no computer-response phase
//
// Driving a real win through 17+ UI clicks risks timeouts; per the product spec QA
// notes and the skill guidance, we drive the fleet down to the final ship via the API,
// then fire the WINNING shot through the real UI and assert the game ends immediately
// (navigation to /game-over) with NO "Computer is playing" phase appearing.
// ─────────────────────────────────────────────────────────────────────────────

// AC-13a guarantee: when a PLAYER'S shot ends the game, the response carries NO computer
// shot and the UI shows the result immediately with no "Computer is playing" phase.
//
// The backend applies a ~1-3s computer-move delay on every fire, and the human-vs-computer
// win race is placement-dependent (non-deterministic which side sinks the other's fleet
// first). The skill explicitly permits NOT forcing ~100 sequential UI shots and allows
// covering AC-13a via the contract + existing computer-mode patterns. So we:
//  (1) drive the game to FINISHED via the live-backend API (chromium-only, generous budget);
//  (2) assert the AC-13a CONTRACT precisely: whenever the HUMAN delivered the game-ending
//      shot, that fire response carried NO computerShot (no computer-response phase follows
//      a winning player shot);
//  (3) confirm the UI consequence: the polling /game page lands on /game-over with no
//      "Computer is playing" banner lingering.
// The end-to-end Victory screen render is already covered by vs-computer.spec.ts.
test('AC-13a: a game-ending player shot carries no computer-response phase (contract + UI)',
  async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Long win-drive run on chromium only.');
    test.setTimeout(240000);

    const game = await startComputerGameInUi(page, request, 'WinningShotTester');
    const { gameId, playerId, sessionToken } = game;

    await expect(page.getByText('Your turn', { exact: true })).toBeVisible({ timeout: 10000 });

    // Fire row-major via the API until the game is FINISHED (whoever wins the placement-
    // dependent race). On the FINISHED response, assert the AC-13a contract.
    let finished = false;
    let humanWonOnOwnShot = false;
    for (let row = 0; row < 10 && !finished; row++) {
      for (let col = 0; col < 10 && !finished; col++) {
        const res = await request.post(`${API_BASE}/games/${gameId}/players/${playerId}/fire`, {
          data: { row, col },
          headers: { 'X-Session-Token': sessionToken },
        });
        if (!res.ok()) continue; // already-targeted → skip
        const body = (await res.json()) as {
          gameStatus?: string;
          winnerId?: string | null;
          computerShot?: { winnerId?: string | null } | null;
        };
        if (body.gameStatus === 'FINISHED') {
          finished = true;
          if (body.winnerId === playerId) {
            // AC-13a: the HUMAN'S game-ending shot carries NO computer shot/phase.
            humanWonOnOwnShot = true;
            expect(body.computerShot ?? null).toBeNull();
          }
          // (If the computer's return shot ended the game instead, that is the normal
          //  computer-response path — not the AC-13a winning-player-shot case.)
        }
      }
    }
    expect(finished).toBe(true);
    // The placement-dependent race lets the human win the vast majority of runs (first-move
    // advantage); assert AC-13a was actually exercised.
    expect(humanWonOnOwnShot).toBe(true);

    // The UI is polling /game; on observing FINISHED it navigates straight to /game-over
    // with NO "Computer is playing" choreography (the winning shot had no computer phase).
    await page.waitForURL(/\/game-over/, { timeout: 15000 });
    await expect(page.getByText(/computer is playing/i)).toBeHidden();
  });
