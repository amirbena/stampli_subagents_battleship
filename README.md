# Gen4 Battleship

A multiplayer Battleship game built with a Gen4 multi-agent development workflow.
Requirements flow through an autonomous agent pipeline (planning → implementation → testing → review → PR) with no manual steps between intake and merge.

- **Frontend:** React + TypeScript + Vite
- **Backend:** Java 17 + Spring Boot 3
- **Tests:** JUnit 5 + Vitest + Playwright
- **Storage:** In-memory by default (PostgreSQL-ready via repository interface)

> Pipeline details: [ARCHITECTURE.md](ARCHITECTURE.md) · Agent policies: [CLAUDE.md](CLAUDE.md)

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
```bash
# Frontend — install dependencies (once after clone or package.json change)
cd apps/frontend && npm install && cd ../..

# Backend — resolve Maven dependencies
cd apps/backend && ./mvnw clean install && cd ../..

# Playwright browsers (for E2E tests)
cd apps/frontend && npx playwright install --with-deps && cd ../..
```

**Claude Code settings** — add the block below to your local Claude Code user settings (`~/.claude/settings.json`) before running `/requirement`.
Without it, agents pause for confirmation on every file read, shell command, and git operation.
Do **not** create this as a project file — it belongs in your local Claude installation only.

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": [
      "Read", "Glob", "Grep", "Edit", "Write", "Agent",
      "Skill(*)", "Skill(claude-api)", "Skill(claude-api:*)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "Bash(git status*)", "Bash(git log*)", "Bash(git diff*)",
      "Bash(git show*)", "Bash(git fetch*)", "Bash(git pull*)",
      "Bash(git push*)", "Bash(git add*)", "Bash(git commit*)",
      "Bash(git checkout*)", "Bash(git switch*)", "Bash(git branch*)",
      "Bash(git stash*)", "Bash(git rebase*)", "Bash(git merge*)",
      "Bash(git tag*)", "Bash(git rev-parse*)", "Bash(git config*)",
      "Bash(git remote*)", "Bash(git reset*)", "Bash(git restore*)",
      "Bash(git ls-files*)", "Bash(git grep*)", "Bash(git blame*)",
      "Bash(npm*)", "Bash(npx*)", "Bash(node*)",
      "Bash(./mvnw*)", "Bash(mvn*)",
      "Bash(ls*)", "Bash(cat*)", "Bash(echo*)", "Bash(pwd*)",
      "Bash(find*)", "Bash(grep*)", "Bash(xargs*)", "Bash(which*)",
      "Bash(jq*)", "Bash(test*)", "Bash(true)", "Bash(false)",
      "Bash(chmod*)", "Bash(mkdir*)", "Bash(curl*)",
      "Bash(gh pr*)", "Bash(gh --version*)", "Bash(gh auth*)",
      "Bash(gh repo*)", "Bash(gh issue*)", "Bash(gh api*)",
      "mcp__visualize__read_me", "mcp__visualize__show_widget"
    ],
    "ask": [
      "Bash(git push --force*)", "Bash(git push -f*)",
      "Bash(git reset --hard*)", "Bash(git branch -D*)",
      "Bash(git clean*)", "Bash(rm *)", "Bash(rm -r*)",
      "Bash(rm -f*)", "Bash(del *)"
    ]
  }
}
```

> Destructive operations (`git push --force`, `git reset --hard`, `rm`) stay in `ask` and always prompt.

**API key:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**GitHub CLI auth** (required for the release phase):
```bash
gh auth login
gh auth status   # must show: Logged in
```

---

## Backend Environment Setup

Copy the example file before running locally or via Docker Compose:

```bash
cp apps/backend/.env.example apps/backend/.env
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
```bash
lsof -i :8080        # macOS / Linux — identify the process holding 8080
# Windows:  netstat -ano | findstr :8080
```
Once `8080` is free (or it is the real battleship backend), re-run the script.

---

## Docker Compose (full stack)

```bash
cp apps/backend/.env.example apps/backend/.env   # first time only
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
```bash
cd apps/backend
./mvnw spring-boot:run
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
```bash
cd apps/backend && ./mvnw test
```

**Frontend unit + integration tests:**
```bash
cd apps/frontend
npm test              # one-shot
npm run test:watch    # watch mode
```

**Playwright E2E:**
```bash
cd apps/frontend
npm run test:e2e                                   # against dev server (auto-starts)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e  # against docker-compose
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
| `mvnw: Permission denied` | `chmod +x apps/backend/mvnw` |
| `no main manifest attribute` in `maven-wrapper.jar` | Run `mvn wrapper:wrapper -Dmaven=3.9.6` inside `apps/backend/` to regenerate the wrapper |
| `./run` says "Existing battleship backend detected" | Expected — a backend is already running on `8080` (Docker Compose or a prior `./run`); the script reuses it instead of starting a duplicate. Nothing to fix. |
| `./run` fails: port 8080 in use but no battleship backend responded | A non-backend process holds `8080`. `lsof -i :8080` (Windows: `netstat -ano \| findstr :8080`), stop it, then re-run. The backend never falls back to another port. |
| Backend won't start — port 8080 in use | `lsof -i :8080` then kill the process |
| Frontend won't start — port 3001 in use | `lsof -i :3001` then kill the process |
| Docker containers unhealthy | `docker compose logs postgres` — check DB creds in `.env` |
| Agents pause on every tool call | Create `.claude/settings.json` with the `permissions` block (see [CLAUDE.md](CLAUDE.md)) |
| `gh` not authenticated | `gh auth login` then `gh auth status` |
| Playwright browsers missing | `cd apps/frontend && npx playwright install --with-deps` |

---

## Reports

Pipeline artifacts write to `reports/` (gitignored — never committed). Each run produces `reports/runs/<id>/` with product spec, architecture, security report, code review, and release summary.
