# Gen4 Battleship

A multiplayer Battleship game built using a Gen4 multi-agent development workflow.

The purpose of this project is not only to deliver a working game, but to demonstrate how a multi-agent software factory converts requirements into production-like software through planning, architecture, implementation, testing, security review, code review, and PR creation.

## Prerequisites

Everything below must be installed and verified before running `/requirement`. The pipeline will fail silently if any of these are missing.

### Runtime tools

| Tool | Min version | Verify | Install |
|------|-------------|--------|---------|
| Java | 17 | `java -version` | [adoptium.net](https://adoptium.net) |
| Maven wrapper | — | `./mvnw -version` (in `apps/backend/`) | bundled — no install needed |
| Node.js | 18 (20 or 22 recommended for E2E) | `node -v` | [nodejs.org](https://nodejs.org) |
| npm | 9 | `npm -v` | bundled with Node.js |
| Docker | 20 | `docker -v` | [docker.com](https://docker.com) — optional, only needed for `docker compose up` |

### Claude Code agents

| Tool | Purpose | Verify | Install |
|------|---------|--------|---------|
| Claude Code CLI | Runs all skills and agents | `claude -v` | `npm install -g @anthropic-ai/claude-code` |
| Anthropic API key | Powers every agent | `echo $ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

Set your key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### GitHub CLI (required for the release phase)

```bash
# Verify
gh --version

# Install (Windows)
winget install --id GitHub.cli

# Install (macOS)
brew install gh

# Install (Linux)
sudo apt install gh

# Authenticate
gh auth login
gh auth status   # must show: Logged in
```

The release-pr-agent will not run if `gh auth status` fails.

### Playwright browsers (required for E2E tests)

```bash
cd apps/frontend
npx playwright install --with-deps
```

### Quick preflight check

Run this before starting the factory to confirm everything is in place:

```bash
java -version && \
node -v && \
npm -v && \
gh auth status && \
claude -v && \
echo "All checks passed"
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend | Java 17 + Spring Boot 3 |
| Unit Tests | JUnit 5 + Mockito (backend) · Vitest + React Testing Library (frontend) |
| E2E Tests | Playwright |
| Storage | In-memory (Redis-ready via repository interface) |
| Release | GitHub CLI (`gh`) |

## How To Run

There are two valid, interchangeable ways to run the full app locally:

- **Fast local run — scripts** (recommended for development): Postgres + Redis run as containers; the backend and frontend run **natively** with live reload. No heavy image rebuild, so the dev inner loop is much faster than `docker compose up --build` (~1.5 min).
- **Docker Compose**: the full stack (frontend, backend, Postgres, Redis) runs as containers. Closest to the deployed shape.

Pick whichever you prefer — both are supported and documented below.

---

### Fast local run — scripts (recommended for dev)

One command per OS brings up **only** Postgres + Redis as containers, then runs the Spring Boot backend and the Vite frontend **natively** in real time. App images are **not** built.

```bash
# macOS / Linux
./.run/run.sh

# Windows (PowerShell)
.\.run\run.ps1

# Windows (cmd / double-click) — shim that calls run.ps1
.run\run.cmd
```

**What the script does:**
1. **Preflight** — verifies Docker is installed *and the daemon is reachable*, Java 17+, and Node 18+ / npm. On any missing prerequisite it prints a clear message naming the tool and exits non-zero before starting anything.
2. Starts **only** the `postgres` and `redis` containers (`docker compose --env-file apps/backend/.env up -d postgres redis`) and waits until both report **healthy**.
3. Runs the backend natively via the Maven wrapper (`./mvnw spring-boot:run`) with the `postgres` Spring profile, its datasource pointed at `localhost:5432`, Redis at `localhost:6379`, and `CORS_ALLOWED_ORIGIN=http://localhost:3001`. DB creds are read from `apps/backend/.env` (falling back to the demo defaults `battleship` / `battleship` / `battleship_dev`). Game state is held in-memory (`InMemoryGameRepository` is the only repository implementation, active under every profile); the `postgres` profile simply provides the Postgres/Redis connections the backend requires at startup.
4. **Waits for the backend to be ready** — polls port 8080 every 3 s (up to 120 s) before starting the frontend. Spring Boot typically takes ~30 s on first run; polling avoids a hard-coded sleep and ensures the frontend never starts against an unresponsive API.
5. Runs the frontend natively via `npm run dev` (Vite HMR) on port 3001 with `VITE_API_BASE_URL=http://localhost:8080`. Runs `npm install` first only if `node_modules` is missing.
6. **Streams logs** from both processes to the terminal in real time (the bash script prefixes them `[backend]` / `[frontend]`).

| Service | URL |
|---------|-----|
| Frontend (Vite dev) | http://localhost:3001 |
| Backend API | http://localhost:8080/api/v1 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

**Preflight requirements:** Docker (daemon running), Java 17+, Node 18+ and npm. The fast path still needs Docker — it runs Postgres + Redis as containers.

**How to stop:** press **Ctrl+C**. The script cleanly terminates the native backend and frontend (no orphaned processes on 8080 / 3001). The **Postgres + Redis containers are left running** for a faster next boot — stop them when you're done with:

```bash
docker compose --env-file apps/backend/.env down
```

> First-time setup: if `apps/backend/.env` does not exist, copy it first
> (`cp apps/backend/.env.example apps/backend/.env`). The script falls back to demo
> defaults if it's missing, but creating it keeps both run paths consistent.

---

### Docker (full stack)

One command starts the full stack — frontend, backend, PostgreSQL, and Redis.

**First time setup:**
```bash
cp apps/backend/.env.example apps/backend/.env
```

**Foreground** (logs stream to terminal):
```bash
docker compose --env-file apps/backend/.env up --build
```

**Background** (returns to prompt immediately):
```bash
docker compose --env-file apps/backend/.env up --build -d
```

| Service | URL |
|---------|-----|
| Frontend (docker) | http://localhost:3000 |
| Frontend (dev server) | http://localhost:3001 |
| Backend API | http://localhost:8080/api/v1 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

View logs when running in background:
```bash
docker compose logs -f
docker compose logs -f backend   # backend only
```

Stop everything:
```bash
docker compose --env-file apps/backend/.env down
```

Stop and wipe all data volumes:
```bash
docker compose --env-file apps/backend/.env down -v
```

Rebuild a single service after a code change:
```bash
docker compose --env-file apps/backend/.env up --build backend -d
docker compose --env-file apps/backend/.env up --build frontend -d
```

> The backend starts with `SPRING_PROFILES_ACTIVE=default` (in-memory storage).
> PostgreSQL and Redis are running and wired — switch profiles in `apps/backend/.env` to activate them.

**Backend only** (from `apps/backend/`, foreground or background):
```bash
cd apps/backend
docker compose up --build          # foreground
docker compose up --build -d       # background
```

---

### Without Docker

**Backend**
```bash
cd apps/backend
./mvnw spring-boot:run
# API available at http://localhost:8080/api/v1
```

**Frontend**
```bash
cd apps/frontend
npm install
npm run dev
# UI available at http://localhost:3001
```

> Port 3001 is intentional — docker-compose uses 3000 for the built frontend image so the dev server gets its own port.

**Backend unit tests**
```bash
cd apps/backend
./mvnw test
```

**Frontend unit + integration tests** (Vitest + React Testing Library — no server needed)
```bash
cd apps/frontend
npm test          # one-shot — includes *.integration.test.tsx
npm run test:watch  # interactive watch mode
```

**Playwright E2E tests**
```bash
cd apps/frontend

# Against dev server (auto-starts npm run dev on port 3001):
npm run test:e2e

# Against docker-compose (must be running on port 3000):
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## Using the Factory

### Start here — describe what you want to build

```
/requirement
```

The skill captures your requirement and hands off autonomously. If you attach screenshots or files, it reads them first and writes a `## Visual Analysis` section into `requirements.md` — concrete defects, expected behavior, and inferred acceptance criteria derived from visual evidence. This feeds every downstream agent and enables the fast-path to skip Product Agent for pure visual fixes.

You can also pass your idea inline:

```
/requirement A multiplayer Battleship game where two players take turns firing at each other's hidden fleet
```

### What happens after you confirm

```
Phase 0.5 fast-path check            Team Lead reads requirements.md first.
                                      Skips Product Agent when change is:
                                      (1) pure infra, (2) pure internal refactor,
                                      (3) bug fix restoring documented behavior, OR
                                      (4) visual fix — Visual Analysis present in
                                      requirements.md with concrete defects + expected
                                      behavior + inferred criteria, UI-only, no UX
                                      ambiguity, no backend/API/schema change.
                                      Writes inline acceptance checklist and continues.

Phase 1   product-agent (conditional) → reports/runs/<id>/product-spec.md
                                        SKIPPED on fast-path (~1.5 min saved)

Phase 2   architect-agent             → reports/runs/<id>/architecture.md  (only if contract changed)

Phase 3   ── selected agents may run in parallel when safe ─────────────────────────┐
          java-backend-agent    → apps/backend/src/main/java/                        │
          frontend-ui-agent     → apps/frontend/src/components/, pages/, utils/, CSS │ Team Lead
          frontend-api-agent    → apps/frontend/src/api/, hooks/, types/             │ decides scope
          ─────────────────────────────────────────────────────────────────────────────┘
          frontend-ui-agent is the default frontend path.
          frontend-api-agent is optional: alone for API/hook/type-only changes,
          or alongside ui-agent only when workstreams are clearly independent.
          Team Lead pre-writes types/game.ts before spawning both frontend agents.

Phase 4a — UNIT + INTEGRATION TESTS (parallel, cheapest first)
          java-backend-agent          → ./mvnw test                        (if backend touched)

          Single-agent frontend path (default):
          frontend-ui-agent           → npm run test + npm run build       (agent owns full gate)
                                        agent selects its own tests: unit for isolated DOM/
                                        state/class issues; integration for seam/timing/
                                        wiring/async-ordering risks; Playwright smoke for
                                        real-browser layout confidence.
                                        *.integration.test.tsx written BEFORE the fix when
                                        per-layer unit tests pass but runtime behavior fails.

          Split frontend path (both agents ran in parallel):
          frontend-ui-agent           → npx vitest run src/components …    (co-located slice)
          frontend-api-agent          → npx vitest run src/api src/hooks …  (co-located slice)
          Team Lead waits for BOTH    → npm run test + npm run build        (cross-agent contract check)
                                        neither agent knows the other finished — Team Lead
                                        is the synchronization point (fan-out / fan-in).
                                        npm run build catches silent consumer breaks:
                                        hook shape changed in api-agent, component broke
                                        in ui-agent without either slice test failing.

          ── gate: all green → next relevant phase (scope routing below) ──

Phase 4b — INTEGRATION TESTS (after unit gate, if HTTP layer changed)
          backend-integration-tests   → ./mvnw test *IntegrationTest
          ── gate: must be green before E2E starts ──

Phase 5   playwright-e2e-agent        → apps/frontend/tests/e2e/
          • Full mode  — all specs + live backend (when API contract changed)
          • Smoke mode — smoke.spec.ts only, no backend (user-visible frontend change, no contract change)
          • None       — skipped (backend-only change)

Phase 6   security-agent  ──┐         → reports/runs/<id>/security-report.md    (parallel)
          code-review-agent ┘         → reports/runs/<id>/code-review-report.md
          ── Team Lead drafts release-summary.md in parallel with Phase 6 ──

Phase 7   release-pr-agent            → finalizes release-summary.md + GitHub PR
```

Selected Phase 3 agents run in parallel when workstreams are independent — Team Lead decides. Phase 4 tests run in parallel and gate Phase 5 (frontend-only changes skip Phase 4b).
On the split frontend path, Team Lead is the synchronization point: it waits for both agents to report done, then runs the full gate as the cross-agent contract check before advancing.
If E2E fails, Team Lead routes by data flow (not visible symptom) and always runs npm run build after any frontend-api-agent fix before re-triggering E2E.
Security and code review (Phase 6) run in parallel after all tests pass.
Team Lead writes the release summary draft while Phase 6 runs — release agent only finalizes and creates the PR.
The pipeline stops only when the PR URL is printed.

### Agent definitions

Each agent is a skill in [`.claude/skills/`](.claude/skills/) with a `model:` field controlling which provider runs it.

| Agent | Model | Role |
|-------|-------|------|
| team-lead | claude-opus-4-8 | Orchestrates all phases |
| product-agent | claude-sonnet-4-6 | User stories + acceptance criteria |
| architect-agent | claude-opus-4-8 | API contract + domain model |
| java-backend-agent | claude-sonnet-4-6 | Game logic + REST API + JUnit unit tests |
| frontend-api-agent | claude-sonnet-4-6 | API wrappers, hooks, TypeScript types + Vitest unit tests |
| frontend-ui-agent | claude-sonnet-4-6 | React components, pages, CSS (mobile-first) + Vitest component tests |
| backend-integration-tests-agent | claude-sonnet-4-6 | @SpringBootTest HTTP layer tests |
| playwright-e2e-agent | claude-sonnet-4-6 | Browser E2E tests |
| security-agent | claude-opus-4-8 | Security + integrity review |
| code-review-agent | claude-opus-4-8 | Engineering review |
| infrastructure-agent | claude-sonnet-4-6 | Docker + env setup + cross-platform startup scripts |
| release-pr-agent | claude-haiku-4-5-20251001 | PR creation |

To swap an agent to a different model or provider, edit the `model:` line in its `SKILL.md`.

## Scalability Notes

- **Storage**: `GameRepository` is an interface. Swapping to Redis requires only adding `RedisGameRepository` — no domain code changes.
- **Real-time**: Frontend currently polls the backend. WebSocket can replace polling by changing only `useGameState.ts` and adding `GameWebSocketHandler.java`.
- **New features**: Adding chat, spectators, or leaderboard maps to new services/controllers without touching `Game.java`.

## Agent Definitions
See [`.claude/skills/`](.claude/skills/) for all agent skill files.

## Reports
All pipeline artifacts live in [`reports/`](reports/) — gitignored so they never end up in a PR.

| File | Written by |
|------|-----------|
| `reports/runs/<id>/requirements.md` | `/requirement` skill (you) |
| `reports/runs/<id>/product-spec.md` | product-agent |
| `reports/runs/<id>/architecture.md` | architect-agent |
| `reports/runs/<id>/security-report.md` | security-agent |
| `reports/runs/<id>/code-review-report.md` | code-review-agent |
| `reports/runs/<id>/release-summary.md` | release-pr-agent |
