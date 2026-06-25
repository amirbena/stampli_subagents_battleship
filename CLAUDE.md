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
| Requirement Intake | `.claude/skills/requirement` | claude-opus-4-8 | `reports/runs/<id>/requirements.md`, workflow lock, branch setup, image analysis, hand-off to Team Lead |
| Team Lead | `.claude/skills/team-lead` | claude-opus-4-8 | Planning, task assignment, quality gates, E2E infrastructure pre-gate, final release decision |
| Product Agent | `.claude/skills/product-agent` | claude-sonnet-4-6 | `reports/runs/<id>/product-spec.md`, user stories, acceptance criteria |
| Architect Agent | `.claude/skills/architect-agent` | claude-opus-4-8 | `reports/runs/<id>/architecture.md`, API contract, domain model — structure only, not environment setup |
| Java Backend Agent | `.claude/skills/java-backend-agent` | claude-sonnet-4-6 | `apps/backend/src/main/java/` — all production backend code; `src/test/**/*Test.java` — all JUnit 5 unit tests (domain + service layer) **and `@WebMvcTest` controller tests** |
| Frontend API Agent | `.claude/skills/frontend-api-agent` | claude-sonnet-4-6 | `apps/frontend/src/api/`, `hooks/`, `types/` — HTTP wrappers, hooks, TypeScript types + Vitest unit tests |
| Frontend UI Agent | `.claude/skills/frontend-ui-agent` | claude-sonnet-4-6 | `apps/frontend/src/components/`, `pages/`, `utils/`, CSS — render layer + Vitest component tests + cross-layer `*.integration.test.tsx` (self-diagnosed: seam/timing/wiring/async-ordering issues where per-layer unit tests pass but runtime behavior fails) |
| Backend Integration Tests Agent | `.claude/skills/backend-integration-tests-agent` | claude-sonnet-4-6 | `apps/backend/src/test/**/*IntegrationTest.java` — `@SpringBootTest` + MockMvc, **exception-only** for cross-layer flows and profile-specific wiring; `@WebMvcTest` tests belong to `java-backend-agent` |
| Playwright E2E Agent | `.claude/skills/playwright-e2e-agent` | claude-sonnet-4-6 | `apps/frontend/tests/e2e/`, `apps/frontend/playwright.config.*` — all browser tests; never assumes servers are running |
| Security Agent | `.claude/skills/security-agent` | claude-opus-4-8 | `reports/runs/<id>/security-report.md` |
| Code Review Agent | `.claude/skills/code-review-agent` | claude-opus-4-8 | `reports/runs/<id>/code-review-report.md` |
| Infrastructure Agent | `.claude/skills/infrastructure-agent` | claude-sonnet-4-6 | `docker-compose.yml`, env documentation, run instructions, cross-platform startup scripts |
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

#### Frontend UI Agent — Internal Smoke Gate (selective)

When `frontend-ui-agent` implements a change, it runs `smoke.spec.ts` as its own pre-report verification — but only when the change affects **user-visible behavior** (routing, rendering, game interaction, placement flow, validation, navigation, visible UI state).

**Skip** for: pure refactors, type-only changes, test-only changes, copy-only changes, or isolated CSS tweaks covered by build/unit tests. Record the skip reason in the Evidence section.

### No E2E
- Backend-only changes with zero frontend impact

## Git Branch Handling Policy
Team Lead's branch decisions (Cases A–I) live in `.claude/skills/team-lead/SKILL.md` (Step 5). Operational bash sequences live in `.claude/policies/git-branch-policy.md` (lazy-loaded by Team Lead when a branch operation is needed). Key rules:
- Team Lead owns all branch decisions (Cases A–I) before any implementation agent is spawned.
- Implementation agents (frontend, backend) only confirm they are on the branch Team Lead assigned — they never run branch operations themselves.
- Never implement directly on `main`. Dirty `main` is always a hard stop.
- New branches are verified free on local and remote before creation (multi-team safety guard).
- Feature branches always sync via `git fetch origin && git rebase origin/main`, never `git pull origin main`.

## Requirement Intent Classification

Before applying fast-path triggers, Team Lead classifies every requirement as a **WHAT-change** (new or extended behavior → standard path) or a **HOW-change** (same outcome, different mechanism → refactor candidate with scope-specific routing). The word "refactor" may not appear in the requirement — intent is inferred from what changes for users and the API surface.

See `.claude/policies/requirement-intent-classification-policy.md` for signal phrases, refactor scope table (test-only / single-layer / cross-layer / domain-model / full-flow), contract-change escalation rules, and the required `Intent Classification` block in `team-lead-classification.md`.

## File Ownership Rule
Agents must not edit files outside their ownership domain without explicit Team Lead approval.

## Agent Proliferation Rule

Do not add a new agent unless **both** conditions are true:
1. The responsibility is clearly separate from what existing agents already own.
2. The test type or task requires a different execution context (e.g. different runtime, different Spring profile, different tool chain).

Current decisions locked in:
- **Frontend split into two agents — split only when independent.** `frontend-api-agent` owns `api/`, `hooks/`, `types/` — data fetching, DTO mapping, API error mapping, loading counters, retries, and types needed for API contracts. `frontend-ui-agent` owns `components/`, `pages/`, `utils/`, CSS — board rendering, visual states, UX behavior, modals/toasts. Split and run in parallel **only when the requirement contains independently implementable API/data-layer work AND UI/render-layer work**. For small or tightly-coupled changes, use `frontend-ui-agent` as the default single agent. For data/hook-only changes, use `frontend-api-agent` alone. Team Lead pre-writes `types/game.ts` before spawning both agents; neither agent may independently modify shared boundary types. `frontend-ui-agent` runs `smoke.spec.ts` as an internal pre-report check only (not the E2E phase) — Playwright E2E is a separate step owned by `playwright-e2e-agent`.
- **Split path — Team Lead is the synchronization point.** When both frontend agents run in parallel, neither knows the other is done. Team Lead waits for both to report done, then runs `npm run test` + `npm run build` as the cross-agent contract check. `npm run build` catches silent consumer breaks where `frontend-api-agent` changed a hook's return shape and `frontend-ui-agent`'s component broke without either co-located test suite failing.
- **E2E failure routing follows data, not symptom.** A UI symptom does not mean the bug is in the UI layer. Team Lead checks the data flow — if the hook returns wrong data, route to `frontend-api-agent`; if the hook is correct but the component renders wrong, route to `frontend-ui-agent`. After any `frontend-api-agent` fix, always run `npm run build` before re-triggering E2E. Before re-triggering E2E after any frontend fix, only agents that changed files must re-verify — but `npm run build` always runs regardless.
- **No separate Backend Unit Tests Agent.** Java unit tests (JUnit 5 + Mockito, domain + service layer) are owned by the Java Backend Agent — same rationale as frontend. When backend logic changes, the Java Backend Agent adds or updates the corresponding `*Test.java` files in the same pass.
- **No DB Integration Tests Agent at this stage.** The backend uses in-memory storage by default. A dedicated DB integration tests agent should only be introduced if the codebase moves to PostgreSQL/JPA/Hibernate as the primary persistence layer, adds schema migrations, or requires repository-level tests with a real database or Testcontainers.

## Backend Test Ownership and Spring Test Policy

`java-backend-agent` owns all controller-layer tests using `@WebMvcTest` (HTTP status, JSON shape, `@Valid` firing, error body shape). `@WebMvcTest` is the default for all controller tests — it boots only the web layer and mocks services.

`backend-integration-tests-agent` is **exception-only**. Team Lead may only spawn it when the scenario genuinely requires a full Spring context: cross-layer flow (real service + real repository), profile-specific wiring, or multi-controller shared state. Every `@SpringBootTest` class must include a class-level justification comment.

See `.claude/policies/backend-test-ownership-policy.md` and `.claude/policies/spring-test-runtime-policy.md` for the decision table, WebMvcTest examples, and SpringBootTest justification format.

## AC-to-Test Coverage Matrix

When Architect Agent runs, it must include an `## AC-to-Test Coverage Matrix` in `architecture.md`. This matrix maps every acceptance criterion to a test type, owner, framework, gate, and notes. It is the binding source of truth that Team Lead uses to:
1. Decide which test types and agents to spawn (not re-derived from the product spec).
2. Drive the Validation Gap Check before release (comparing what was validated against what the matrix specified).

Load `.claude/templates/ac-coverage-matrix-template.md` for the column definitions and example rows.

## Code Review and Security Review Validity

Every `code-review-report.md` and `security-report.md` must record the `Generated From Commit` SHA at the time of review.

Before routing to `release-pr-agent`, Team Lead runs the SHA Validity Gate:
```bash
git diff --name-only <last-reviewed-sha>..HEAD
```
If production code changed after the last review, a delta or full re-review is required before release. See `.claude/metadata/review-validity-schema.md` for the decision table and post-review fix severity routing (Small / Medium / Large).

## Quality Gates (all required before PR, run in this order)
- [ ] `./mvnw test` passes (backend unit tests — if backend touched)
- [ ] `npm run test` + `npm run build` pass (frontend — if frontend touched): single-agent path: running agent owns gate; split path: Team Lead runs once after both agents finish
- [ ] `./mvnw test -Dtest="*IntegrationTest"` passes (backend integration tests — after unit tests green, when HTTP layer changed)
- [ ] Cross-layer frontend integration tests pass — `*.integration.test.tsx` files included in `npm run test`; `frontend-ui-agent` self-diagnoses when one is needed (per-layer unit tests pass but runtime behavior fails due to seam, timing race, provider wiring, or async side-effect ordering) and writes it before any production fix
- [ ] `npm run test:e2e` passes (Playwright — after all tests green, Full or Smoke mode depending on change)
- [ ] `reports/runs/<id>/security-report.md` verdict: APPROVED
- [ ] `reports/runs/<id>/code-review-report.md` verdict: APPROVED
- [ ] `README.md` documents how to run the full app
- [ ] `reports/runs/<id>/release-summary.md` exists

## Release Strategy
All PRs are opened via **GitHub CLI (`gh`)** — not GitHub MCP.

Before running any `gh` command, verify it is installed (`gh --version`). If not found, install it per the instructions in [`.claude/skills/release-pr-agent/SKILL.md`](.claude/skills/release-pr-agent/SKILL.md), then run `gh auth login`. Authentication must succeed before a PR can be created. Credentials must never be stored in the repository.
