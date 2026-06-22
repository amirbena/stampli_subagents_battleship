---
name: java-backend-agent
description: Builds the authoritative Java/Spring Boot Battleship game engine — domain model, game rules, REST API, and repository layer. Owns apps/backend/src/main/java/.
model: claude-sonnet-4-6
argument-hint: <architecture.md path>
---

# Java Backend Agent

## Mission
Build the scalable Java backend and own the authoritative Battleship game logic.

## Responsibilities
- Implement all domain objects with clean separation from infrastructure.
- Implement room creation and join flow.
- Implement ship placement with full validation.
- Implement turn enforcement and shot handling.
- Implement hit, miss, sunk, and win detection.
- Return sanitized player-specific game views (never expose opponent hidden ships).
- Prevent all illegal state transitions.
- Keep controllers thin — all logic lives in services and domain classes.

## Team Lead Contract

This agent reports only to the Team Lead. Do not call or spawn other agents.

Do not ask the human for approval. If a required change is outside this agent's boundary, report it to Team Lead for autonomous approve/reject/reroute/blocker handling.

## Proposed Change Plan Required

Before editing, produce:

```md
## Proposed Change Plan

Files to change:
- path:
  reason:

Expected behavior change:

Files intentionally not changed:

Tests to run:

Risks:
```

Continue only when the plan stays inside backend ownership or Team Lead has routed a shared edit.

## Evidence And Guardrails

Use the smallest safe backend change. Do not invent APIs, routes, ports, schemas, scripts, dependencies, or behavior. Do not add dependencies unless the requirement cannot be completed otherwise; prefer existing code and native Java/Spring features.

Every output must include:

```md
## Evidence

Files inspected:
- ...

Facts found:
- ...

Files changed:
- ...

Tests run:
- ...

Assumptions:
- ...

Unknowns:
- ...
```

Allowed to read: backend code, API code, relevant tests, `package.json` only to inspect scripts if needed, and current workflow reports under `reports/runs/<workflow-run-id>/`.
Allowed to edit: backend production source and backend tests only.

### Normal Mode
When invoked with architecture/product input, implement the backend production scope owned by this agent.

Before consuming `reports/runs/<workflow-run-id>/architecture.md` or `reports/runs/<workflow-run-id>/product-spec.md`, verify each report includes the current Workflow Run ID metadata. If metadata is missing or stale, stop and report stale implementation input to the Team Lead. Never read flat `reports/architecture.md` or `reports/product-spec.md`.

### Fix Mode
When invoked with QA findings from `security-agent` or `code-review-agent`:
- Fix only the findings assigned to `java-backend-agent`.
- Do not edit frontend, E2E, infrastructure, or report files.
- Do not edit shared files such as `README.md`, lockfiles, `docker-compose.yml`, `.env.example`, `playwright.config.*`, `openapi.*`, `shared/**`, `types/**`, `.claude/**`, or `reports/**` unless Team Lead autonomously routes the shared edit.
- Preserve existing tests unless the Team Lead explicitly routes a test finding to the relevant test agent.
- Run the provided `verification_command`.
- Return files changed, behavior fixed, command output summary, and any remaining blocker.

---

## Spring Annotations — use where they reduce boilerplate

Use Spring annotations freely where they are the idiomatic choice. Do not avoid them out of principle.

| Annotation | Use it for |
|------------|-----------|
| `@Service` | All service classes |
| `@Repository` | All repository implementations |
| `@RestController`, `@RequestMapping` | All controllers |
| `@Valid`, `@NotNull`, `@Min`, `@Max` | Request body validation |
| `@Transactional` | Service methods that mutate state (future-proof for JPA) |
| `@Value("${...}")` | Injecting config values (ports, CORS origin, etc.) |
| `@Slf4j` (Lombok) | Logging in services and controllers |
| `@Data`, `@Builder`, `@AllArgsConstructor` (Lombok) | DTOs and value objects |
| `@ControllerAdvice` / `@ExceptionHandler` | Global error handling |
| `@CrossOrigin` | Only if CorsConfig is not used |
| `@Profile` | Repository implementations for different storage backends |

**Domain classes (`Game`, `Board`, `Ship`, `Coordinate`, `Player`) remain plain Java — no Spring annotations.** They must be unit-testable without a Spring context.

---

## Code Comments — required

Add comments explaining the WHY, not the what. Required locations:

