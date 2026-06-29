---
name: contract-breaking-escalation-policy
description: Evidence list, contract scope classification, validation mode escalation rules, required validation layer table, Product/Architecture re-trigger conditions, and documentation requirements for contract-breaking findings discovered post-implementation.
metadata:
  type: project
---

# Contract-Breaking Evidence Escalation Policy

Loaded by Team Lead from Step 9 (QA Loop) whenever any agent reports that a contract changed post-implementation and this was not known at initial classification time (Step 2).

## Non-Orchestrator Boundary

This file defines **evidence**, **classification rules**, **escalation rules**, and **documentation requirements**.

Team Lead still owns:
- routing the fix to the responsible agent
- re-running tests after escalation
- agent spawning and sequencing
- retry loops and delta review loops
- Security closure loops
- validation sequencing
- release readiness and release gates

Extracted policy files must not become orchestrators. This file is a rules and classification reference, not a second decision engine.

## Key Principle

Validation mode is plan-owned, but contract-breaking evidence can force validation escalation. Preserve validation mode while the change remains narrow. Escalate validation mode when evidence proves the change was not narrow.

## Terminal Rules (always enforced)

These rules apply regardless of mode, route, or CVE status:

1. **Validation may only be strengthened** based on new contract-breaking evidence.
2. **Validation must never be silently downgraded** after a contract-breaking finding.
3. **Full E2E does not replace lower-level integration/contract tests** needed to prove the broken boundary is fixed.
4. **E2E remains governed only by the E2E Decision Rule** — contract-breaking evidence triggers the *validation mode escalation*, but E2E itself is only added when the E2E Decision Rule confirms it is required for the escalated scope.

## Contract-Breaking Review Is Evidence-Triggered, Not CVE-Triggered

**Contract-breaking review is evidence-triggered, not CVE-triggered.** Contract-breaking evidence escalation applies to **any** finding source. CVE remediation is one consumer of this policy, not the owner. The trigger is evidence of a contract change post-implementation, regardless of its origin:
- Code Review finding
- QA/test failure
- Playwright failure
- Security finding
- Product or Architecture finding
- Implementation agent report

A non-CVE Code Review returning `Contract Breaking: Yes` follows the same escalation path as a CVE-triggered one.

---

## 1. Contract-Breaking Evidence List

Evidence of a contract change post-implementation includes, at minimum:

- API request or response shape changed (field added, removed, renamed, or retyped)
- HTTP status code changed
- Backend serialization/deserialization behavior changed
- Frontend hook, API-client, or state interface changed
- Frontend/backend integration contract changed
- Persistence/data contract changed (schema, model, query behavior)
- Auth/authz behavior changed (session, token, permission, role semantics)
- Runtime behavior changed in a way callers depend on
- Deployment/startup/container health contract changed
- Build artifact or generated artifact behavior changed
- Game rule, state machine, turn-order, session, multiplayer, or hidden-data contract changed
- User-facing behavior or acceptance criteria drifted (user-visible outcome changed)

Team Lead identifies contract-breaking evidence from the `Contract Breaking: Yes` field in Code Review findings, or from explicit root-cause descriptions in QA, Playwright, Security, Architecture, or implementation-agent reports.

---

## 2. Evidence Source List

Contract-breaking evidence may arrive from any of these sources:

| Source | Field or signal |
|---|---|
| Code Review | `Contract Breaking: Yes` field in finding |
| QA / test failure | Root-cause description mentioning a changed contract boundary |
| Playwright failure | Root-cause: API field mismatch, HTTP status changed, hook signature changed |
| Security | Runtime behavior or auth/authz contract changed |
| Product | Acceptance criteria drifted; user-visible behavior changed without AC update |
| Architecture | API contract, persistence, or system boundary changed post-design |
| Implementation agent | Self-reported contract change in evidence section |

---

## 3. Escalation Procedure — Steps 1–6 and 9–10

Team Lead applies these steps. Steps 7 and 8 are Team Lead orchestration actions that remain inline in SKILL.md.

### Step 1 — Read the contract-breaking evidence

Identify the broken contract type from the finding or root-cause description.

### Step 2 — Classify contract scope

| Scope | Description | Consequence |
|---|---|---|
| **Frontend-only** | Hook shape, component state, routing, client-side validation | Require frontend integration/API-client tests if not already present |
| **Backend-only** | Service logic, persistence internals, serialization internal to backend | Require backend integration/contract tests if not already present |
| **Frontend + Backend** | API response shape, HTTP status code, serialization format visible to clients, state machine visible across boundary | Escalate E2E mode to Full E2E (real backend on port 8081) if not already Full |
| **Multiplayer / Architecture-level** | Game rules, hidden data visibility, session, turn order, multiplayer flow | Escalate to Full E2E + reopen Architecture |

