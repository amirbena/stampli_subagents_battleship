---
name: reopen-policy
description: Product Reopen and Architecture Reopen allow conditions, output block formats, reopen limits, and at-limit resolution. Loaded by Team Lead when reopening Product Agent (Step 10) or Architecture Agent (Step 11).
metadata:
  type: project
---

# Reopen Policy

Loaded by Team Lead from Step 10 when reopening Product Agent, and from Step 11 when reopening Architecture Agent.

## Non-Orchestrator Boundary

This file defines **allow conditions**, **output block formats**, **reopen limits**, and **at-limit resolution rules**.

Team Lead still owns:
- the decision to reopen Product or Architecture
- routing to Product Agent or Architecture Agent
- reading and applying the updated spec or architecture
- blocking implementation agents until reopen is resolved
- enforcing the reopen limits

Product Agent and Architecture Agent do not reopen themselves. All reopen decisions go through Team Lead.

## Shared Reopen Invariants

- Team Lead owns all reopen decisions.
- Product and Architecture do not reopen themselves or each other.
- **Reopen limit is 3 per run for Product.**
- **Reopen limit is 3 per run for Architecture.**
- Every reopen must be documented in the respective output block.
- Every reopen counts toward the limit regardless of trigger source: Architecture REQUIRES_CHANGES, Contract-Breaking escalation, QA failure, PR review feedback, or any other source.

---

## Product Reopen Policy

### Allow Conditions

Reopen Product Agent when any of the following is true:

- Acceptance criteria are missing or ambiguous
- QA exposes unclear product behavior
- Developer cannot safely infer behavior
- Two fix attempts fail because expected behavior is unclear
- PR review feedback affects product behavior

### Output Block Format

Document every Product reopen in `reports/runs/<workflow-run-id>/product-spec.md` under a `## Product Reopen` section:

```md
## Product Reopen

Reopen Number:
Reason:
Finding ID:
Evidence:
Question / Ambiguity:
Updated Product Decision:
Updated Acceptance Criteria:
Impact On Team Lead Plan:
Does Architecture Need Re-evaluation: Yes/No
```

### At-Limit Resolution

When Product has been reopened 3 times and ambiguity remains:

- **Safe assumption exists** → continue with the documented assumption; record the assumption in the Product Reopen block and in the PR summary.
- **No safe assumption exists** → hard blocker. Write `workflow-blocker.md`. Do not proceed to implementation, release, or PR.

---

## Architecture Reopen Policy

### Allow Conditions

Reopen Architecture Agent when any of the following is true:

- Planned approach cannot work with existing code
- API contract assumption is wrong
- Auth/session implications were missed
- Implementation exposed a missing technical boundary

### Output Block Format

Document every Architecture reopen in `reports/runs/<workflow-run-id>/architecture.md` under an `## Architecture Reopen` section:

```md
## Architecture Reopen

Reopen Number:
Reason:
Finding ID:
Evidence:
Previous Architecture Assumption:
Updated Architecture Decision:
Impact On Developer Assignments:
Impact On Tests:
Impact On Security:
Impact On Cost:
```

### At-Limit Resolution

When Architecture has been reopened 3 times:

- **Can continue safely** → document the architecture risk in the PR summary. Record the outstanding ambiguity and the chosen safe assumption.
- **Unsafe or impossible to proceed** → hard blocker. Write `workflow-blocker.md`. Do not proceed to implementation or release.
