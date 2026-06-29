# Requirement Intent Classification Policy

Team Lead loads this policy during Step 0.5 (Fast-Path Pre-Classification) to determine whether a requirement describes a **WHAT-change**, a **HOW-change**, or a **Governance Change** before applying fast-path routing or deciding which agents to spawn.

## Why Intent Matters

The word "refactor" may not appear in the requirement text. Intent must be inferred from what the requirement asks the system to do differently — not just from vocabulary. A requirement saying "convert all integration tests to unit tests" is HOW-only. A requirement saying "add ship placement validation" is WHAT. A requirement saying "update the agent ownership table in CLAUDE.md" is a Governance Change. Applying the wrong routing wastes agent time (full Product cycle on a policy update) or misses gates (no Architecture for a cross-layer restructure that touches the API).

## Intent Classification

### WHAT-Change — New or Extended Behavior

The requirement adds, changes, or removes a **user-visible outcome or system behavior**: the game plays differently, the API returns different data, users see something new, or a rule changes.

**Signal phrases:** "add", "allow", "prevent", "show", "hide", "validate", "the user should be able to", "the system should now", "return X to the client", "new screen", "new endpoint", "new game rule", "change how X feels to the user"

**Routing:** Before routing to Product Agent, determine the audience of the behavior change. See the DevEx sub-type below.

---

### DevEx WHAT-Change — Developer-Experience or Local-Tooling Behavior

A requirement can be a WHAT-change because it changes real system behavior, but **not** a Product-change because the audience is exclusively developers running local tooling — not end-users of the deployed application.

**Developer-facing behavior is not automatically Product behavior.**

**Signal subjects:** `.run/*` local launchers, startup scripts, Docker local-dev behavior, CI/test tooling, developer-only health checks, local port management, local process lifecycle, build/package scripts, developer-visible terminal output, local-dev documentation, repository governance, agent governance.

**All of these must be true for a DevEx WHAT-change classification:**
1. The requirement changes system behavior visible or relevant only to developers running the project locally.
2. No end-user product/game/application behavior changes — nothing a player sees in a browser is affected.
3. No gameplay, multiplayer, session, or auth domain is involved.
4. Acceptance criteria are already stated in operational/technical terms (e.g. "port free → start normally") — no product-semantic interpretation pass is needed to make them testable.
5. Remaining ambiguity is technical or architectural, not product/user-flow ambiguity.

**Routing:** Apply Team Lead fast-path Trigger 5 (see `.claude/skills/team-lead/SKILL.md` Step 0.5). Product Agent is skipped. Architecture still runs if a new endpoint, route, shared contract, or system boundary decision is involved. Infrastructure and Backend are the primary implementation owners.

**Examples of DevEx WHAT-changes (Product skipped):**
- Preventing duplicate local backend startup when `./run` is called while a backend is already running
- Adding a health endpoint used only by local startup scripts for backend identity detection
- Updating README with local startup instructions or local port configuration
- Changing local Docker Compose port mappings
- Improving CI cache, test commands, or build tooling
- Adding developer-only startup messages or terminal diagnostics

**Counter-examples (not DevEx — Product runs):**
- Adding a new game feature visible to players
- Changing when a player can fire or how a turn transitions
- Adding user-visible error messages in the browser app
- Any API response change that alters what the game client renders for a player

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

### Governance Change — Non-Delivery Repository Change

The requirement changes **factory governance artifacts only**: policies, ownership tables, routing rules, agent contracts, governance documentation, or reporting templates. It does not change product behavior, runtime behavior, API behavior, user-facing behavior, or any application feature.

**This is not delivery work.** Product Agent, Architecture Agent, and delivery-agent orchestration are skipped by default. A branch, commits, and a PR are still required. Lightweight review still applies.

**Signal subjects:**
- `.claude/policies/**` — routing rules, ownership policies, test policies, coding standards
- `.claude/metadata/**` — governance metadata, review validity schemas
- `.claude/templates/**` — reporting templates, classification templates
- `.claude/runbooks/**` — governance runbooks
- `.claude/skills/<agent>/SKILL.md` — agent contract updates, agent behavioral rules
- `CLAUDE.md` — factory-level governance, agent table, quality gate definitions, intent classification rules
- Governance README files — factory documentation, workflow documentation
- Ownership documentation — agent responsibility tables, file ownership maps
- Reporting templates — team-lead-classification, release summary, findings queue

