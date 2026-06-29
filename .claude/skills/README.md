# skills — Agent Definitions

Each sub-folder defines one agent. The entry point is always `SKILL.md`.
The `model:` frontmatter field in each `SKILL.md` controls which model runs that agent.

## Agent Index

| Folder | Agent | Model | Owns |
|---|---|---|---|
| `requirement/` | Requirement Intake | opus-4-8 | `requirements.md`, workflow lock, branch setup, hand-off to Team Lead |
| `team-lead/` | Team Lead | opus-4-8 | Planning, routing, quality gates, release decision |
| `product-agent/` | Product Agent | sonnet-4-6 | `product-spec.md`, user stories, acceptance criteria |
| `architect-agent/` | Architect Agent | opus-4-8 | `architecture.md`, API contract, AC-to-Test matrix |
| `java-backend-agent/` | Java Backend Agent | sonnet-4-6 | `apps/backend/src/main/java/`, JUnit 5 tests, `@WebMvcTest` |
| `frontend-api-agent/` | Frontend API Agent | sonnet-4-6 | `apps/frontend/src/api/`, `hooks/`, `types/` |
| `frontend-ui-agent/` | Frontend UI Agent | sonnet-4-6 | `apps/frontend/src/components/`, `pages/`, `utils/`, CSS |
| `backend-integration-tests-agent/` | Backend Integration Tests Agent | sonnet-4-6 | `@SpringBootTest` integration tests (exception-only) |
| `playwright-e2e-agent/` | Playwright E2E Agent | sonnet-4-6 | `apps/frontend/tests/e2e/`, Full and Smoke E2E |
| `infrastructure-agent/` | Infrastructure Agent | sonnet-4-6 | `docker-compose.yml`, env docs, startup scripts |
| `security-agent/` | Security Agent | opus-4-8 | `security-report.md` |
| `code-review-agent/` | Code Review Agent | opus-4-8 | `code-review-report.md` |
| `release-pr-agent/` | Release PR Agent | haiku-4-5 | `release-summary.md`, PR creation via `gh` |

## Agent-local Sub-folders

Some agents carry their own templates or policies:

| Path | Contents |
|---|---|
| `team-lead/policies/` | Team Lead-only routing and classification policies (9 files) |
| `release-pr-agent/templates/` | `pr-summary-template.md` |
| `requirement/templates/` | `requirements-template.md` |

To extend an agent, edit its `SKILL.md`. Do not create parallel files.
