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
| Team Lead | `.claude/skills/team-lead` | claude-opus-4-8 | Planning, task assignment, quality gates, final release decision |
| Product Agent | `.claude/skills/product-agent` | claude-sonnet-4-6 | `reports/product-spec.md`, user stories, acceptance criteria |
| Architect Agent | `.claude/skills/architect-agent` | claude-opus-4-8 | `reports/architecture.md`, API contract, domain model |
| Java Backend Agent | `.claude/skills/java-backend-agent` | claude-sonnet-4-6 | `apps/backend/src/main/java/` — all production backend code |
| Frontend Agent | `.claude/skills/frontend-agent` | claude-sonnet-4-6 | `apps/frontend/src/` — all React/TypeScript UI code |
| Backend Unit Tests Agent | `.claude/skills/backend-unit-tests-agent` | claude-sonnet-4-6 | `apps/backend/src/test/` — all Java unit tests |
| Playwright E2E Agent | `.claude/skills/playwright-e2e-agent` | claude-sonnet-4-6 | `apps/frontend/tests/e2e/` — all browser tests |
| Security Agent | `.claude/skills/security-agent` | claude-opus-4-8 | `reports/security-report.md` |
| Code Review Agent | `.claude/skills/code-review-agent` | claude-opus-4-8 | `reports/code-review-report.md` |
| Infrastructure Agent | `.claude/skills/infrastructure-agent` | claude-haiku-4-5-20251001 | `docker-compose.yml`, env documentation, run instructions |
| Release PR Agent | `.claude/skills/release-pr-agent` | claude-haiku-4-5-20251001 | `reports/final-pr-summary.md`, PR creation |

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
- [ ] `reports/security-report.md` verdict: APPROVED
- [ ] `reports/code-review-report.md` verdict: APPROVED
- [ ] `README.md` documents how to run the full app
- [ ] `reports/final-pr-summary.md` exists

## Release Strategy
All PRs are opened via **GitHub CLI (`gh`)** — not GitHub MCP.

Before running any `gh` command, verify it is installed (`gh --version`). If not found, install it per the instructions in [`.claude/skills/release-pr-agent/SKILL.md`](.claude/skills/release-pr-agent/SKILL.md), then run `gh auth login`. Authentication must succeed before a PR can be created. Credentials must never be stored in the repository.