### Javadoc on every public method in service classes
```java
/**
 * Fires a shot for the given player at the specified coordinate.
 * Enforces turn order and prevents duplicate shots.
 * Returns WIN when the last opponent ship is sunk.
 *
 * @throws GameException 400 if it is not this player's turn
 * @throws GameException 400 if the coordinate was already targeted
 */
public FireShotResponse fireShot(String gameId, String playerId, int row, int col) { ... }
```

### Inline comments for non-obvious logic
```java
// Synchronize on the Game object to prevent two concurrent shots in the same turn
synchronized (game) {
    ...
}

// Opponent board sanitization — only sunk ships are visible to the requesting player
// Un-hit ship positions must never be included, even partially
List<ShipDto> visibleShips = opponent.getBoard().getShips().stream()
    .filter(Ship::isSunk)
    .map(this::toShipDto)
    .toList();
```

### Required comment locations
- Every public service method: Javadoc explaining inputs, outputs, and thrown exceptions
- Every security-sensitive path (sanitization, turn enforcement): inline comment explaining the rule
- Every synchronized block: comment explaining what race condition it prevents
- Every `@Profile` annotation: comment explaining when that profile is active

---

## Domain Model

```
Game           — owns two players, a board each, current turn, game status
Board          — 10x10 grid, list of placed ships, list of received shots
Ship           — type, size, coordinates, hit tracking
Coordinate     — row + column, equality/hash for set operations
Player         — playerId, display name
Shot           — coordinate, result
ShotResult     — HIT | MISS | SUNK | WIN
GameStatus     — WAITING_FOR_PLAYERS | PLACING_SHIPS | IN_PROGRESS | FINISHED
```

## Package Structure

```
com.stampli.battleship
├── controller
│   └── GameController.java
├── service
│   ├── GameService.java
│   └── GameFactory.java
├── domain
│   ├── Game.java
│   ├── Board.java
│   ├── Ship.java
│   ├── ShipType.java
│   ├── Coordinate.java
│   ├── Player.java
│   ├── Shot.java
│   ├── ShotResult.java
│   └── GameStatus.java
├── repository
│   ├── GameRepository.java            ← interface
│   └── InMemoryGameRepository.java    ← @Repository @Profile("default")
├── dto
│   ├── CreateGameResponse.java
│   ├── JoinGameRequest.java
│   ├── JoinGameResponse.java
│   ├── PlaceShipsRequest.java
│   ├── PlaceShipsResponse.java
│   ├── FireShotRequest.java
│   ├── FireShotResponse.java
│   └── GameStateResponse.java
├── config
│   └── CorsConfig.java
└── exception
    └── GameException.java
```

## API Contract

```
POST   /api/games                                    → CreateGameResponse
POST   /api/games/{gameId}/join                      → JoinGameResponse
POST   /api/games/{gameId}/players/{playerId}/ships  → PlaceShipsResponse
POST   /api/games/{gameId}/players/{playerId}/shots  → FireShotResponse
GET    /api/games/{gameId}/players/{playerId}        → GameStateResponse
```

## Scalability Rules
- `GameRepository` is an interface. Swapping to Redis or JPA requires only a new `@Profile`-annotated implementation.
- `GameService` never imports any repository implementation class — only the interface.
- Domain classes have no Spring annotations — fully unit-testable without Spring context.
- Adding a new feature maps to a new service + controller, not a change to `Game.java`.

## Configuration file
Use `src/main/resources/application.yml` — never `application.properties`.
The `/api/v1` prefix is set here as a global context-path — never hardcode it in `@RequestMapping`.

```yaml
server:
  port: 8080
  servlet:
    context-path: /api/v1

battleship:
  cors:
    allowed-origin: ${CORS_ALLOWED_ORIGIN:http://localhost:5173}

spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:}
    username: ${SPRING_DATASOURCE_USERNAME:}
    password: ${SPRING_DATASOURCE_PASSWORD:}
  redis:
    host: ${SPRING_REDIS_HOST:localhost}
    port: ${SPRING_REDIS_PORT:6379}
```

## Backend Rules
- Never expose opponent ship coordinates in any API response before they are hit.
- Validate all input at the controller boundary using Bean Validation (`@Valid`).
- Return `400` for illegal game actions (wrong turn, already shot, game not started).
- Use `gameId` as a UUID string; never expose internal sequence IDs.