### Step 3 — Escalate validation mode

Validation may only be strengthened, never weakened:

| From | To | Gate additions |
|---|---|---|
| `cheap` | `normal` | Add unit tests + full Code Review + Smoke E2E minimum |
| `normal` with Smoke E2E | `full` | Switch to Full E2E (real backend on port 8081); pass E2E Infrastructure Pre-Gate before spawning Playwright |
| `full` with Full E2E already running | No mode escalation needed | Continue at current mode |

### Step 4 — Select required validation layer(s)

Full E2E does not replace lower-level integration/contract tests when those are the correct proof that the broken boundary is fixed:

| Broken contract type | Required validation layer(s) |
|---|---|
| API contract break | API/contract tests + backend integration tests + frontend API/client integration tests if frontend consumes the shape + Full E2E if critical user path is affected |
| Frontend/backend integration break | Frontend API/client integration tests + backend integration tests as needed + Full E2E if critical user path is affected |
| Backend serialization/runtime break | Backend integration/contract tests + Full E2E if user-visible flow is affected |
| Persistence/data contract break | Repository/service integration tests + migration/data consistency checks where relevant + Full E2E if user-visible data flow is affected |
| Auth/security behavior break | Security/auth integration tests + Full E2E login/session/permission flow if user-facing |
| Deployment/startup/container contract break | Deployment/startup/container/health validation + Architecture review if topology/startup contract changed + Full E2E if app availability or user path is affected |
| Critical user-flow break | Full E2E required after fix + targeted integration tests for the broken boundary if identifiable |
| User-facing behavior or acceptance criteria drift | Product review + acceptance criteria update/confirmation + relevant user-flow validation |

### Step 5 — Re-trigger Product Agent conditions

Re-trigger Product Agent when the finding affects or may affect:
- User-facing behavior, UX, acceptance criteria, product semantics
- User-visible error handling
- External API behavior visible to consumers
- Game flow, login, onboarding, critical user path behavior
- Expected user outcome

Do NOT re-trigger Product for purely internal implementation issues with no user-facing or acceptance-criteria impact.

Counts toward the 3-reopen limit (see `reopen-policy.md` → `## Product Reopen Policy`).

### Step 6 — Re-trigger Architecture Agent conditions

Re-trigger Architecture Agent when the finding affects or may affect:
- API/service contracts
- Runtime boundaries
- Frontend/backend integration boundary
- Persistence/data model
- Serialization/deserialization contracts
- Auth/authz behavior
- Networking/integration behavior
- Deployment/startup topology
- Observability contract
- Ownership/maintainability boundaries
- Major dependency/runtime behavior change
- Cross-cutting libraries/shared infrastructure

Do NOT re-trigger Architecture for purely local implementation issues with no contract, boundary, runtime, or maintainability impact.

Counts toward the 3-reopen limit (see `reopen-policy.md` → `## Architecture Reopen Policy`).

### Step 9 — Require broader Code Review conditions

Require broader Code Review (not delta) if the fix:
- Changes contracts
- Changes multiple layers
- Changes runtime behavior
- Changes build/deployment behavior
- Changes user-facing behavior

### Step 10 — Document in Finding Registry and release summary

Record in Finding Registry and release summary:
- Original validation mode
- Escalated validation mode (or "no escalation needed" with reason)
- Evidence that triggered escalation
- Whether Architecture or Product was re-triggered

---

## 4. Product/Architecture Conflict Resolution

When both Architecture Impact: High and Product Impact: High:

1. Architecture runs first (technical contract/boundary resolution).
2. Product runs after Architecture guidance.
3. If Product and Architecture produce conflicting guidance → Team Lead writes `workflow-blocker.md`, stops. Agents do not resolve Product/Architecture conflicts directly.

When Security impact is also present:
- Architecture runs first if the Security question depends on contract or boundary decisions.
- Security closure/deeper review runs after Architecture guidance when closure assumptions depend on the contract.
- Security-blocking findings always stop forward progress regardless of Product/Architecture status.

---

## 5. Summary of Terminal Rules

These rules must never be compromised regardless of mode, CVE status, or time pressure:

- Validation may only be strengthened based on new contract-breaking evidence.
- Validation must never be silently downgraded after a contract-breaking finding.
- Full E2E does not replace lower-level integration/contract tests needed to prove the broken boundary is fixed.
- If root cause is unclear or potentially multi-layer, escalate to Full E2E as a precaution and require targeted integration tests once the broken boundary is identified.
- E2E remains governed only by the E2E Decision Rule — this policy escalates validation mode; it does not directly trigger E2E.
