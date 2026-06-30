# Gen4 Battleship

A multiplayer Battleship game built with a Gen4 multi-agent development workflow.
Requirements flow through an autonomous agent pipeline (planning → implementation → testing → review → PR) with no manual steps between intake and merge.

- **Frontend:** React + TypeScript + Vite
- **Backend:** Java 17 + Spring Boot 3
- **Tests:** JUnit 5 + Vitest + Playwright
- **Storage:** In-memory game state (PostgreSQL-ready via repository interface; Postgres + Redis run as dev containers to satisfy Spring Boot startup)

> Pipeline details: [ARCHITECTURE.md](ARCHITECTURE.md) · Agent policies: [CLAUDE.md](CLAUDE.md)

---

## Game Features

| Feature | Description |
|---------|-------------|
| **Play vs Computer** | Single-player mode. Place your fleet, confirm ready, and fire. The computer responds automatically after each of your shots. |
| **Play vs Human** | Create a game, share the game code, and have the second player join from a separate browser session. Each player sees only their own board and the opponent's hit/miss result — ship positions are never exposed. |
| **Restore by code** | Navigating away or refreshing does not end your game. Re-enter your game code to restore your session. Only the original seat owner (verified by per-seat session token) can restore. |
| **Back / Stay / Leave** | Closing or navigating away triggers a confirmation dialog. "Stay" keeps the game running. "Leave" clears your local session pointer but leaves the game active on the server — rejoinable via the code. |
| **Session identity** | Each seat is assigned a cryptographic session token on creation (create or join). The token is stored locally and never re-disclosed by the server. All board actions require proof of seat ownership. |
| **Pause / Resume** | Any seat owner can pause an in-progress game and resume it later. The game state is preserved server-side. |

> **Known limitations:** HTTP polling (1-second interval) is used for state synchronization. A WebSocket push model is a planned future improvement that requires no backend domain changes — see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Prerequisites

| Tool | Min version | Check |
|------|-------------|-------|
| Java | 17 | `java -version` |
| Node.js | 18 | `node -v` |
| npm | 9 | `npm -v` |
| Docker | 20 | `docker -v` (optional — only for `docker compose`) |
| Claude Code CLI | — | `claude -v` |
| GitHub CLI | — | `gh --version` |

**First-time setup:**

macOS / Linux:
```bash
# Frontend — install dependencies (once after clone or package.json change)
cd apps/frontend && npm install && cd ../..

# Backend — resolve Maven dependencies
cd apps/backend && ./mvnw clean install && cd ../..

# Playwright browsers (for E2E tests)
cd apps/frontend && npx playwright install --with-deps && cd ../..
```

Windows (PowerShell):
```powershell
# Frontend
cd apps/frontend; npm install; cd ../..

# Backend
cd apps/backend; .\mvnw.cmd clean install; cd ../..

# Playwright browsers
cd apps/frontend; npx playwright install --with-deps; cd ../..
```

**Claude Code local setup** — the agent pipeline requires two local configuration steps before running `/requirement`.

**1. Enable agent teams** (set before each session):

macOS / Linux — add to your shell profile or export before each session:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Windows (PowerShell):
```powershell
$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
```

