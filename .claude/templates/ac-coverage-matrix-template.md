# AC-to-Test Coverage Matrix Template

Use this template when the Architect Agent writes `reports/runs/<workflow-run-id>/architecture.md`.

The matrix is a **binding artifact**. Team Lead uses it to:
1. Determine which agents and test types to spawn during Step 6.
2. Drive the Validation Gap Check in Step 14 — comparing what was validated against what was specified here, not re-deriving coverage from the product spec from scratch.
3. Route post-review fixes by change severity.

## AC-to-Test Coverage Matrix

| AC | Behavior | Test Type | Owner | Framework | Gate | Notes |
|----|----------|-----------|-------|-----------|------|-------|
| AC-01 | `<observable behavior matching the AC>` | `<see Test Type Definitions below>` | `<owning agent>` | `<framework>` | Required / Optional | `<why this test type; any exceptions or runtime constraints>` |

### How to fill in each column

- **AC**: The acceptance criterion ID from `product-spec.md` (e.g. AC-01, AC-07).
- **Behavior**: One sentence — the observable system behavior being verified, not the implementation.
- **Test Type**: One of the defined types below. Pick the cheapest type that can actually prove the behavior.
- **Owner**: The agent responsible for writing and maintaining this test.
- **Framework**: The specific tool used (e.g. `JUnit 5`, `WebMvcTest`, `SpringBootTest`, `Vitest`, `Playwright`).
- **Gate**: `Required` (must pass before PR) or `Optional` (nice to have, documented if skipped).
- **Notes**: Any constraints — e.g. "requires browser for localStorage", "no SpringBootTest needed", "E2E only — cannot be mocked".

### Test Type Definitions

| Test Type | When to use | Owner |
|-----------|-------------|-------|
| Unit (domain) | Domain class behavior: placement rules, hit/sunk/win detection, state transitions | java-backend-agent |
| Unit (service) | Service method logic with mocked repository (Mockito) | java-backend-agent |
| Unit (repository) | In-memory repository behavior — plain JUnit, no Spring context | java-backend-agent |
| WebMvcTest | Controller HTTP status, JSON serialization, `@Valid` firing, error shape — **default for all controller tests** | java-backend-agent |
| SpringBootTest | Cross-layer flow (real service + real repository), profile-specific wiring — **exception only, justification required** | backend-integration-tests-agent |
| Component | Isolated React component in Vitest/jsdom | frontend-ui-agent |
| Hook/API unit | Isolated hook or API wrapper in Vitest | frontend-api-agent |
| Integration (frontend) | Cross-layer frontend: seam, timing, provider wiring — Vitest/jsdom, real layers, mocked network | frontend-ui-agent |
| Smoke E2E | Navigation, page boot — real browser, mocked backend | playwright-e2e-agent |
| Full E2E | Real browser + real backend on port 8081 — only when API contract changed | playwright-e2e-agent |

### Example Matrix

| AC | Behavior | Test Type | Owner | Framework | Gate | Notes |
|----|----------|-----------|-------|-----------|------|-------|
| AC-01 | First-time visitor sees name-entry gate before home | Component + Full E2E | frontend-ui-agent + playwright-e2e-agent | Vitest + Playwright | Required | localStorage state drives gate; needs browser for full flow |
| AC-02 | Empty display name rejected with 400 | Unit (service) + WebMvcTest | java-backend-agent | JUnit 5 + WebMvcTest | Required | No SpringBootTest needed — web layer test covers HTTP 400 |
| AC-07 | Returning visitor skips name entry, sees banner | Full E2E | playwright-e2e-agent | Playwright | Required | localStorage pre-seed; cannot be mocked with jsdom reliably |
| AC-14 | Full room returns 409 | WebMvcTest | java-backend-agent | WebMvcTest | Required | Service mocked; status code from controller @ExceptionHandler |
