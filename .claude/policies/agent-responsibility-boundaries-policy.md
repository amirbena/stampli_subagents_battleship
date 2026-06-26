# Agent Responsibility Boundaries Policy

Used by: Requirement Intake, Product Agent, Architect Agent, Team Lead.
Load when any question arises about which agent owns a type of decision.

---

## Responsibility Map

### Requirement Intake
**Owns:** Capturing and expanding customer intent into user-facing language.

**May define:**
- Raw user request (verbatim)
- User-visible behavior description
- User journey
- Product-level scope
- Product-level risks and ambiguities
- User-facing acceptance criteria phrased in observable terms

**Must NOT decide or mention as decisions:**
- Storage technology (`localStorage`, `sessionStorage`, Redis, in-memory, database)
- Repository patterns (`InMemoryGameRepository`, etc.)
- Backend enum values (`PAUSED`, `STOPPED`, enum names)
- API endpoint paths or payload shapes
- Frontend implementation mechanism
- Test frameworks or test types
- E2E mode (`Full E2E`, `Smoke E2E`, `None`)
- Quality gates or agent routing
- `Architecture Required: Yes`
- Frontend/backend split decisions

**Correct wording example:**  
✅ "The game should survive browser refresh, tab close, and later return in the same browser."  
❌ "Use localStorage to persist the game state across refreshes."

**Correct wording example:**  
✅ "The player should be able to continue an existing game."  
❌ "Add `GET /players/{id}/active-game`."

**Rule:** Expand user intent; do not design the solution.

---

### Product Agent
**Owns:** Product semantics — what users experience, not how it is implemented.

**May define:**
- Product intent and user problem
- UX behavior and user flows
- Pause / Resume / Stop semantics (user-facing)
- HUMAN vs COMPUTER behavior (observable only)
- Opponent-facing behavior
- Direct URL / hard refresh / Home-only entry behavior
- Product edge cases and error states
- User-facing acceptance criteria (observable by users)

**May note as hints only (not decisions):**
- Classification hints for Team Lead (e.g. "likely requires E2E", "likely multiplayer-sensitive")
- QA notes describing which behaviors seem integration-critical

**Must NOT finalize or decide:**
- API endpoints or request/response shapes
- Backend enum names or structures
- Repository implementations
- Redis, database, or in-memory storage
- `localStorage` / `sessionStorage` decisions
- Test framework selection
- E2E mode (`Full E2E`, `Smoke E2E`, `None`)
- npm commands, build commands, quality gates
- Security or code-review approval as acceptance criteria
- `npm run build passes` as a product acceptance criterion
- `All tests pass` as a product acceptance criterion

**Product must never prescribe:**
- Files or line numbers
- Components, props, hooks, or state variables
- DTOs, backend fields, or API implementation details
- Code snippets or framework-specific logic
- Exact frontend/backend implementation strategies
- Exact test files or test-framework internals

**Product implementation notes are non-binding.** Product may inspect technical evidence when necessary, but any technical observations Product makes are non-binding evidence — not an implementation plan. Execution agents must inspect the code and choose the smallest safe implementation.

**Rule:** Product defines what the user should experience, not how the code must implement it.

**Correct wording example:**  
✅ "The game should survive browser restart in the same browser."  
❌ "Use localStorage to persist game state across browser restarts."

**Correct wording example:**  
✅ "'🎯 Your Turn — Fire!' means the player can fire now. Hide it after firing and show it again only when the player can fire again."  
❌ "Update `TurnIndicator.tsx`, pass the `firing` prop from `Game.tsx`, and inspect `currentTurnPlayerId`."

**Product acceptance criteria must describe user-observable behavior only.**  
Criteria like "All tests pass", "npm run build passes", "Code Review APPROVED", "Full E2E is required"
are Team Lead / QA gates — not product acceptance criteria. If Product wants to flag verification
concerns, use `## QA Notes` only, not the acceptance criteria list.

---

### Architect Agent
**Owns:** Technical contracts and implementation strategy.

**May decide:**
- API endpoint paths, methods, request/response shapes
- Domain model design and invariants
- Repository interface and implementation strategy
- State machine transitions and backend enum values
- Storage selection (in-memory, Redis, DB) when justified
- Frontend/backend boundary
- Test strategy per layer
- Whether WebSocket is needed

**Must NOT:**
- Invent missing product semantics (user flows, UX behavior, opponent behavior)
- Resolve product-level ambiguities silently
- Assume behavior Product did not define
- Return `APPROVED` when product decisions are still open

When Architecture discovers a missing or conflicting product-semantic decision:
→ Architecture must return `REQUIRES_CHANGES` to Team Lead (see Architecture REQUIRES_CHANGES Routing below).

---

### Team Lead
**Owns:** Routing, gates, decision flow, and release.

**Responsibilities:**
- Classifying requirements and assigning agents
- Running quality gates and controlling the QA loop
- Resolving routing questions (not behavior questions)
- Making branch and PR decisions
- Stopping and recovering from blockers

**Must NOT:**
- Invent product behavior
- Override Architecture decisions on technical contracts
- Skip gates without documented reason

---

## Architecture REQUIRES_CHANGES Routing

When Architecture discovers a product-semantic gap (behavior Product did not define):

1. Architecture returns `REQUIRES_CHANGES` to Team Lead with:
   - The specific missing product question
   - Why Architecture cannot safely assume the answer
   - Which acceptance criteria or user flows are affected
   - Which architecture decisions depend on the answer
2. Team Lead stops Architecture finalization.
3. Team Lead reopens Product Agent with the specific gap identified.
4. Product updates `product-spec.md` with the missing decision.
5. Architecture resumes only after the refreshed Product Spec is available.
6. Backend and frontend implementation agents remain blocked until Architecture is finalized.

**Examples that must trigger this path:**
- Product does not define opponent-facing behavior in HUMAN vs HUMAN mode
- A shared action affects another player but Product did not specify the UX
- Pause / Stop semantics have multiplayer consequences Product did not address
- Stop/delete/abandon behavior affects another participant
- Direct URL / hard refresh / Home-only behavior is unclear or contradictory
- Phase-specific resume behavior is undefined
- Architecture cannot choose between two valid technical designs without a product decision
- Architecture would otherwise need to invent user-facing behavior

See also: `.claude/skills/architect-agent/SKILL.md` for the `REQUIRES_CHANGES` finding format.
See also: `.claude/skills/team-lead/SKILL.md` Step 3 for the routing row.
