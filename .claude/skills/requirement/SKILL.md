---
name: requirement
description: Autonomous requirement intake. Creates a fresh run-isolated workflow run, writes requirements.md, guards branch safety, and hands off to Team Lead without interactive approval.
model: claude-opus-4-8
argument-hint: optional - paste the requirement inline
---

# Requirement Intake

## Mission
Capture the user's request, create a fresh isolated Workflow Run, write `reports/runs/<workflow-run-id>/requirements.md`, and hand off to Team Lead autonomously.

Human involvement is limited to final PR review. Do not ask follow-up questions during execution. If safe autonomous execution is impossible, write `reports/runs/<workflow-run-id>/workflow-blocker.md` and stop.

## Step 0 — Image and File Analysis (run BEFORE everything else)

Before creating any workflow files, scan the current conversation turn for attached images or files.

### Detect attachments

Look for any image paths (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`) or other file paths referenced or rendered in the user's message.

### If images are found

For **each image**, use the `Read` tool to load it (Claude will render it visually). Then analyze:

1. **What is visible** — describe the screen, layout, or UI state shown
2. **Visual defects** — identify specific problems: misalignment, overflow, wrong spacing, broken layout, unstyled elements, visual asymmetry, elements that don't align with adjacent ones
3. **Affected elements** — name the specific DOM elements, CSS classes, or layout areas that look wrong (e.g. `.lobby-layout`, the `h1`, the `.fleet-list-panel`)
4. **Root cause hypothesis** — what CSS property or structural issue is most likely causing it
5. **Expected state** — what "correct" would look like

Write the result as a `## Visual Analysis` section in `requirements.md` using the format below. This section is **primary evidence** — it is passed to the implementation agent and takes precedence over inferred criteria when there is any ambiguity.

### If non-image files are found

Read each file and summarize what it contains and how it relates to the requirement.

### If no attachments exist

Skip this step entirely. Proceed to Step 1.

---

### Visual Analysis format

```md
## Visual Analysis

### Screenshot <N>: <short description e.g. "desktop 1366px" or "mobile 390px">

**What is visible:**
<describe the current rendered state>

**Visual defects found:**
| Element | Problem | Likely CSS cause |
|---------|---------|-----------------|
| `.fleet-list-panel` | left edge offset 34px right of h1 | `justify-content: center` on flex parent floats the pair |
| `.vs-computer-banner` | unstyled plain div — no color, no spacing | class has no CSS rule |

**Expected behavior:**
<what the layout should look like>

**Inferred acceptance criteria:**
- [ ] <specific, testable, visual criterion — e.g. "fleet panel left edge within 5px of h1 left edge">
- [ ] <no horizontal scroll at 390px viewport>
```

These inferred criteria are merged into the `## Initial Scope` and `## Acceptance Criteria` sections of `requirements.md`.

---

## Evidence Requirement

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

If evidence is missing, write `Evidence not found.`

---

## Step 1 — Concurrency Lock

Before creating a new run, check for an existing lock:

```bash
test -f reports/.workflow.lock && cat reports/.workflow.lock
```

If a lock exists with `"status": "running"`, do not start a new run. Write a run-conflict report to stdout and exit. Two concurrent runs in one working tree corrupt branch state and reports.

If no lock exists or status is not `running`, create the lock:

```json
{
  "workflowRunId": "<workflow-run-id>",
  "branch": "<current-branch>",
  "createdAt": "<iso-timestamp>",
  "status": "running"
}
```

Write to `reports/.workflow.lock`.

---

## Step 2 — Generate Workflow Run ID

Format: `<YYYYMMDD-HHMMSS>-<short-commit-sha>`

```bash
git rev-parse --short HEAD
```

Create run directory:

```
reports/runs/<workflow-run-id>/
```

Write the global pointer:

```json
// reports/current-run.json
{
  "workflowRunId": "<workflow-run-id>",
  "runDirectory": "reports/runs/<workflow-run-id>",
  "branch": "<current-branch>",
  "baseBranch": "main",
  "baseCommit": "<base-commit>",
  "createdAt": "<iso-timestamp>",
  "status": "running"
}
```

All subsequent reports for this run are written under `reports/runs/<workflow-run-id>/`.

---

## Step 3 — Capture Requirement

Use `$ARGUMENTS` or the latest user request as the source. If the request is ambiguous, choose the smallest safe interpretation and document assumptions. Do not ask follow-up questions.

If the requirement is too ambiguous to safely implement, create `reports/runs/<workflow-run-id>/workflow-blocker.md`:

```md
## Blocker: Ambiguous Requirement

Reason:

Missing information:

Smallest safe interpretation attempted:

Why execution stopped:

Required human action:
Clarify the requirement and rerun the workflow.
```

Then stop. Mark lock `"status": "blocked"`.

---

## Step 4 — Branch Safety Gate

Base branch is always `main`. Source of truth is always `origin/main`.

Before branch operations:

```bash
git status --porcelain
```

If dirty, do not ask, stash, discard, or overwrite. Create `reports/runs/<workflow-run-id>/workflow-blocker.md`:

```md
## Blocker: Dirty Working Tree

Reason:
The working tree contains uncommitted changes before agent execution.

Files:
- ...

Action taken:
No branch sync was performed.
No tracked files were modified.
No PR was opened.

Required human action:
Clean, commit, stash, or discard local changes, then rerun the workflow.
```

Then stop. Mark lock `"status": "blocked"`.

### If Current Branch Is `main`

```bash
git status --porcelain
git checkout main
git pull origin main
git checkout -b feature/<safe-requirement-name>
```

Derive `<safe-requirement-name>` from the requirement: 3–5 words, lowercase, hyphens only.
If the branch exists, append `-fix-1`, `-fix-2`, etc.

Print: **Branch created:** `feature/<safe-requirement-name>`

### If Current Branch Is Not `main`

Treat it as a feature branch. Do not rely on upstream tracking.

```bash
git status --porcelain
git fetch origin
git rebase origin/main
```

If rebase conflicts occur:

1. Capture conflicted files.
2. Run `git rebase --abort` if safe.
3. Create `reports/runs/<workflow-run-id>/workflow-blocker.md`:

```md
## Blocker: Rebase Conflict

Reason:
Feature branch could not be rebased onto origin/main automatically.

Conflicted files:
- ...

Action taken:
Rebase was aborted.
Repository was returned to pre-rebase state.
No implementation changes were made after the conflict.

Required human action:
Resolve branch conflicts manually or rerun from a clean branch.
```

Then stop. Mark lock `"status": "blocked"`.

---

## Step 5 — Write Requirements

Write `reports/runs/<workflow-run-id>/requirements.md`:

```md
# Requirement

## Raw User Request

<exact original text>

## Visual Analysis

<paste the Visual Analysis block from Step 0 here — omit section entirely if no images were attached>

## Requirement Summary

<1-3 sentence plain interpretation — informed by Visual Analysis if images were provided>

## Initial Scope

<bullet list of what is in scope — include visual/layout items surfaced by image analysis>

## Acceptance Criteria

<combine text-stated criteria + inferred criteria from Visual Analysis into one numbered list>

## Initial Risks

<bullet list of known risks>

## Notes For Product

<anything the Product Agent should know or watch for>
<if images were provided: note "Visual evidence attached — see ## Visual Analysis for exact defects and expected state">

## Workflow Metadata

Workflow Run ID: <id>
Generated From Branch: <branch>
Generated From Commit: <sha>
Generated At: <iso-timestamp>
Source: user-input
Images analyzed: <count, or "none">
```

Continue autonomously to Team Lead when the smallest safe interpretation is implementable.

---

## Step 6 — Hand Off

Hand control to `.claude/skills/team-lead/SKILL.md`.

Requirement Intake must not:
- Request interactive confirmation.
- Spawn implementation agents directly.
- Run QA loops directly.
- Push branches.
- Open PRs.
- Consume old reports as memory.
