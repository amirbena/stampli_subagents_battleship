# Architecture — Battleship Multi-Agent Software Factory

## Overview

This project uses a **Gen4 multi-agent software factory** built on Claude Code.  
A single user requirement triggers an autonomous pipeline of specialized agents that take the change from raw text to a merged PR — with no human involvement between intake and final review.

Each agent is a Claude skill defined in `.claude/skills/<agent-name>/SKILL.md`.

---

## Agent Pipeline — Flow Diagram

```
User Requirement
       │
       ▼
┌─────────────────┐
│  Requirement    │  Captures raw request, creates isolated workflow run,
│  Intake         │  guards branch safety, writes requirements.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Product Agent  │  Converts requirement into acceptance criteria,
│                 │  writes run-scoped product-spec.md
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Team Lead     │  Classifies scope, decides which agents to run,
│  (Orchestrator) │  writes execution plan, owns all branch decisions
└────────┬────────┘
         │
         ├─── Architecture Required? ───►┌──────────────────┐
         │                               │  Architect Agent │  API contract, domain model,
         │                               │                  │  folder structure, test strategy
         │                               └────────┬─────────┘
         │                                        │ returns to Team Lead
         │◄───────────────────────────────────────┘
         │
         ├──────────────────────────────────────────────────────────┐
         ▼                                                          ▼
┌─────────────────┐                                    ┌───────────────────┐
│  Java Backend   │  Spring Boot game engine,          │  Frontend Agent   │  React/TypeScript UI,
│  Agent          │  domain model, REST API,           │                   │  pages, components,
│                 │  repository layer                  │                   │  frontend unit tests
└────────┬────────┘                                    └─────────┬─────────┘
         │               (parallel)                              │
         └─────────────────────┬──────────────────────────────────┘
                               │
                               │  ── STEP 1: UNIT TESTS (parallel, cheapest) ──────────┐
                               ▼                                                        │
                    ┌──────────┴──────────┐                                            │
                    ▼                     ▼                                            │
       ┌────────────────────┐  ┌───────────────────────┐                              │
       │  Java Backend Agent│  │  Frontend Agent       │                              │
       │  JUnit5 + Mockito  │  │  Vitest + RTL         │                              │
       │  ./mvnw test       │  │  npm run test         │                              │
       │  (if backend hit)  │  │  (if frontend hit)    │                              │
       └────────┬───────────┘  └──────────┬────────────┘                              │
                └──────────────┬───────────┘                                          │
                               │  ── GATE: unit tests green ───────────────────────────┘
                               │
                               │  ── STEP 2: INTEGRATION TESTS (after unit gate) ──────┐
                               ▼                                                        │
                  ┌────────────────────────────┐                                       │
                  │  Backend Integration Tests │                                       │
                  │  @SpringBootTest + MockMvc │                                       │
                  │  ./mvnw test *Integration  │                                       │
                  │  (if HTTP layer changed)   │                                       │
                  └────────────┬───────────────┘                                       │
                               │  ── GATE: integration tests green ─────────────────────┘
                               │
                               │  E2E mode = Full?  ──► E2E Infrastructure Pre-Gate
                               │  (only when contract changed)  • application-e2e.yml
                               │                                • Maven e2e profile
                               │                                • dual webServer
                               │                                • VITE_API_BASE_URL
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Playwright E2E       │  Full: all specs + live backend
                   │  Agent                │  Smoke: smoke.spec.ts only, no backend
                   │                       │  None: skipped
                   └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
         ┌──────────────────┐   ┌──────────────────────┐
         │  Security Agent  │   │  Code Review Agent   │  (parallel)
         │                  │   │                      │
         └────────┬─────────┘   └──────────┬───────────┘
                  └──────────┬─────────────┘
                             │  both must return APPROVED
                             ▼
                  ┌──────────────────────┐
                  │  Release PR Agent    │  Verifies all quality gates,
                  │                      │  writes release-summary.md,
                  │                      │  opens PR via gh CLI
                  └──────────────────────┘
                             │
                             ▼
                       Pull Request
                    (human reviews only)
```

---

## Agent Roster

| Agent | Model | Owns | Skill |
|-------|-------|------|-------|
| **Requirement Intake** | sonnet-4-6 | `reports/runs/<id>/requirements.md`, branch setup | `.claude/skills/requirement` |
| **Product Agent** | sonnet-4-6 | `reports/runs/<id>/product-spec.md`, acceptance criteria | `.claude/skills/product-agent` |
| **Team Lead** | opus-4-8 | Orchestration, plan, branch decisions, quality gates | `.claude/skills/team-lead` |
| **Architect Agent** | opus-4-8 | `reports/runs/<id>/architecture.md`, API contract, domain model | `.claude/skills/architect-agent` |
| **Java Backend Agent** | sonnet-4-6 | `apps/backend/src/main/java/` — all production Java; `src/test/**/*Test.java` — JUnit 5 + Mockito unit tests | `.claude/skills/java-backend-agent` |
| **Frontend Agent** | sonnet-4-6 | `apps/frontend/src/` — React/TypeScript + Vitest unit tests | `.claude/skills/frontend-agent` |
| **Backend Integration Tests Agent** | sonnet-4-6 | `apps/backend/src/test/**/*IntegrationTest.java` — `@SpringBootTest` + MockMvc (HTTP layer) | `.claude/skills/backend-integration-tests-agent` |
| **Playwright E2E Agent** | sonnet-4-6 | `apps/frontend/tests/e2e/` — browser E2E tests | `.claude/skills/playwright-e2e-agent` |
| **Security Agent** | opus-4-8 | `reports/runs/<id>/security-report.md` | `.claude/skills/security-agent` |
| **Code Review Agent** | opus-4-8 | `reports/runs/<id>/code-review-report.md` | `.claude/skills/code-review-agent` |
| **Infrastructure Agent** | haiku-4-5 | `docker-compose.yml`, env docs, run instructions | `.claude/skills/infrastructure-agent` |
| **Release PR Agent** | haiku-4-5 | `reports/runs/<id>/release-summary.md`, PR via `gh` | `.claude/skills/release-pr-agent` |

