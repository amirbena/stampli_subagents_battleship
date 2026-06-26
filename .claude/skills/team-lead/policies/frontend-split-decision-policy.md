# Frontend Split Decision Policy

Loaded by Team Lead in Step 6 before spawning any frontend agent.
Team Lead makes the split decision — this policy defines the criteria.

## Conservative Frontend Defaults

| Rule | Detail |
|---|---|
| `frontend-ui-agent` is the default | Use it for any small, tightly-coupled, UI-only, or cross-layer change. Never split by default. |
| `frontend-api-agent` is optional | Use it alone for hook/API/type-only changes, or in parallel when data-layer work is clearly independent of UI work. |
| No `frontend-unit-test-agent` | Unit tests belong to the implementing agent. |
| Single-agent: agent owns full gate | `npm run test` + `npm run build` run by the agent before reporting done. |
| Split path: Team Lead owns full gate | Each agent runs its co-located slice; Team Lead waits for BOTH to report done, then runs `npm run test` + `npm run build` once. This is the cross-agent contract check — neither agent knows the other is done; Team Lead is the synchronization point. |
| Only Team Lead spawns | No agent may spawn another agent or advance a gate without Team Lead instruction. |
| Team Lead does not micromanage frontend test selection | `frontend-ui-agent` decides which unit tests, integration tests, and smoke checks to add within its scope. Team Lead may reject the result only if the agent skipped an obvious required gate, exceeded its file scope, or reported done without evidence. |

## Split Criteria

Split into `frontend-api-agent` + `frontend-ui-agent` **only when ALL of the following are true:**

1. The requirement contains independent API/data-layer work: new or changed hook, axios logic, type contract, loading counter, polling, retry, error mapping, DTO mapping, or data-fetching behavior.
2. The requirement also contains independent UI/render-layer work: new or changed component, page, CSS, visual state, toast/modal, board rendering, or UX behavior.
3. The two bodies of work do not tightly couple — the UI agent's work does not depend on a runtime value or intermediate state the API agent produces (beyond the shared types Team Lead pre-writes).

**Keep as a single agent when:**
- The change is small or touches both layers tightly (e.g., a one-file component that also needs a small API tweak — splitting creates more coordination overhead than it saves).
- Only one layer is touched — use `frontend-ui-agent` for render/CSS/copy/layout; `frontend-api-agent` for hooks/API/types.

## Ownership Boundaries (when split)

| Agent | Owns |
|---|---|
| `frontend-api-agent` | `api/`, `hooks/`, data fetching, DTO mapping, API error mapping, loading counters, retries, React async state, and types needed for API contracts |
| `frontend-ui-agent` | `components/`, `pages/`, board rendering, visual states, CSS, UX behavior, modals/toasts, and Playwright smoke verification for visible behavior |

## Routing Table

| Scope of change | Agents to spawn |
|---|---|
| Independent API work AND independent UI work | `java-backend-agent` + `frontend-api-agent` + `frontend-ui-agent` (all parallel; pre-write types first) |
| Small or tightly-coupled across both layers | `frontend-ui-agent` only (default single-agent path) |
| `java-backend-only` | `java-backend-agent` only |
| `frontend-only` — data/hook/API only, no component/CSS impact | `frontend-api-agent` only |
| `frontend-only` — render/CSS/copy/layout only, no data-layer impact | `frontend-ui-agent` only |

## Routing After Fixes

- Hook/API/type failure → `frontend-api-agent` self-heals.
- Component/page/CSS failure → `frontend-ui-agent` self-heals.
- TypeScript compile error: read the failing file path — `api/hooks/types` → `frontend-api-agent`; `components/pages/utils/CSS` → `frontend-ui-agent`.