**2. Create `.claude/settings.local.json`** in the project root.
This file is machine-local (gitignored by Claude Code's global ignore) — each developer creates it once. The shared project file `.claude/settings.json` is not modified.

Permissions to configure locally:

| Category | Allowed without prompt |
|----------|------------------------|
| Repo inspection | `git status`, `git diff`, `git log`, `git show` |
| Branch & sync | `git fetch`, `git pull`, `git checkout`, `git switch`, `git branch`, `git stash`, feature/governance branch creation |
| Safe rebase | `git rebase origin/main`, `git pull --rebase origin main` only — interactive or `--onto` rebases are denied |
| Commits & pushes | `git add`, `git commit`, `git push` on feature/governance branches |
| Report writing | Read/Write/Edit under `reports/` |
| Frontend verification | `npm run test`, `npm run build`, `npx playwright test`, `npx playwright show-report` |
| Backend verification | `./mvnw test`, `./mvnw spring-boot:run` |
| GitHub PR workflow | `gh pr create`, `gh pr edit`, `gh pr view`, `gh pr list`, `gh auth status` |
| Dev process cleanup | `pkill -f` for Vite, npm dev server, Spring Boot (this repo only), and Playwright test servers |

Commands that remain **ask-gated** (always prompt):

- `git reset` (non-hard)
- `git config` (non-global)
- `rm`, `rm -r`, `rm -f`, `del`

Commands that are **denied** (blocked outright):

- `git reset --hard`, `git clean`
- `git merge` — use rebase onto `origin/main` instead
- `git push --force` / `git push -f`
- `git branch -D` / `git branch -d`
- `git rebase -i`, `git rebase --onto`, `git rebase --abort`
- `git remote set-url/add/remove`, `git config --global`
- `rm -rf`, `rm -rf .git`
- `pkill` / `killall` (general — only narrow `pkill -f` for this repo's dev processes is allowed)
- `sudo`, global Claude / system config changes

> `.claude/settings.json` is the shared project settings file — do not add broad local permissions there.

**API key:**

macOS / Linux:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Windows (PowerShell):
```powershell
$env:ANTHROPIC_API_KEY = 'sk-ant-...'
```

**GitHub CLI auth** (required for the release phase):
```bash
gh auth login
gh auth status   # must show: Logged in
```

---

## Backend Environment Setup

Copy the example file before running locally or via Docker Compose:

macOS / Linux:
```bash
cp apps/backend/.env.example apps/backend/.env
```

Windows:
```powershell
copy apps\backend\.env.example apps\backend\.env
```

`apps/backend/.env` is gitignored and must never be committed. Contents of `.env.example`:

```env
# Backend — PostgreSQL credentials
# Copy this file to .env and fill in real values before running docker compose.
# Never commit .env to version control.
#
# NOTE: We know this is unsecured locally.
# In real production the pipeline (CI/CD) injects the .env / properties.yaml
# from a secret manager (e.g. Vault, AWS Secrets Manager, GitHub Actions secrets)
# and writes it into the container at deploy time — credentials never touch the repo.

POSTGRES_DB=battleship
POSTGRES_USER=battleship
POSTGRES_PASSWORD=battleship_dev

# Spring profile — controls which repository implementation the backend uses
# Options: default (in-memory, no DB needed), postgres, redis
SPRING_PROFILES_ACTIVE=default
```

> `SPRING_PROFILES_ACTIVE=default` uses in-memory storage — no database needed for local dev.

---

## Quick Start

**macOS / Linux** — runs Postgres + Redis as containers, backend and frontend natively:
```bash
chmod +x ./.run/run.sh
./.run/run.sh
```

**Windows (PowerShell):**
```powershell
.\.run\run.ps1
```

**Windows (cmd):**
```cmd
.run\run.cmd
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:8080/api/v1 |

Stop with **Ctrl+C**. The script prompts whether to also stop the Postgres/Redis containers.

### Ports: backend is fixed, frontend can fall back

The run scripts treat the two ports differently:

- **Backend — fixed on `8080`, never a fallback.** Before starting the backend, the script checks whether `8080` is already in use:
  - **Free** → it starts the backend natively, as usual.
  - **In use by the battleship backend** → it **reuses** the existing backend and does **not** start a second one (prints `Existing battleship backend detected on :8080 — reusing it`). This is what lets you run Docker Compose and `./run` together, or run `./run` twice, without a port-conflict crash.
  - **In use by something else** → it **fails early** with a clear error and does **not** start the backend on another port.
- **Frontend — may fall back.** If `3001` is taken, Vite automatically picks the next free port (e.g. `3002`). This is expected and fine.

**Health-check based detection (not just "is the port open?").** A listening socket alone is not trusted. The script calls the backend health endpoint `GET http://localhost:8080/api/v1/health` and only reuses the process when it returns HTTP `200` with the identity token `battleship-backend` in the body. Anything else on `8080` is treated as a conflict.

**If port 8080 is occupied by a non-backend process:** the script stops with an error rather than guessing. Find and stop the process, then re-run:

macOS / Linux:
```bash
lsof -i :8080        # identify the process holding 8080
```

Windows:
```cmd
netstat -ano | findstr :8080
taskkill /PID <pid> /F
```
Once `8080` is free (or it is the real battleship backend), re-run the script.

---

## Docker Compose (full stack)

macOS / Linux:
```bash
cp apps/backend/.env.example apps/backend/.env   # first time only
docker compose --env-file apps/backend/.env up --build
```

Windows:
```powershell
copy apps\backend\.env.example apps\backend\.env   # first time only
docker compose --env-file apps/backend/.env up --build
```

| Service | URL |
|---------|-----|
| Frontend (built image) | http://localhost:3000 |
| Frontend (dev server) | http://localhost:3001 |
| Backend API | http://localhost:8080/api/v1 |

```bash
# Background
docker compose --env-file apps/backend/.env up --build -d

# Logs
docker compose logs -f

# Stop
docker compose --env-file apps/backend/.env down

# Stop and wipe data volumes
docker compose --env-file apps/backend/.env down -v
```

---

## Run Without Docker

**Backend:**

macOS / Linux:
```bash
cd apps/backend
./mvnw spring-boot:run
# http://localhost:8080/api/v1
```

Windows:
```powershell
cd apps\backend
.\mvnw.cmd spring-boot:run
# http://localhost:8080/api/v1
```

**Frontend:**
```bash
cd apps/frontend
npm run dev
# http://localhost:3001
```

---

## Testing

**Backend unit tests:**

macOS / Linux:
```bash
cd apps/backend && ./mvnw test
```

Windows:
```powershell
cd apps\backend; .\mvnw.cmd test
```

**Frontend unit + integration tests:**
```bash
cd apps/frontend
npm test              # one-shot
npm run test:watch    # watch mode
```

**Playwright E2E:**

macOS / Linux:
```bash
cd apps/frontend
npm run test:e2e                                   # against dev server (auto-starts)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e  # against docker-compose
```

Windows (PowerShell):
```powershell
cd apps\frontend
npm run test:e2e                                        # against dev server (auto-starts)
$env:E2E_BASE_URL='http://localhost:3000'; npm run test:e2e  # against docker-compose
```

---

## Using the Factory

Describe what you want to build:
```
/requirement A multiplayer Battleship game where two players take turns firing at each other's hidden fleet
```

The pipeline runs autonomously: requirement intake → product spec → architecture → implementation → tests → security + code review → PR. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full phase breakdown and agent roles.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `mvnw: Permission denied` (macOS / Linux) | `chmod +x apps/backend/mvnw` |
| On Windows, use `mvnw.cmd` not `./mvnw` | Replace `./mvnw` with `.\mvnw.cmd` in all commands |
| `no main manifest attribute` in `maven-wrapper.jar` | Run `mvn wrapper:wrapper -Dmaven=3.9.6` inside `apps/backend/` to regenerate the wrapper |
| `./run` / `.\.run\run.ps1` says "Existing battleship backend detected" | Expected — a backend is already running on `8080` (Docker Compose or a prior run); the script reuses it. Nothing to fix. |
| Run script fails: port 8080 in use but no battleship backend responded | A non-backend process holds `8080`. macOS/Linux: `lsof -i :8080`. Windows: `netstat -ano \| findstr :8080`. Stop the process, then re-run. The backend never falls back to another port. |
| Backend won't start — port 8080 in use | macOS/Linux: `lsof -i :8080` then kill. Windows: `netstat -ano \| findstr :8080` then `taskkill /PID <pid> /F` |
| Frontend won't start — port 3001 in use | macOS/Linux: `lsof -i :3001`. Windows: `netstat -ano \| findstr :3001` |
| Docker containers unhealthy | `docker compose logs postgres` — check DB creds in `.env` |
| Agents pause on every tool call | Create `.claude/settings.local.json` locally (it is gitignored per Claude Code's global ignore — see Claude Code local setup above) |
| `gh` not authenticated | `gh auth login` then `gh auth status` |
| Playwright browsers missing | macOS/Linux: `cd apps/frontend && npx playwright install --with-deps`. Windows: `cd apps\frontend; npx playwright install --with-deps` |
| PowerShell execution policy blocks `.ps1` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or invoke with `powershell -ExecutionPolicy Bypass -File .\.run\run.ps1` |

---

## Governance Structure

Agent policies, metadata, templates, and runbooks live under `.claude/` organized by ownership:

| Location | Contents |
|---|---|
| `.claude/policies/` | Global policies (all agents) |
| `.claude/policies/java/` | Java backend family policies |
| `.claude/policies/frontend/` | Frontend family policies |
| `.claude/policies/e2e/` | E2E execution policies |
| `.claude/skills/team-lead/policies/` | Team Lead routing policies |
| `.claude/metadata/team-lead/` | Team Lead execution config |
| `.claude/metadata/review/` | Review lifecycle schema |
| `.claude/templates/team-lead/` | Team Lead internal templates |
| `.claude/templates/review/` | Review finding templates |
| `.claude/templates/architecture/` | Architecture phase templates |
| `.claude/skills/<agent>/templates/` | Agent-local templates |
| `.claude/runbooks/team-lead/` | Team Lead operational runbooks |

Place new governance files at the narrowest correct ownership scope.
See `.claude/policies/README.md` for the full policy index.

## Reports

Pipeline artifacts write to `reports/` (gitignored — never committed). Each run produces `reports/runs/<id>/` with product spec, architecture, security report, code review, and release summary.
