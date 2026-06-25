# Requirement Intent Classification Policy

Team Lead loads this policy during Step 0.5 (Fast-Path Pre-Classification) to determine whether a requirement describes a **WHAT-change** or a **HOW-change** before applying fast-path routing or deciding which agents to spawn.

## Why Intent Matters

The word "refactor" may not appear in the requirement text. Intent must be inferred from what the requirement asks the system to do differently — not just from vocabulary. A requirement saying "convert all integration tests to unit tests" is HOW-only. A requirement saying "add ship placement validation" is WHAT. Applying the wrong routing wastes agent time (full Product cycle on a test-only change) or misses gates (no Architecture for a cross-layer restructure that touches the API).

## Intent Classification

### WHAT-Change — New or Extended Behavior

The requirement adds, changes, or removes a **user-visible outcome or system behavior**: the game plays differently, the API returns different data, users see something new, or a rule changes.

**Signal phrases:** "add", "allow", "prevent", "show", "hide", "validate", "the user should be able to", "the system should now", "return X to the client", "new screen", "new endpoint", "new game rule", "change how X feels to the user"

**Routing:** Standard path applies. Product Agent runs (Full or Light based on UX risk). Architecture required if contract changes.

---

### HOW-Change — Same Outcome, Different Mechanism

The requirement changes **how the code is structured or implemented** without changing user-visible outcomes, API contracts, or game rules. The end result for users is identical.

**Signal phrases:** "convert", "replace X with Y", "extract", "move", "rename", "restructure", "swap implementation", "migrate from X to Y", "change all X to Y" (where X and Y are technical choices, not behaviors), "refactor", "clean up", "reorganize"

**Example requirements that are HOW-changes:**
- "Convert all integration tests to unit mocks where appropriate"
- "Extract the board logic from GameService into a separate BoardService"
- "Rename all controller methods to snake_case"
- "Move from HTTP polling to WebSocket for game updates" (same user experience, new mechanism)

**Routing:** Refactor candidate. Apply the Refactor Scope Classification below before deciding which agents to spawn.

---

### Ambiguous — Treat as Standard Path

When the requirement could be read as either a WHAT-change or a HOW-change (e.g. "improve the loading screen", "make game state management cleaner"), treat as a WHAT-change and run the standard path. The cost of running Product Agent on a refactor is lower than the cost of missing a behavioral gate.

---

## Refactor Scope Classification

When intent is HOW-change, classify the scope to determine which agents are required:

| Scope | Definition | Product Required | Architecture Required | Agents |
|-------|-----------|------------------|-----------------------|--------|
| **Test-only** | Converts, rewrites, or reorganizes tests only — no production code change | No | No | Owner test agent only (e.g. `java-backend-agent` for backend test refactors) |
| **Single-layer** | Renames, extracts, or restructures within one isolated layer — no contract or API change | No | No | Owner agent only |
| **Cross-layer** | Restructures how two layers connect (e.g. service→controller boundary, hook→component wiring) — no API contract change visible to clients | No | Yes — sign-off on internal boundary change | Both layer owners; may run in parallel |
| **Domain-model** | Changes domain class structure (`Game`, `Board`, `Ship`) — fields, methods, invariants, new rules | No | Yes — domain model is source of truth for backend and may cascade to API surface | `java-backend-agent`; frontend may need update if API surface changes |
| **Full-flow** | Replaces a mechanism that spans the full stack (e.g. polling → WebSocket, in-memory → persistent storage) — may change the API surface | Yes — confirm user-visible behavior is preserved | Yes | All affected layers; E2E mode likely Full |

## Contract-Change Escalation

A HOW-change that **also** changes an API contract is no longer purely HOW — it has WHAT-change implications for downstream consumers (frontend, external clients).

**Contract change signals (inside a refactor):**
- A new field appears in any REST response
- A field is renamed or removed from any REST response
- A new endpoint is added even if it replaces an existing one
- HTTP status codes change
- A parameter becomes required that was previously optional (or vice versa)

When a refactor introduces a contract change:
1. Reclassify scope to `backend-and-frontend` or `full-stack-complex`.
2. Architecture Agent is required: the API contract is the cross-layer boundary that must be explicitly designed.
3. Architect must update or create the AC-to-Test Coverage Matrix for the new/changed contract.
4. E2E mode escalates to Full.

A refactor that swaps an internal implementation detail with **no change to the API surface** does not trigger contract-change escalation even if it is cross-layer.

## Required Output

Record in `reports/runs/<workflow-run-id>/team-lead-classification.md`:

```md
## Intent Classification

Intent: WHAT-change / HOW-change / Ambiguous
Reason: <1 sentence explaining the primary signal>
Refactor Scope: test-only / single-layer / cross-layer / domain-model / full-flow / N/A
Contract Change Detected: Yes / No
Contract Change Reason: <if Yes — which fields, endpoints, or status codes change>
```
