# Spring Test Runtime Policy

## Default: @WebMvcTest for Controller Tests

`@WebMvcTest` is the **default** annotation for all controller-layer tests. Use it for:
- HTTP status code correctness
- JSON response serialization
- Request body validation (`@Valid`, `@NotNull`, `@Size`, `@Min`, `@Max`)
- Error response shape (`{ "error": "..." }`)
- Path variable and query parameter handling
- Exception handler mapping (`@ControllerAdvice` / `@ExceptionHandler`)

`@WebMvcTest` boots only the web layer (~5s). Services are mocked with `@MockBean`. It is the correct tool for testing the controller contract without the cost of a full Spring context.

**Owner: java-backend-agent**

```java
@WebMvcTest(GameController.class)
class GameControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GameService gameService;

    @Test
    void fireShot_returnsHit_whenCoordinateIsOccupied() throws Exception {
        when(gameService.fireShot(...)).thenReturn(FireShotResponse.hit(...));

        mockMvc.perform(post("/api/v1/games/{id}/players/{pid}/shots", gameId, playerId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"row\": 3, \"col\": 4}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.result").value("HIT"));
    }
}
```

## Exception: @SpringBootTest Requires Explicit Justification

`@SpringBootTest` boots the full Spring application context (~45s). It is expensive and reserved for scenarios that genuinely require the full context — i.e. scenarios `@WebMvcTest` cannot cover.

**Owner: backend-integration-tests-agent**

### Allowed triggers for @SpringBootTest

The following are the only accepted justifications. Each class must document which trigger applies.

| Trigger | Why @WebMvcTest is not enough |
|---------|-------------------------------|
| Cross-layer flow: real request → service → repository → response chain | Service is not mocked; test must exercise the real wiring end-to-end |
| Profile-specific Spring configuration (e.g. H2 vs Postgres `@Profile`) | `@WebMvcTest` does not activate `@Profile`-annotated beans |
| Multiple controllers sharing in-memory state in one test sequence | `@WebMvcTest` is scoped to a single controller |
| Runtime behavior that only emerges with live Spring context wiring | Requires full environment-specific injection |

### Justification required (mandatory class-level comment)

Every `@SpringBootTest` class must include a Javadoc comment explaining why `@WebMvcTest` was insufficient:

```java
/**
 * Full-context integration test.
 *
 * @WebMvcTest is not sufficient here because: the test must exercise the real
 * GameService + InMemoryGameRepository wiring without mocking — specifically to
 * verify that the in-memory state accumulates correctly across the
 * POST /games → POST /games/{id}/join → POST /games/{id}/players/{id}/ships chain.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("e2e")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class GameControllerIntegrationTest {
```

If the justification is missing or does not match an allowed trigger, Team Lead must route the class back to the owning agent for refactoring to `@WebMvcTest`.

## Decision Guide

```
Testing controller status code, JSON, @Valid, error shape?
  └─ @WebMvcTest  (java-backend-agent)  ← DEFAULT

Testing real request → service → repository → response chain?
  └─ @SpringBootTest  (backend-integration-tests-agent)  + justification

Testing profile-specific wiring or multi-controller state?
  └─ @SpringBootTest  (backend-integration-tests-agent)  + justification

Testing domain or service logic only (no HTTP, no Spring context)?
  └─ Plain JUnit 5 + Mockito  (java-backend-agent)
```
