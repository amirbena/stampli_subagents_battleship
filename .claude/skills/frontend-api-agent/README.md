# frontend-api-agent — Frontend API Agent

**Model:** `claude-sonnet-4-6`
**Spawned by:** Team Lead (parallel with `frontend-ui-agent` on full-stack changes, or alone for data-layer-only changes)

## Responsibility

Owns the frontend data layer. Writes API wrappers, custom hooks, and TypeScript types. Maps HTTP responses to frontend DTOs and handles API error states, loading counters, and retries.

## Owns

| Path | Description |
|---|---|
| `apps/frontend/src/api/` | HTTP client wrappers |
| `apps/frontend/src/hooks/` | Custom React hooks |
| `apps/frontend/src/types/` | TypeScript type definitions |

## Tests

Vitest unit tests for hooks and API utilities, co-located in the same folders.

## Parallel Split Rule

When running in parallel with `frontend-ui-agent`, Team Lead pre-writes `types/game.ts` before spawning both agents. Neither agent may independently modify shared boundary types during the parallel phase.

## Does Not Do

- Does not own components, pages, or CSS (owned by `frontend-ui-agent`)
- Does not make routing decisions
- Does not write E2E tests
