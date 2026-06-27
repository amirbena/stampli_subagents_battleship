# Team Lead Execution Plan

Workflow Run ID:
Generated From Branch:
Generated From Commit:
Generated At:

## Requirement Summary

## Product Summary

## Architecture Status

Architecture Required:
Architecture Run:
Architecture Summary:
Architecture Skipped Reason:

## Execution Route

docs-only / frontend-only / java-backend-only / backend-and-frontend / config-aware / infra / auth-security / multiplayer-session / full-stack-complex

## Execution Mode

cheap / normal / full

## Agents To Run

## Agents Skipped And Why

## Developer Assignments

For each developer agent:

Agent:
Assignment:
Allowed Scope:
Expected Files/Areas:
Out of Scope:
Required Output:

## Work Order

## File Ownership

## Shared File Handling

## Required Tests

## Runtime / Build / Test Failure Routing

If Java backend build fails: route to java-backend-agent
If Spring/runtime startup fails: route to java-backend-agent
If frontend build fails: read the failing file path — route to `frontend-api-agent` (api/hooks/types) or `frontend-ui-agent` (components/pages/utils/CSS)
If frontend runtime fails: same routing by file path
If QA rejects: Team Lead classifies and routes to suspected owner
If security concern appears: route to security-agent
If demo config issue appears: route to relevant agent (allowed demo config is not a blocker)
If infra change appears required: route to infrastructure-agent only if explicitly allowed; otherwise document as recommendation

## QA Plan

## Dependency Changes

Dependency changes detected: Yes / No

If Yes — complete this section; otherwise write "No dependency changes in this run."

| Manifest | Change Type | Package / Artifact | Version | Scope | Reason |
|---|---|---|---|---|---|
| `package.json` / `pom.xml` | Added / Removed / Updated | `example-lib` | `1.2.3` | `dependencies` / `compile` | ... |

Validation results received: Yes / No
Architecture escalation required: Yes / No — reason:
Security escalation required: Yes / No — reason:
Security reuse decision: Reuse existing / Trigger additional / Not required

## Security Review Required

Yes/No and reason.

## Backend Integration Tests Required

Yes / No — and exact trigger (which of the five conditions matched, or why all were absent).

## E2E Mode

None / Smoke / Full — and reason.

**Decision rules (pick the first that matches):**

| Condition | E2E Mode |
|-----------|----------|
| API contract changed (new endpoint, changed request/response shape, new status codes) | **Full** — frontend + live backend on port 8081 |
| New game mode, state machine transition, or multiplayer flow requiring backend coordination | **Full** |
| New frontend pages/flows/components but NO contract change | **Smoke** — `smoke.spec.ts` only, no backend |
| Pure styling, copy, or layout change | **Smoke** |
| Backend-only change, zero frontend impact | **None** |

When mode is **Full**, Team Lead must pass the E2E Infrastructure Pre-Gate before spawning playwright-e2e-agent (see Step 6).
When mode is **Smoke**, Team Lead spawns playwright-e2e-agent with instruction to run `smoke.spec.ts` only — no backend webServer needed.
When mode is **None**, playwright-e2e-agent is not spawned.

## Demo Config / Dotenv Plan

Config changes required: Yes/No
Allowed files: ...
Values are: PUBLIC_CONFIG / DEMO_CONFIG_ACCEPTED / PLACEHOLDER_CONFIG / UNKNOWN_SENSITIVE_VALUE
Human setup required: Yes/No

## Done Criteria

## Loop Prevention Plan

Frontend technical attempt limit: 10
Java Backend technical attempt limit: 10
QA cycle limit: 5
Product reopen limit: 3
Architecture reopen limit: 3
Route escalation limit: 3
Total fix cycle limit: 15

## Technical Agent Rule Preservation

- Java Backend technical rules remain active.
- Frontend technical rules remain active.
- QA technical rules remain active.
- Security technical rules remain active.
- Infrastructure technical rules remain active.

## Infrastructure Non-Modification Confirmation

- Dockerfile must not be touched by this workflow update.
- Docker Compose files must not be touched by this workflow update.
- CI/deployment files must not be touched by this workflow update.
- Dependencies and lockfiles must not be touched by this workflow update.

## Risk Handling Policy

Which risks can be documented in PR:
Which risks require hard blocker:

## Workflow Metadata

Workflow Run ID:
