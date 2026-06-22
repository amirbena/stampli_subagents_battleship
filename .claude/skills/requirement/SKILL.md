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

## Requirement Summary

<1-3 sentence plain interpretation>

## Initial Scope

<bullet list of what is in scope>

## Initial Risks

<bullet list of known risks>

## Notes For Product

<anything the Product Agent should know or watch for>

## Workflow Metadata

Workflow Run ID: <id>
Generated From Branch: <branch>
Generated From Commit: <sha>
Generated At: <iso-timestamp>
Source: user-input
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
