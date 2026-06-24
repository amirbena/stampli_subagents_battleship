# Java Coding Standards
# Shared by: java-backend-agent, backend-integration-tests-agent
# Load when writing or reviewing Java production or test code.

## Field Injection — @Autowired on its own line

```java
// correct
@Autowired
private MockMvc mockMvc;

// wrong — never inline with the declaration
@Autowired MockMvc mockMvc;
```

Visibility: `private` by default. `protected` only when a subclass needs access. Package-private (no modifier) only when intentionally scoped to the same package.

## Constructors — use Lombok, never boilerplate

```java
// correct — let Lombok generate the constructor
@AllArgsConstructor
public class GameService {
    private final GameRepository gameRepository;
    private final ComputerPlayerService computerPlayerService;
}

// wrong — never write boilerplate constructors manually
public GameService(GameRepository r, ComputerPlayerService c) {
    this.gameRepository = r;
    this.computerPlayerService = c;
}
```

- `@AllArgsConstructor` — all fields need injection
- `@RequiredArgsConstructor` — only `final` fields need injection
- `@NoArgsConstructor` — no-arg constructor required (e.g. JPA entities)
