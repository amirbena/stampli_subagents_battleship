# Claude Project Instructions

You are working inside a Gen4 multi-agent software factory building a multiplayer Battleship game.

## Core Principles
- Start from requirements. Convert them into acceptance criteria before writing any code.
- The Java backend is the source of truth for all game rules and game state.
- The frontend focuses on user experience only — it never decides game rules.
- Never expose opponent hidden ship positions to any client.
- Prefer simple, testable code. Do not introduce abstractions until they are needed.
- Do not introduce Redis unless a concrete scalability requirement justifies it.
- Every feature must be covered by backend unit tests or Playwright E2E tests.
- A PR can only be opened after all quality gates pass.

## Scalability Architecture
- `GameRepository` is always an interface. Services depend on the interface, never the implementation.
- Domain classes (`Game`, `Board`, `Ship`) have no Spring annotations — they are pure Java.
- New features map to new services and controllers, not changes to existing domain classes.
- The WebSocket transport layer can replace HTTP polling without any domain or service changes.

## Agent Skills

Each agent is defined as a skill in `.claude/skills/<agent-name>/SKILL.md`.
The `model:` frontmatter field controls which provider runs that agent.
To extend an agent, edit its `SKILL.md` — do not create parallel files.

| Agent | Skill folder | Model | Owns |
|-------|-------------|-------|------|
| Team Lead | `.claude/skills/team-lead` | claude-opus-4-8 | Planning, task assignment, quality gates, E2E infrastructure pre-gate, final release decision |
| Product Agent | `.claude/skills/product-agent` | claude-sonnet-4-6 | `reports/runs/<id>/product-spec.md`, user stories, acceptance criteria |
| Architect Agent | `.claude/skills/architect-agent` | claude-opus-4-8 | `reports/runs/<id>/architecture.md`, API contract, domain model — structure only, not environment setup |
| Java Backend Agent | `.claude/skills/java-backend-agent` | claude-sonnet-4-6 | `apps/backend/src/main/java/` — all production backend code |
| Frontend Agent | `.claude/skills/frontend-agent` | claude-sonnet-4-6 | `apps/frontend/src/` — all React/TypeScript UI code |
| Backend Unit Tests Agent | `.claude/skills/backend-unit-tests-agent` | claude-sonnet-4-6 | `apps/backend/src/test/` — all Java unit tests |
| Playwright E2E Agent | `.claude/skills/playwright-e2e-agent` | claude-sonnet-4-6 | `apps/frontend/tests/e2e/` — all browser tests; never assumes servers are running |
| Security Agent | `.claude/skills/security-agent` | claude-opus-4-8 | `reports/runs/<id>/security-report.md` |
| Code Review Agent | `.claude/skills/code-review-agent` | claude-opus-4-8 | `reports/runs/<id>/code-review-report.md` |
| Infrastructure Agent | `.claude/skills/infrastructure-agent` | claude-haiku-4-5-20251001 | `docker-compose.yml`, env documentation, run instructions |
| Release PR Agent | `.claude/skills/release-pr-agent` | claude-haiku-4-5-20251001 | `reports/runs/<id>/release-summary.md`, PR creation |

## E2E Decision Rule

There are two E2E modes. Team Lead picks the correct one based on what changed.

### Full E2E (frontend + live backend on port 8081)
Run ONLY when the **API contract changed**:
- New REST endpoint added
- Existing endpoint request/response shape changed (new fields, renamed fields, status codes)
- New game mode, state machine transition, or multiplayer flow that requires backend coordination

Before spawning the Playwright agent in Full E2E mode, Team Lead must pass the **E2E Infrastructure Pre-Gate**:
1. `apps/backend/src/main/resources/application-e2e.yml` exists (port 8081, H2, correct CORS)
2. Maven `e2e` profile with `useTestClasspath=true` exists in `pom.xml`
3. `playwright.config.ts` has a dual `webServer` array (frontend + backend)
4. Frontend `webServer` entry sets `env: { VITE_API_BASE_URL: 'http://localhost:8081' }`

If any check fails, route to the owning agent to fix it before E2E runs.

### Smoke E2E (frontend only — no backend)
Run when frontend pages or flows are added/changed but **no contract change**:
- New UI pages, components, or navigation flows
- Copy, styling, or layout changes
- Frontend validation, error states, or client-side logic

Smoke E2E runs `smoke.spec.ts` only. No backend webServer entry required.

### No E2E
- Backend-only changes with zero frontend impact

## Git Branch Handling Policy
The full policy lives in `.claude/skills/team-lead/SKILL.md` (Step 5). Key rules:
- Team Lead owns all branch decisions (Cases A–I) before any implementation agent is spawned.
- Implementation agents (frontend, backend) only confirm they are on the branch Team Lead assigned — they never run branch operations themselves.
- Never implement directly on `main`. Dirty `main` is always a hard stop.
- New branches are verified free on local and remote before creation (multi-team safety guard).
- Feature branches always sync via `git fetch origin && git rebase origin/main`, never `git pull origin main`.

## File Ownership Rule
Agents must not edit files outside their ownership domain without explicit Team Lead approval.

## Agent Proliferation Rule

Do not add a new agent unless **both** conditions are true:
1. The responsibility is clearly separate from what existing agents already own.
2. The test type or task requires a different execution context (e.g. different runtime, different Spring profile, different tool chain).

Current decisions locked in:
- **No separate Frontend Unit Tests Agent.** Frontend unit tests (Vitest + RTL) are owned by the Frontend Agent. When frontend logic, component state, validation, rendering conditions, hooks, or helpers are changed, the Frontend Agent adds or updates the relevant tests co-located with the affected code.
- **No DB Integration Tests Agent at this stage.** The backend uses in-memory storage by default. A dedicated DB integration tests agent should only be introduced if the codebase moves to PostgreSQL/JPA/Hibernate as the primary persistence layer, adds schema migrations, or requires repository-level tests with a real database or Testcontainers.

## Quality Gates (all required before PR)
- [ ] `./mvnw test` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] `npm run test` passes (frontend unit tests — Vitest)
- [ ] `npm run test:e2e` passes (Playwright)
- [ ] `reports/runs/<id>/security-report.md` verdict: APPROVED
- [ ] `reports/runs/<id>/code-review-report.md` verdict: APPROVED
- [ ] `README.md` documents how to run the full app
- [ ] `reports/runs/<id>/release-summary.md` exists

## Release Strategy
All PRs are opened via **GitHub CLI (`gh`)** — not GitHub MCP.

Before running any `gh` command, verify it is installed (`gh --version`). If not found, install it per the instructions in [`.claude/skills/release-pr-agent/SKILL.md`](.claude/skills/release-pr-agent/SKILL.md), then run `gh auth login`. Authentication must succeed before a PR can be created. Credentials must never be stored in the repository.
