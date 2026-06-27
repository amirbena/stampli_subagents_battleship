# Governance Findings Policy

## Purpose

Define how agents handle governance gaps discovered during execution without interrupting business delivery.

## Problem

During a business delivery run an agent may discover:
- Missing ownership definition
- Missing or ambiguous policy
- Missing or incorrect report structure
- Repeated execution friction
- Routing improvement opportunity
- Validation gap in the governance framework
- Governance inconsistency between policies or templates

The choices without this policy are unclear:
1. Ignore the issue — finding is lost.
2. Modify shared governance inline — pollutes the business PR, risks unreviewed governance changes.

Both are undesirable. This policy establishes a third path.

---

## Agent Behavior During Execution

### Permitted

Agents MAY:
- Identify a governance finding at any point during execution.
- Write a governance finding to `reports/runs/<workflow-run-id>/governance-findings-queue.md` using the format in `.claude/templates/governance-finding-template.md`.
- Continue business delivery immediately after emitting the finding.
- Improve their **own** SKILL.md, their **own** internal reporting patterns, or their **own** execution guidance — when ownership of the file is clearly local to that agent alone.

### Prohibited

Agents MUST NOT:
- Modify any shared governance file (`CLAUDE.md`, `.claude/policies/*.md`, `.claude/templates/*.md`, `.claude/metadata/*.md`, other agents' SKILL.md files) as part of a business delivery run.
- Route governance findings through the QA loop (Steps 8–9 in Team Lead SKILL.md). The QA loop is for code/test failures only.
- Block or delay business delivery on account of a governance finding unless `Blocks Current Delivery: Yes` (see below).
- Silently ignore a governance gap that meets the reporting threshold (Severity Medium or above).

### Reporting Threshold

Emit a governance finding when ALL of the following are true:
- The gap would cause confusion, incorrect routing, or a missing check for another agent or run.
- The severity is Medium or above (Low gaps may be omitted; include them if they took time to discover).
- The finding is in shared governance, not in the agent's own local execution scope.

---

## Governance Finding Format

Load `.claude/templates/governance-finding-template.md` for the full format and field definitions.

Required fields: Finding ID, Title, Severity, Category, Discovered By, Discovered During, Run ID, Description, Evidence, Suggested Improvement, Suggested Owner, Suggested Follow-Up Task, Blocks Current Delivery.

Finding ID format: `GF-<NNN>` starting from GF-001 per run. Use the next available number in `reports/runs/<workflow-run-id>/governance-findings-queue.md`.

---

## Governance Findings Queue

Each run has a local findings queue at:

```
reports/runs/<workflow-run-id>/governance-findings-queue.md
```

Team Lead initializes this file at the start of Step 6 (before spawning developer agents). If no governance findings are emitted during the run, Team Lead writes:

```md
# Governance Findings Queue

Run ID: <workflow-run-id>
Status: No findings emitted this run.
```

If findings are emitted, Team Lead appends each finding to this file using the template format and maintains a summary table at the top:

```md
# Governance Findings Queue

Run ID: <workflow-run-id>

| Finding ID | Severity | Category | Discovered By | Blocks Delivery | Status |
|---|---|---|---|---|---|
| GF-001 | High | Routing | java-backend-agent | No | Pending Team Lead Decision |
```

---

## Team Lead Responsibilities

### During Execution

Team Lead:
1. Initializes `governance-findings-queue.md` at the start of Step 6.
2. Collects governance findings from all agent reports during execution.
3. Appends each finding to the queue file, assigns a Finding ID, and records status.
4. Does NOT modify shared governance as part of the business delivery run.
5. Does NOT route governance findings through Steps 8–9.

### After Release (Step 14.5 — Governance Findings Review)

After `release-pr-agent` returns the PR URL, Team Lead reviews the queue and assigns one of the following dispositions to each finding:

| Disposition | Meaning | Team Lead action |
|---|---|---|
| `Ignored` | Finding is not actionable, already covered, or too low priority | Document reason in queue file |
| `Backlog` | Valid finding, low urgency | Leave in queue file for future reference |
| `Governance Task` | Valid finding, warrants a dedicated follow-up | Create a task description in queue file |
| `Governance Draft PR` | High severity, clear owner, specific change | Create a new governance branch and open a Draft PR |

Team Lead MUST assign a disposition to every finding before closing the run.

### When to Open a Governance Draft PR

Open a Draft PR for a governance finding when ALL of the following are true:
- Severity is High or Critical.
- The change is clearly scoped (one or two files, one clear owner).
- The change is safe to implement without a business delivery running concurrently.

A Governance Draft PR:
- Is created on a separate branch named `governance/<slug>` (e.g. `governance/missing-ownership-policy`).
- Contains only governance file changes — no application code.
- Is opened as a Draft with a description that references the source Finding ID and Run ID.
- Is never merged as part of the business PR.

---

## Self-Improvement Exception

An agent may make a local governance improvement without routing through Team Lead when ALL of the following are true:

1. The file being changed is the agent's own SKILL.md, its own internal template, or its own reporting structure.
2. No other agent reads or depends on the file.
3. The change does not affect routing decisions, ownership boundaries, or quality gates.
4. The agent records the change in its execution report Evidence section.

When any condition is uncertain, treat it as shared governance — emit a finding, do not modify.

---

## Architecture Constraint

Governance findings must never block business delivery unless `Blocks Current Delivery: Yes`. A blocking governance finding is treated as a workflow blocker only when the gap makes it impossible to safely release the current change (e.g. the gap is a missing security check that would expose user data in the current PR).

Non-blocking findings are always deferred to Step 14.5.

---

## Primary Loader

Team Lead loads this policy:
- At the start of Step 6, to initialize the governance findings queue.
- At Step 14.5, to assign dispositions and decide whether to open a governance Draft PR.

All execution agents load this policy when they discover a governance gap and need to decide whether to emit a finding or make a local improvement.
