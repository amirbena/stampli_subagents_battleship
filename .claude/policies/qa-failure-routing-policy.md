# QA Failure Routing Policy

Team Lead loads this policy during the QA Loop (Step 9) to determine which agent owns a given failure type.

## Failure Type Routing Table

| Failure Type | Route To |
|---|---|
| java-backend-build | `java-backend-agent` |
| java-backend-runtime | `java-backend-agent` |
| java-backend-test | `java-backend-agent` |
| frontend-build | `frontend-api-agent` or `frontend-ui-agent` (read failing file path to route) |
| frontend-runtime | same file-path routing as frontend-build |
| frontend-test | same file-path routing as frontend-build |
| qa-acceptance | Team Lead classifies owner from evidence |
| security | `security-agent` |
| demo-config | relevant agent; demo/placeholder values are not blockers |
| git-state | hard blocker if unsafe |
| infra-required | `infrastructure-agent` only if explicitly allowed; otherwise document as recommendation |
| unknown | Team Lead investigates, assigns smallest likely owner |

## File-Path Routing for Frontend Failures

Read the failing file path:
- `api/`, `hooks/`, `types/` → `frontend-api-agent`
- `components/`, `pages/`, `utils/`, `*.css` → `frontend-ui-agent`
- TypeScript compile error: follow the same path rule for the error's source file

## Frontend-Only Reclassification Guard

When `frontend-ui-agent` returns `REQUIRES_CHANGES` citing missing or insufficient state under a frontend-only classification, Team Lead must reclassify before re-routing.

| Finding | Agent response | Team Lead action |
|---|---|---|
| Reliable state exists in current hooks/props/store | Implement within frontend-only scope | Continue existing route |
| Reliable state is missing or insufficient | Stop — return `REQUIRES_CHANGES` with the missing capability described | Reclassify; route Architecture, Frontend API, or Backend as needed |

Applies to: turn ownership, permissions, loading/recovery status, identity/session state, and any capability-driven UI behavior that cannot be safely inferred from existing frontend data.

**Never instruct `frontend-ui-agent` to invent timing logic, timeout assumptions, or missing contract fields.** If those are absent, the classification is wrong — reclassify first.

---

## Routing Rules

1. **Always read the failure output before routing.** Do not route by visible symptom alone — a UI symptom can have a backend root cause and vice versa.
2. **Route to exactly one agent per finding.** Do not spawn multiple fix agents for the same failure.
3. **After the fix, re-run only the failing suite** — not all tests.
4. **For `java-backend-test` failures that involve `@SpringBootTest`/MockMvc:** default to `java-backend-agent`. Only route to `backend-integration-tests-agent` if `java-backend-agent` fails to fix after 2 cycles.
5. **Before re-triggering E2E after any frontend fix:** check which agents changed files. If both `frontend-api-agent` and `frontend-ui-agent` changed files, both must re-run their tests and be green. If only one changed files, only that agent re-verifies.
6. **After any `frontend-api-agent` fix:** always run `npm run build` before re-triggering E2E — TypeScript will catch shape mismatches where the hook's return type changed and the component silently broke.

## Workflow Failure Rule

A failed run becomes workflow failure only if:
1. The finding is classified as Critical
2. It was routed to the responsible agent
3. Allowed fix attempts were exhausted (see QA Cycle Limits in team-lead/SKILL.md)
4. The feature is unsafe, impossible to implement, or unreleasable in current state