---

## Key Design Rules

### Separation of Concerns
- **Team Lead** owns all decisions — branch, scope, agent routing, quality gates. No other agent makes decisions.
- **Architect** owns structure (domain model, API contract, folder layout) — never environment setup or implementation.
- **Java Backend Agent** owns JUnit 5 unit tests for domain and service layer — no separate backend unit test agent (same rationale as frontend).
- **Frontend Agent** owns Vitest unit tests for its own components — no separate frontend unit test agent.
- **Playwright E2E Agent** owns browser tests — never touches production code.

### Run Isolation
Every workflow run writes to its own directory:
```
reports/
  .workflow.lock          ← see below
  current-run.json        ← pointer to active run
  runs/
    <YYYYMMDD-HHMMSS-sha>/
      requirements.md
      product-spec.md
      team-lead-classification.md
      team-lead-plan.md
      architecture.md     ← only if Architecture Required: Yes
      security-report.md
      code-review-report.md
      release-summary.md
```

#### Why `.workflow.lock` exists

All agents in a run share one git working tree and one `reports/` directory. If two requirements are triggered at the same time (or a second `/requirement` is fired before the first run finishes), two concurrent agent pipelines would:

- Both try to create or rebase the same feature branch → git conflict or silent overwrite
- Both write to `reports/current-run.json` → one run's agents read the other run's reports
- Both commit and push simultaneously → history corruption or a PR that mixes two unrelated changes

`.workflow.lock` is a simple JSON file written at the start of every run and deleted (or marked `"status": "completed"`) at the end. Before starting, Requirement Intake checks whether the lock exists with `"status": "running"`. If it does, the new run is rejected immediately with a clear message — no agents are spawned, no files are touched.

This makes the pipeline **single-tenant by design**: one requirement in flight at a time per working tree.

### E2E Modes

Team Lead picks the mode based on what changed. The mode controls whether `playwright-e2e-agent` is spawned and what it runs.

| Mode | When | What runs |
|------|------|-----------|
| **Full** | API contract changed (new/modified endpoints, DTOs, response shapes), or new backend-coordinated flow | All E2E specs against live backend on port 8081 |
| **Smoke** | Frontend-only change — new pages/flows/components, no contract change | `smoke.spec.ts` only, no backend needed |
| **None** | Backend-only change, zero frontend impact | E2E skipped |

Full mode requires the E2E Infrastructure Pre-Gate to pass before the Playwright agent runs. Smoke mode bypasses the pre-gate entirely.

#### Frontend Agent — Internal Smoke Gate (selective)

The `frontend-agent` runs `smoke.spec.ts` as its own verification step, but only when the change affects **user-visible behavior**: routing, page rendering, game interaction, placement flow, validation, navigation, or visible UI state.

**Skip** the internal smoke gate for: pure refactors, type-only changes, test-only changes, copy-only changes, or isolated CSS tweaks already covered by build/unit tests. When skipped, the agent records the reason in its Evidence section and Team Lead records it in `test-results.md`.

This is separate from the Team Lead E2E mode decision above — it is a lightweight pre-check the agent runs on itself before reporting done.

### Quality Gates (all must pass before PR)
- `./mvnw test` — backend unit tests
- `npm run build` — frontend build
- `npm run test` — frontend unit tests (Vitest)
- `npm run test:e2e` — Playwright E2E
- `reports/runs/<id>/security-report.md` verdict: **APPROVED**
- `reports/runs/<id>/code-review-report.md` verdict: **APPROVED**

---

## Application Stack

### Backend
- Java 17, Spring Boot 3
- REST API (`/api/v1/`)
- In-memory `GameRepository` (interface-driven, swappable)
- Domain: `Game`, `Board`, `Ship`, `Player`, `GameMode` — pure Java, no Spring annotations
- Port 8080 (dev) / 8081 (E2E)

### Frontend
- React 18 + TypeScript, Vite
- Axios for REST
- Playwright for E2E, Vitest + RTL for unit tests
- Port 5173 (dev) / 3001 (E2E)

### Infrastructure
- Docker Compose for local full-stack run
- No Redis unless a concrete scalability requirement justifies it
