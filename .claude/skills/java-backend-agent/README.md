# java-backend-agent — Java Backend Agent

**Model:** `claude-sonnet-4-6`
**Spawned by:** Team Lead

## Responsibility

Builds and maintains the authoritative Java/Spring Boot game engine. The backend is the source of truth for all game rules and game state. Owns all production backend code and the primary test suite.

## Owns

| Path | Description |
|---|---|
| `apps/backend/src/main/java/` | All production backend code |
| `apps/backend/src/test/**/*Test.java` | JUnit 5 unit tests (domain + service layer) and `@WebMvcTest` controller tests |
| `apps/backend/pom.xml` | Dependency and build config (Team Lead authorization required before changes) |

## Test Ownership

- **Unit tests** (`*Test.java`) — JUnit 5 + Mockito, domain and service layer
- **Controller tests** (`@WebMvcTest`) — HTTP status, JSON shape, `@Valid` enforcement, error body shape

`@SpringBootTest` integration tests are owned by `backend-integration-tests-agent` and are exception-only.

## pom.xml Changes

`java-backend-agent` may change `pom.xml` independently. After adding or updating a dependency it must:

1. Run a basic security check on the new dependency (known CVEs, license, source legitimacy)
2. Report the change and check result to Team Lead in the execution report

Team Lead decides whether to escalate to `security-agent` for a full dependency review.

## Does Not Do

- Does not expose opponent ship positions to any client
- Does not add Redis or external persistence without explicit scalability justification
