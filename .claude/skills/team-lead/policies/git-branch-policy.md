# Git Branch Policy

Operational reference for Team Lead's Git branch handling. Team Lead loads this file when any of the following apply:

- working tree is dirty
- current branch is `main`
- current branch is unrelated to the requirement
- a new branch must be created
- rebase is needed
- stash or WIP commit is needed
- conflict appears
- existing PR status affects the decision
- merged branch status affects the decision
- New Branch Guard is needed
- branch naming or commit message format matters

Team Lead may skip loading this file only on the simplest safe path: clean feature branch that already matches the requirement, no branch switch, no dirty state, no new branch, no conflict.

---

## New Branch Guard

Run before every `git checkout -b` (Cases B, D, G, H):

```bash
git branch --list feature/<requirement-name>           # local
git branch -r --list origin/feature/<requirement-name> # remote
```

If the branch exists locally or remotely, write `workflow-blocker.md` and stop:

```md
## Blocker: Branch Already Exists

Branch name: feature/<requirement-name>
Found: local / remote / both

This branch may belong to another team member or an unrelated change.
I will not check out, reuse, or modify it automatically.

Required human action:
Choose a different branch name, or confirm this branch is safe to reuse, then rerun.
```

Only proceed with `git checkout -b` after confirming the name is free on both local and remote.

---

## Case A — Branch Already Matches This Exact Requirement

**If clean:**
```bash
git fetch origin
git rebase origin/main
```

**If dirty with meaningful changes:**
```bash
git add .
git commit -m "wip: checkpoint before rebase"
git fetch origin
git rebase origin/main
```

**If dirty with temporary changes:**
```bash
git stash push -u -m "wip-before-rebase"
git fetch origin
git rebase origin/main
git stash pop
```

If rebase conflict: `git rebase --abort`, write `workflow-blocker.md`, stop.

---

## Case B — Current Branch Is Completely Unrelated

Leave it untouched. Move to updated `main`, create fresh branch. Run the New Branch Guard before creating.

**If clean:**
```bash
git fetch origin
# verify branch name is free (New Branch Guard)
git checkout main
git pull --ff-only origin main
git checkout -b feature/<requirement-name>
```

**If dirty — preserve work on the current branch:**
```bash
git add .
git commit -m "wip: preserve unrelated branch work"
# verify branch name is free (New Branch Guard)
git checkout main
git pull --ff-only origin main
git checkout -b feature/<requirement-name>
```

**If dirty — temporary changes:**
```bash
git stash push -u -m "wip-unrelated-branch"
# verify branch name is free (New Branch Guard)
git checkout main
git pull --ff-only origin main
git checkout -b feature/<requirement-name>
```

Do not `stash pop` unrelated changes onto the new branch.

---

## Case C — Related Continuation (X.1 → X.2)

Continue on same branch only if: not merged, PR still open or no PR yet, new requirement belongs to the same logical change set.

**If clean:**
```bash
git fetch origin
git rebase origin/main
```

**If dirty with meaningful changes:**
```bash
git add .
git commit -m "wip: checkpoint before related continuation"
git fetch origin
git rebase origin/main
```

**If dirty with temporary changes:**
```bash
git stash push -u -m "wip-before-related-continuation"
git fetch origin
git rebase origin/main
git stash pop
```

If rebase conflict: `git rebase --abort`, write `workflow-blocker.md`, stop.
If stash pop conflict: write `workflow-blocker.md`, stop.

---

## Case D — Current Branch Is Main And Clean

```bash
git status
git checkout main
git pull --ff-only origin main
# verify branch name is free (New Branch Guard)
git checkout -b feature/<requirement-name>
```

Forbidden on `main`: `git add .`, `git commit`.

---

## Case E — Current Branch Is Main And Dirty

Hard stop. Write to `workflow-blocker.md`:

```
Current branch is main and the working tree is dirty.
I will not modify, commit, stash, reset, or clean directly on main.
Please decide whether to preserve, discard, or move these changes to a branch.
```

Forbidden on dirty `main` unless explicitly human-approved: `git add`, `git commit`, `git stash`, `git reset --hard`, `git clean -fd`, `git checkout -b`.

---

## Case F — Dirty Feature Branch (Before Rebase Or Switch)

**Use commit when** changes are meaningful, branch is correct, changes are part of current task.
**Use stash when** changes are temporary or experimental.

Always include untracked files in stash:
```bash
git stash push -u -m "wip-before-branch-operation"
```
Never use bare `git stash` when untracked files exist.

---

## Case G — Branch Already Merged

```bash
git checkout main
git pull --ff-only origin main
# verify branch name is free (New Branch Guard)
git checkout -b feature/<requirement-name>
```

Do not continue development on merged branches.

---

## Case H — Open PR But Requirement Is Unrelated

Leave old branch untouched. Run the New Branch Guard before creating the new branch.

