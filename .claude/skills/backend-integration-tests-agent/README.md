# backend-integration-tests-agent — Backend Integration Tests Agent

**Model:** `claude-sonnet-4-6`
**Spawned by:** Team Lead (exception-only)

## Responsibility

Writes `@SpringBootTest` + MockMvc integration tests for cross-layer flows that cannot be adequately covered by `@WebMvcTest`. This agent is exception-only — Team Lead may only spawn it when a full Spring context is genuinely required.

## Owns

| Path | Description |
|---|---|
| `apps/backend/src/test/**/*IntegrationTest.java` | `@SpringBootTest` integration tests only |

## When To Spawn (exception triggers)

- Cross-layer flow requiring a real service + real repository
- Profile-specific wiring (e.g. `application-e2e.yml` behavior)
- Multi-controller shared state that `@WebMvcTest` cannot wire

Every `@SpringBootTest` class must include a class-level justification comment explaining which trigger applies and why `@WebMvcTest` was insufficient.

## Does Not Do

- Does not write `@WebMvcTest` tests (owned by `java-backend-agent`)
- Does not write unit tests (owned by `java-backend-agent`)
- Does not write frontend or E2E tests
