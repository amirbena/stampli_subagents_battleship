# Test Failure Routing Policy

Loaded by Team Lead in Step 7d when any agent reports a test failure.
Team Lead is the sole decision-maker on routing. Never route blindly — classify first.

## Classification and Routing Table

| Failure symptom | Routing | Action |
|---|---|---|
| JUnit unit test fails (production code wrong) | `java-backend-agent` **self-heals** — no Team Lead hop | Fix code; re-run `./mvnw test` |
| JUnit unit test itself wrong (bad assertion/mock) | `java-backend-agent` **self-heals** — no Team Lead hop | Fix test; re-run `./mvnw test` |
| `@SpringBootTest` / MockMvc fails (80% case) | `java-backend-agent` directly | Fix controller/DTO/exception handler; re-run `*IntegrationTest` |
| `@SpringBootTest` / MockMvc fails after 2 java-backend cycles | Team Lead reads output → `backend-integration-tests-agent` | Fix the test setup/assertion; re-run `*IntegrationTest` |
| Vitest / RTL test fails (hook, API, type logic) | `frontend-api-agent` **self-heals** — no Team Lead hop | Fix hook/API; re-run `npx vitest run src/api src/hooks src/types` |
| Vitest / RTL test fails (component, page, render) | `frontend-ui-agent` **self-heals** — no Team Lead hop | Fix component; re-run `npx vitest run src/components src/pages src/utils` |
| Vitest test itself wrong (bad assertion/mock) | owning frontend agent **self-heals** — no Team Lead hop | Fix test; re-run co-located tests only |
| Frontend full gate fails (single-agent path) | Owning frontend agent **self-heals** | Fix code; re-run `npm run test` + `npm run build` |
| Frontend Test Gate fails (split path, TL-run) | Team Lead diagnoses by file path, routes to owning agent | After fix, Team Lead re-runs `npm run test` + `npm run build` |
| TypeScript compile error in frontend | Read file path → route to owner (`api/hooks/types` → `frontend-api-agent`; `components/pages/utils` → `frontend-ui-agent`) **self-heals** | Fix type error; re-run `npm run build` |
| Playwright test fails — backend returns unexpected response | `java-backend-agent` | Fix the backend; re-run `npm run test:e2e` |
| Playwright test fails — UI behaves incorrectly | Before routing: check the data flow. If the component's hook returns the correct value → `frontend-ui-agent`. If the hook returns wrong/stale data → `frontend-api-agent`. Symptom is in the UI but root cause may be in the API layer — follow the data, not the visible layer. | Fix the real owner; re-run `npm run test:e2e` |
| Playwright test fails — API/hook layer wrong | `frontend-api-agent` | Fix the hook/API; if `frontend-ui-agent` also changed files in this fix cycle, it must re-run its tests (unit + integration + smoke) and be green before E2E re-triggers |
| Playwright test fails — both frontend agents changed files | `frontend-api-agent` + `frontend-ui-agent` | Both must re-run their tests and be green; only then re-trigger E2E. If only one agent changed files, the other does not re-verify. |
| Playwright test fails — test is flaky or assertion is wrong | `playwright-e2e-agent` | Fix the test; re-run `npm run test:e2e` |

## Routing Rules

1. **Unit test failures never route through Team Lead.** `java-backend-agent`, `frontend-api-agent`, and `frontend-ui-agent` own their tests and self-heal directly. Team Lead only steps in when the fix cycle limit is reached.
2. **Integration test failures default to `java-backend-agent`** — wrong status code, missing exception handler, DTO serialization mismatch account for ~80% of cases. Only route to `backend-integration-tests-agent` if java-backend-agent fails to fix it after 2 cycles.
3. **Read the failure output before routing** for Playwright failures — a backend bug can surface in a frontend test and vice versa.
4. **Route to exactly one agent.** Do not spawn multiple fix agents for the same failure.
5. **After the fix, re-run only the failing suite** — not all tests.
6. **E2E does not start until all test gates are green.**
7. **Before re-triggering E2E after a frontend fix** — check which agents changed files in this fix cycle. If both `frontend-api-agent` and `frontend-ui-agent` changed files, both must re-run their tests and be green. If only one changed files, only that agent re-verifies. Never re-trigger E2E when the sibling agent's tests are unknown.
8. **After any `frontend-api-agent` fix** — always run `npm run build` before re-triggering E2E, even if `frontend-ui-agent` changed no files. TypeScript will catch shape mismatches where the hook's return type changed and the component silently broke as a consumer. Build failure → route to `frontend-ui-agent` to align the component. Build passes → safe to re-trigger E2E.

## Fix Cycle Limit

Maximum 5 fix cycles per test suite per run. If a suite is still failing after 5 cycles, write `reports/runs/<workflow-run-id>/workflow-blocker.md` and stop.
