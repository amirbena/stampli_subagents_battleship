# Frontend Test Routing Policy

Team Lead and `frontend-ui-agent` load this policy to select the correct test type and routing for any frontend change.

## Testing Strategy Levels

Choose the cheapest sufficient level. Do not run all tests by default.

```
Level 0:   Smoke — real browser, mocked backend, sanity check for any UI-visible change
Level 0.5: Targeted UI validation — real browser, mocked backend, layout/alignment assertions
Level 1:   Unit tests — Vitest/jsdom, isolated component/hook/util, cheapest
Level 2:   Frontend integration tests — Vitest/jsdom, real frontend layers, mocked network boundary
Level 3:   Backend integration tests — SpringBootTest/MockMvc, HTTP layer
Level 4:   Full E2E — real browser + real backend, only when Team Lead explicitly routes it
```

## Frontend Test Type Definitions

These definitions are binding for routing decisions.

**Frontend unit tests** — Vitest/jsdom, one isolated unit. Catches: conditional rendering, wrong text/class, missing section, button visibility, disabled/enabled state. Owned by: component/util → `frontend-ui-agent`; hook → `frontend-api-agent`.

**Frontend integration tests** — Vitest/jsdom, multiple real frontend layers, network boundary mocked. Use when: per-layer unit tests pass but runtime behavior fails due to timing/ordering, provider wiring, shared state, or async side-effect interaction. Do not use for simple CSS/layout fixes.

**Playwright UI smoke** — real browser, mocked backend/auth/session. Use for: CSS/layout, responsive/mobile, authenticated screen rendering at viewport sizes. Catches what jsdom cannot. Does not replace unit or integration tests.

**Full E2E** — real browser + real backend on port 8081. Only when Team Lead explicitly routes it. Never triggered by frontend agents.

## Simple UI / CSS / Layout Change Routing

When a requirement is purely visual — layout fix, alignment, responsive tweak, copy change, color change, CSS class fix, missing section in a page:

- Agent: `frontend-ui-agent` only. Do not spawn `frontend-api-agent`, backend agent, or architect.
- Tests: component/unit tests for DOM structure and CSS class assertions. Then `npm run test` + `npm run build`.
- Smoke: Playwright UI smoke with mocked backend if visible browser behavior changed.
- Integration tests: only if the root cause turns out to be a real frontend seam/timing/wiring issue — not by default for visual bugs.
- Full E2E: only if Team Lead discovers an actual API or backend contract issue during the fix cycle.

For screenshot-like layout bugs (placement screen misaligned, mobile layout broken, button/section missing):
1. `frontend-ui-agent` fixes component/CSS.
2. Adds/updates unit tests for structural DOM expectations (section present, CSS class applied, element visible).
3. Runs `npm run test` + `npm run build`.
4. Runs Playwright UI smoke with mocked data/auth at relevant desktop and mobile viewports.
5. Does **not** write a frontend integration test unless the root cause is a seam/timing/wiring issue between component and hook/store/interceptors.
6. Reports done to Team Lead. Does not advance to review or PR directly.

## Smoke Test Gate (Level 0) — Sanity Check For Any UI-Visible Change

For routes that include frontend changes (`frontend-only`, `backend-and-frontend`, `full-stack-complex`), run the smoke gate when the change affects user-visible behavior: routing, page rendering, game interaction, placement flow, validation, navigation, or visible UI state.

```bash
cd apps/frontend && npx playwright test smoke.spec.ts
```

- No backend required — the Playwright `webServer` config starts `npm run dev` automatically.
- Must pass before routing to code review or release.
- If it fails after a frontend change, route back to `frontend-ui-agent` as a `frontend-runtime` finding.
- **Skip** for purely internal refactors, type-only changes, test-only changes, copy-only changes, or isolated CSS tweaks already covered by build/unit tests. When skipped, record the reason in `test-results.md`.

## Targeted UI Validation Test (Level 0.5) — For Layout / Render Changes

Smoke tests only verify navigation and page boot — they do **not** render authenticated screens and cannot catch visual layout regressions. For any UI change where the acceptance criteria include layout, alignment, overflow, or visual positioning, Team Lead must run or write a targeted Playwright test after smoke passes.

### When to write a new targeted test

Write a new test when **all** of the following are true:
1. The change is `frontend-only` or `frontend-and-backend` and affects a user-visible layout or render state.
2. No existing targeted test covers the affected page/component (check `apps/frontend/tests/e2e/` for a matching `*-layout.spec.ts` or `*-render.spec.ts`).
3. The acceptance criteria include at least one of: element alignment, overflow prevention, responsive stacking, visibility of specific elements on specific viewports.

**Skip** for: pure copy changes, color-only changes, icon swaps, test-only changes, or when an existing targeted test already covers the affected area.

### How to write the test

Owned by `playwright-e2e-agent`. Uses `page.route()` to mock all API calls, `sessionStorage` to bypass auth redirects, and `boundingBox()` + `scrollWidth` assertions for pixel-level layout. Spec location: `apps/frontend/tests/e2e/<page>-layout.spec.ts`. See `playwright-e2e-agent/SKILL.md` for implementation details.

### If the targeted test fails

1. Capture the **full failure output** — error message, failing assertion, and the auto-saved screenshot path from `playwright-report/` or `test-results/`.
2. Add a finding to the finding registry: Type `ui-layout`, Severity `High`, Owner `frontend-ui-agent`.
3. Route to `frontend-ui-agent` with the exact failing assertion and screenshot path so the agent can read it with the `Read` tool.
4. After the fix, re-run the targeted test. If it passes, re-run smoke. Then proceed to code review.
5. `frontend-ui-agent` re-runs only the targeted test + smoke — not E2E from scratch.

### Visual Analysis from requirements.md

If `requirements.md` contains a `## Visual Analysis` section (populated from attached screenshots during requirement intake), `frontend-ui-agent` must read it before making any CSS changes. The visual defect table and inferred acceptance criteria in that section are the primary specification — more precise than text-only criteria.