**If clean:**
```bash
git checkout main
git pull --ff-only origin main
# verify branch name is free (New Branch Guard)
git checkout -b feature/<new-requirement-name>
```

**If dirty:**
```bash
git add .
git commit -m "wip: preserve open PR work"
git checkout main
git pull --ff-only origin main
# verify branch name is free (New Branch Guard)
git checkout -b feature/<new-requirement-name>
```

---

## Case I — Open PR And Requirement Is Related

Continue on same branch.

**If clean:**
```bash
git fetch origin
git rebase origin/main
```

**If dirty:**
```bash
git add .
git commit -m "wip: checkpoint before updating open PR"
git fetch origin
git rebase origin/main
```

---

## Case J — Stale Lock Recovery (Requirement Intake detected an interrupted run)

Requirement Intake Step 0.5 already handled the stale lock before Team Lead runs:
- The prior lock has been marked `"interrupted"`.
- If the dirty tree was non-empty, it has been stashed with a labeled message.
- `reports/runs/<prior-id>/interrupted-run-detection.md` has been written.

**Team Lead runs Step 5.5 — Requirement Similarity Detection before choosing a Case.**

Read the detection report to gather inputs for similarity detection:

```bash
cat reports/runs/<prior-run-id>/interrupted-run-detection.md 2>/dev/null || true
```

Then load `.claude/skills/team-lead/policies/requirement-similarity-policy.md` and collect all five signals (branch slug alignment, requirement area overlap, AC inheritance, dirty file scope match, prior PR alignment). Classify the new requirement as `same | extension | related | unrelated | unclear`.

**The similarity classification drives which Case (A–I) applies:**

| Classification | Confidence | Prior branch merged? | → Case |
|---|---|---|---|
| `same` | `high` | No | A or C — continue on prior branch |
| `same` | `high` | Yes | G — new branch from main |
| `same` | `medium` or `low` | Any | D/B — new branch (treat as unclear) |
| `extension` | `high` or `medium` | No | C or I — continue on prior branch |
| `extension` | Any | Yes | G — new branch from main |
| `related` | Any | Any | B or H — new branch from main |
| `unrelated` | Any | Any | B or H — new branch from main |
| `unclear` | Any | Any | D/B — new branch from main |

After applying the chosen Case, include all recovery and similarity context in the Branch Decision Log:

```md
## Branch Decision

...
Prior Run Recovery: Yes — see reports/runs/<prior-id>/interrupted-run-detection.md
Stash Ref: <ref or N/A>
Stash Message: <message or N/A>
Similarity Classification Applied: same / extension / related / unrelated / unclear
```

**Stash rules in Case J:**
- Never run `git stash pop`, `git stash apply`, or `git stash drop`.
- Run `git stash show --name-only <stash-ref>` to inspect files and record what was stashed.
- Leave stash contents in place. Record ref in the Branch Decision Log and similarity report.

**Hard override:** if prior branch is merged, never continue on it regardless of similarity classification.

---

## Pull / Fetch / Rebase Rules

**On `main`:** `git pull --ff-only origin main` only.

**On feature branches:** `git fetch origin && git rebase origin/main` — never `git pull origin main`.

**Recommended config:**
```bash
git config pull.ff only
git config rebase.autoStash false
```

---

## Conflict Handling

**Rebase conflict:**
```bash
git status
# resolve file by file
git add <resolved-files>
git rebase --continue
# or if unsafe:
git rebase --abort
```

**Stash pop conflict:**
```bash
git status
# resolve
git add <resolved-files>
git stash list
git stash drop   # if stash was not auto-dropped
```

Never continue implementation while Git is in a conflicted state.

---

## Branch Naming Policy

```
feature/<short-requirement-name>
fix/<short-bug-name>
chore/<short-maintenance-name>
test/<short-test-name>
```

Lowercase, hyphens, short but meaningful. Avoid generic names like `feature/fix`, `feature/update`.

---

## Commit Message Policy

```
fix: allow ship placement during manual setup
feat: add toast for invalid ship placement
wip: checkpoint before rebase          # WIP only when preserving state
```

Avoid: `fix`, `changes`, `update`, `stuff`.

---

## Forbidden Actions

```bash
git pull origin main          # on feature branch — creates merge commit
git add . && git commit       # on main
git reset --hard              # unless explicitly approved
git clean -fd                 # unless explicitly approved
git branch -D                 # unless explicitly approved
git push --force              # always forbidden; use --force-with-lease if needed
```

---

## Safe Execution Order

```
1. git status + git branch --show-current + git fetch origin + git log --oneline -5
2. Determine: main or feature branch? clean or dirty? related or unrelated?
3. Check for existing open/merged PR
4. Classify case (A–I)
5. Preserve local changes if needed (commit or stash)
6. Sync from origin/main correctly (ff-only on main, rebase on feature)
7. Create or stay on branch
8. Write Branch Decision Log
9. Assign developer agents and implement
10. Run tests
11. Commit with clear message
12. Update or create PR
```
