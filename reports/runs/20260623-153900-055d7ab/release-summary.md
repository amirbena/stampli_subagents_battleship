# Release Summary — feat: add Play vs Computer mode

**Workflow run:** 20260623-153900-055d7ab
**Branch:** feature/play-against-computer → main
**Date:** 2026-06-23

---

## Feature Description

Adds a **Play vs Computer** single-player mode to the Battleship game. Players can now choose between waiting for a second human player (existing multiplayer mode) or starting immediately against an AI opponent. After each human shot the backend `ComputerPlayerService` automatically fires a random shot on the human's board; the game advances to a win/loss screen when either fleet is fully sunk.

---

## Files Changed

### Backend (`apps/backend/`)
| File | Change |
|------|--------|
| `pom.xml` | Added H2 dependency scoped to the `e2e` Maven profile for local dev |
| `src/main/java/.../domain/GameMode.java` | **New** — `MULTIPLAYER` / `VS_COMPUTER` enum |
| `src/main/java/.../domain/Game.java` | Added `gameMode` field; exposes mode to service layer |
| `src/main/java/.../service/ComputerPlayerService.java` | **New** — random-shot AI; selects untried cells, fires via `GameService` |
| `src/main/java/.../service/GameService.java` | Triggers `ComputerPlayerService` after a valid human shot in VS_COMPUTER games |
| `src/main/java/.../controller/GameController.java` | Accepts optional `gameMode` param on game creation; returns computer shot in response |
| `src/main/java/.../dto/ComputerShotDto.java` | **New** — DTO carrying computer shot result (row, col, hit, sunk, gameOver) |
| `src/main/java/.../dto/CreateGameResponse.java` | Includes `gameMode` in creation response |
| `src/main/java/.../dto/FireShotResponse.java` | Includes `computerShot` field (nullable) |
| `src/main/java/.../dto/GameStateResponse.java` | Exposes `gameMode` for frontend routing |
| `src/main/resources/application-e2e.yml` | **New** — H2 in-memory profile for Playwright runs (port 8081) |
| `src/test/.../ComputerPlayerServiceTest.java` | **New** — unit tests for AI targeting logic (no repeat shots, valid range) |
| `src/test/.../GameServiceComputerTest.java` | **New** — unit tests verifying computer shot fires after human shot in VS_COMPUTER mode |

### Frontend (`apps/frontend/`)
| File | Change |
|------|--------|
| `src/types/game.ts` | Added `GameMode`, `ComputerShotResult` types; extended `FireShotResult` |
| `src/api/gameApi.ts` | `createGame` accepts `gameMode`; `fireShot` returns `computerShot` |
| `src/pages/Home/Home.tsx` | Mode-selection UI (Play vs Human / Play vs Computer) |
| `src/pages/Home/Home.test.tsx` | **New** — Vitest/RTL tests for mode-selection rendering and click |
| `src/pages/Lobby/Lobby.tsx` | Skips waiting-for-opponent screen in VS_COMPUTER mode |
| `src/pages/Lobby/Lobby.test.tsx` | **New** — Vitest/RTL tests for VS_COMPUTER lobby fast-path |
| `src/pages/Game/Game.tsx` | Renders computer shot overlay; disables board during computer turn |
| `src/pages/GameOver/GameOver.tsx` | Displays correct winner label in single-player context |
| `playwright.config.ts` | Added `e2e` Spring profile env vars; backend baseURL set to port 8081 |
| `tests/e2e/smoke.spec.ts` | Updated to reflect mode-selection on Home page |
| `tests/e2e/vs-computer.spec.ts` | **New** — full Playwright E2E: ship placement → fire shots → game over |

---

## What Was NOT Changed

- `Dockerfile` and `docker-compose.yml` — unchanged; production image unaffected
- CI/CD configuration — no pipeline changes
- Existing multiplayer flow — all multiplayer paths remain identical
- Redis / PostgreSQL production dependencies — not introduced
- `GameRepository` interface and in-memory implementation — untouched

---

## Known Low-Severity Issues (from Code Review)

These are non-blocking findings logged in `reports/runs/20260623-153900-055d7ab/code-review-report.md`:

1. **Windows-only Maven path in `playwright.config.ts`** — `mvnw.cmd` hard-codes Windows; CI on Linux/Mac will fail. Mitigation: use `process.platform` to select `mvnw` vs `mvnw.cmd`, or use `npx cross-env`.
2. **Dead JPA config in `application-e2e.yml`** — `spring.jpa.*` keys are present but the project has no JPA dependency in the `e2e` profile; harmless but misleading.
3. **Exhaustive-deps lint warning in `Game.tsx`** — a `useEffect` dependency array omits a stable callback; no runtime bug but suppresses a useful ESLint hint.

---

## Quality Gate Results

| Gate | Result |
|------|--------|
| Backend unit tests (`./mvnw test`) | 26 tests, 0 failures |
| Frontend build (`npm run build`) | PASSED |
| Frontend unit tests (`npm run test`) | 32/32 passed |
| Playwright E2E (`npx playwright test`) | 18/18 passed |
| Security report | APPROVED |
| Code review report | APPROVED |

---

## How to Run

### Backend (production profile)
```bash
cd apps/backend
mvn spring-boot:run
# Listens on port 8080
# Requires PostgreSQL env vars: SPRING_DATASOURCE_URL, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD
```

### Backend (local dev / E2E profile — H2 in-memory, no DB needed)
```bash
cd apps/backend
mvn spring-boot:run -Pe2e -Dspring-boot.run.profiles=e2e
# Listens on port 8081
```

### Frontend
```bash
cd apps/frontend
npm run dev
# Listens on port 5173 (Vite default)
```

### E2E Tests (Playwright — auto-starts both servers)
```bash
cd apps/frontend
npx playwright test
```

---

## Commit

`acfddb4` — feat: add Play vs Computer mode (24 files changed, 1234 insertions, 32 deletions)