**All of the following must be true for a Governance Change classification:**
1. The change modifies only governance artifacts — none of the changed files are application runtime code, application tests, API definitions, frontend components, or backend domain/service/controller code.
2. No product behavior changes — nothing a player sees or experiences in the application is affected.
3. No runtime behavior changes — no server, API endpoint, frontend component, or database interaction is altered.
4. No API contract changes — no request/response fields, status codes, or endpoint paths are modified.
5. The change is self-contained within the factory's operating rules, not the factory's output.

**When ambiguous (e.g. a SKILL.md change that also changes how an agent calls an API endpoint), default to the standard delivery path.**

**Architecture review exception:** Architecture Agent is not required by default for Governance Changes. However, limited Architecture review **is** required when the governance change affects:
- cross-agent contracts (e.g. how Team Lead invokes an agent changes)
- routing invariants that affect which agents are spawned for delivery requirements
- the ownership model for a system boundary (e.g. which agent owns a shared file)
- delivery-path semantics (e.g. changing when E2E mode is Full vs Smoke)

When Architecture review is required for a Governance Change, the Architecture Agent's scope is limited to **governance consistency verification** — not product architecture. No AC-to-Test Coverage Matrix is produced.

**Examples of Governance Changes:**
- Updating agent ownership tables in CLAUDE.md
- Adding a new policy to `.claude/policies/`
- Updating a fast-path trigger's sub-conditions in this policy
- Editing a SKILL.md to clarify an agent's responsibility boundary (no runtime code change)
- Adding a governance findings template to `.claude/templates/`
- Updating the reporting README in `.claude/`
- Correcting routing documentation for a workflow step

**Counter-examples (not Governance Changes — use standard delivery or HOW path):**
- Any change to `apps/backend/src/` or `apps/frontend/src/` — always delivery work
- Adding a new REST endpoint, even if documented in a SKILL.md
- Changing a SKILL.md in a way that causes an agent to call a different API or write different runtime code
- Infrastructure changes affecting how the application runs (`docker-compose.yml`, `.run/*` scripts)
- Dependency changes affecting runtime architecture (`pom.xml`, `package.json`)
- Any change to application tests (`*Test.java`, `*.test.ts`, `*.spec.ts`)

**Routing:** Apply Team Lead fast-path Trigger 6 (Governance Change). See Step 0.5 of `team-lead/SKILL.md`. Product Agent skipped. Architecture Agent skipped by default (conditional exception above). No delivery-agent orchestration. Direct execution. Branch + commit + PR required.

---

### Ambiguous — Treat as Standard Path

When the requirement could be read as either a WHAT-change or a HOW-change (e.g. "improve the loading screen", "make game state management cleaner"), treat as a WHAT-change and run the standard path. The cost of running Product Agent on a refactor is lower than the cost of missing a behavioral gate.

When the requirement could be read as either a Governance Change or a delivery change (e.g. "improve how the factory handles multiplayer requirements"), treat as a WHAT-change and run the standard delivery path. The cost of running the full delivery factory on governance work is wasted agent time; the cost of misrouting a delivery requirement onto the governance path is a PR that bypassed Product and Architecture. Default to the delivery path when uncertain.

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

Intent: WHAT-change / DevEx WHAT-change / HOW-change / Governance Change / Ambiguous
Reason: <1 sentence explaining the primary signal>
DevEx Sub-type: Yes / No — <if Yes: all 5 DevEx conditions met; Product skipped; Architecture if contract change>
Governance Change: Yes / No — <if Yes: all 5 Governance Change conditions met; Product skipped; Architecture skipped (or: Architecture required for governance consistency — reason)>
Refactor Scope: test-only / single-layer / cross-layer / domain-model / full-flow / N/A
Contract Change Detected: Yes / No
Contract Change Reason: <if Yes — which fields, endpoints, or status codes change>
```
