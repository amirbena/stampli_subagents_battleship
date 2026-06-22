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
| Node.js | 18 | `node -v` | [nodejs.org](https://nodejs.org) |
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
| Unit Tests | JUnit 5 + Mockito |
| E2E Tests | Playwright |
| Storage | In-memory (Redis-ready via repository interface) |
| Release | GitHub MCP or GitHub CLI fallback |

## How To Run

### Docker (recommended)

One command starts the full stack — frontend, backend, PostgreSQL, and Redis.

```bash
cp apps/backend/.env.example apps/backend/.env
# Fill in POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD in apps/backend/.env
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8080/api/v1 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

Stop everything:
```bash
docker compose down
```

Stop and wipe all data volumes:
```bash
docker compose down -v
```

Rebuild a single service after a code change:
```bash
docker compose up --build backend
docker compose up --build frontend
```

> The backend starts with `SPRING_PROFILES_ACTIVE=default` (in-memory storage).
> PostgreSQL and Redis are running and wired — switch profiles in `.env` to activate them.

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
# UI available at http://localhost:5173
```

**Backend unit tests**
```bash
cd apps/backend
./mvnw test
```

**Playwright E2E tests** (requires both services running)
```bash
cd apps/frontend
npm run test:e2e
```

## Using the Factory

### Start here — describe what you want to build

```
/requirement
```

The skill will ask what you want to build, clarify any gaps with up to 4 questions, write `reports/requirements.md`, show it to you for confirmation, then automatically launch the full pipeline. No further input needed.

You can also pass your idea inline:

```
/requirement A multiplayer Battleship game where two players take turns firing at each other's hidden fleet
```

### What happens after you confirm

```
Phase 1   product-agent           → reports/product-spec.md
Phase 2   architect-agent         → reports/architecture.md
Phase 3   java-backend-agent      → apps/backend/src/main/java/
Phase 4   frontend-agent          → apps/frontend/src/              (mobile-first)
Phase 5   backend-unit-tests      → apps/backend/src/test/
Phase 6   playwright-e2e-agent    → apps/frontend/tests/e2e/
Phase 7   security-agent          → reports/security-report.md
Phase 8   code-review-agent       → reports/code-review-report.md
Phase 9   infrastructure-agent    → docker-compose.yml + README.md
Phase 10  release-pr-agent        → GitHub PR
```

Phases 3 + 4 run in parallel. Phases 5 + 6 run in parallel after those complete.
Security and code review auto-retry if they return REQUIRES CHANGES.
The pipeline stops only when the PR URL is printed.

### Agent definitions

Each agent is a skill in [`.claude/skills/`](.claude/skills/) with a `model:` field controlling which provider runs it.

| Agent | Model | Role |
|-------|-------|------|
| team-lead | claude-opus-4-8 | Orchestrates all phases |
| product-agent | claude-sonnet-4-6 | User stories + acceptance criteria |
| architect-agent | claude-opus-4-8 | API contract + domain model |
| java-backend-agent | claude-sonnet-4-6 | Game logic + REST API |
| frontend-agent | claude-sonnet-4-6 | React UI (mobile-first) |
| backend-unit-tests-agent | claude-sonnet-4-6 | JUnit domain tests |
| playwright-e2e-agent | claude-sonnet-4-6 | Browser E2E tests |
| security-agent | claude-opus-4-8 | Security + integrity review |
| code-review-agent | claude-opus-4-8 | Engineering review |
| infrastructure-agent | claude-haiku-4-5-20251001 | Docker + env setup |
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
| `reports/requirements.md` | `/requirement` skill (you) |
| `reports/product-spec.md` | product-agent |
| `reports/architecture.md` | architect-agent |
| `reports/security-report.md` | security-agent |
| `reports/code-review-report.md` | code-review-agent |
| `reports/final-pr-summary.md` | release-pr-agent |
