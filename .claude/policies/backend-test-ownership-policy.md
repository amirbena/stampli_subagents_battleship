# Backend Test Ownership Policy

This table is the binding decision matrix for which agent owns each backend test category.
Load this policy whenever Team Lead must decide whether to spawn `backend-integration-tests-agent`.

## Ownership Table

| Test Scope | Test Annotation | Owner | Framework | Gate |
|-----------|-----------------|-------|-----------|------|
| Domain class behavior (`Game`, `Board`, `Ship`, `Coordinate`, `Player`) | None (plain JUnit 5) | java-backend-agent | JUnit 5 | Required |
| Service method behavior (mocked repository) | `@ExtendWith(MockitoExtension.class)` | java-backend-agent | JUnit 5 + Mockito | Required |
| In-memory repository behavior | None (plain JUnit 5) | java-backend-agent | JUnit 5 | Required |
| Controller HTTP status codes | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| JSON response serialization / deserialization | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| `@Valid` / bean validation constraint firing | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| DTO field contract (name, type, nullability) | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| Error response shape (`{ "error": "..." }`) | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| Exception handler → HTTP status mapping | `@WebMvcTest` | java-backend-agent | Spring MVC Test | Required |
| Cross-layer flow (real service + real repository) | `@SpringBootTest` | backend-integration-tests-agent | Spring MVC Test + H2 | Exception only |
| Profile-specific Spring configuration / wiring | `@SpringBootTest` | backend-integration-tests-agent | Spring MVC Test + H2 | Exception only |
| Multi-controller shared in-memory state | `@SpringBootTest` | backend-integration-tests-agent | Spring MVC Test + H2 | Exception only |
| Runtime behavior with live application context | `@SpringBootTest` | backend-integration-tests-agent | Spring MVC Test + H2 | Exception only |

## Rule: WebMvcTest First

Before choosing `@SpringBootTest`, answer:

> Can this test be written with `@WebMvcTest` + `@MockBean` for the service?

- **YES** → use `@WebMvcTest`, owned by `java-backend-agent`. Do not spawn `backend-integration-tests-agent`.
- **NO** (needs real service, real repository, or profile-specific wiring) → use `@SpringBootTest`, owned by `backend-integration-tests-agent`. Justification comment required in every class. Load `spring-test-runtime-policy.md` for allowed triggers and comment format.

## Rule: backend-integration-tests-agent Is Exception-Only

Team Lead must not spawn `backend-integration-tests-agent` by default. The trigger conditions from the old table (new endpoint, DTO field change, @Valid added, status code changed, new exception mapping) are now covered by `@WebMvcTest` tests owned by `java-backend-agent`.

`backend-integration-tests-agent` is reserved exclusively for:
1. Cross-layer flows where the real service + real repository must be exercised (no `@MockBean`)
2. Profile-specific wiring tests (H2 vs Postgres `@Profile` behavior)
3. Multi-controller sequences that accumulate shared in-memory state

## Summary

```
Domain/service behavior         → java-backend-agent    → JUnit 5 / Mockito
In-memory repository behavior   → java-backend-agent    → plain JUnit 5
Controller status/validation    → java-backend-agent    → @WebMvcTest  ← DEFAULT
DTO serialization / JSON shape  → java-backend-agent    → @WebMvcTest
Error response shape            → java-backend-agent    → @WebMvcTest
Cross-layer backend flow        → backend-integration-tests-agent → @SpringBootTest (justification required)
Profile-specific config/wiring  → backend-integration-tests-agent → @SpringBootTest (justification required)
Multi-controller shared state   → backend-integration-tests-agent → @SpringBootTest (justification required)
```
