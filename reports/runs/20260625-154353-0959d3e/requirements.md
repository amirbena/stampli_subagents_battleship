# Requirement

## Raw User Request

> reports should be in gitignore, but you add this into push, bad thing!
> split the commands between frontend & backend
> Why I need mvnw? It's not working for me in mac.
> I don't see any reports - please put this into gitignore

## Requirement Summary

Three fixes on the same branch/PR (`feature/readme-bootstrap-claude-settings`, PR #33):

1. **Untrack `reports/` from git** — `.gitignore` already contains `reports/` but 24 report files were committed before the ignore rule took effect. Run `git rm --cached reports/ -r` to remove them from the index. Future commits will not include report artifacts.

2. **Split install commands into separate frontend and backend subsections** — The current `#### 1. Install project dependencies` mixes frontend and backend commands in the same code block. Split into two distinct subsections: `#### 1a. Frontend — install Node dependencies` and `#### 1b. Backend — install Maven dependencies`, each with their own macOS/Linux and Windows variants.

3. **Fix `./mvnw` on Mac** — `./mvnw` loses its executable bit after `git clone` on macOS. The README should add `chmod +x apps/backend/mvnw` as a one-line prerequisite before `./mvnw clean install`, and also show `mvn clean install` as the direct alternative (Maven is already listed in the Runtime tools table as a prerequisite). Both approaches solve the problem; the README should present both so the user can choose.

## Initial Scope

In scope:
- **`.gitignore`**: already contains `reports/` — no edit needed.
- **Git index cleanup**: run `git rm --cached reports/ -r` so tracked report files are removed from the index. They remain on disk (now ignored).
- **README.md**: two edits inside `### Project Bootstrap`:
  - Split `#### 1. Install project dependencies` into `#### 1a.` (frontend) and `#### 1b.` (backend), each with macOS/Linux and Windows blocks.
  - In the backend subsection, add `chmod +x apps/backend/mvnw` before `./mvnw clean install` on macOS/Linux, and show `mvn clean install` as the alternative.

Out of scope:
- No changes to `apps/frontend/package-lock.json` (unrelated external modification, do not stage).
- No production source, test, or config file changes.
- No new entries needed in `.gitignore` (entry already exists).

## Acceptance Criteria

1. `git ls-files reports/` returns empty — no report files tracked after the fix commit.
2. `reports/` still exists on disk and is not deleted (only untracked).
3. Future `git status` shows no report files (they are ignored).
4. README `#### 1. Install project dependencies` is replaced by two subsections: one for frontend, one for backend.
5. Each subsection has clearly labelled macOS/Linux and Windows variants.
6. The macOS/Linux backend block includes `chmod +x apps/backend/mvnw` before `./mvnw clean install` (or equivalent note), and shows `mvn clean install` as the alternative.
7. Windows backend block continues to show `mvnw.cmd clean install` (no chmod needed on Windows).
8. `git diff --name-only HEAD` (after commit) shows only `README.md` plus the `git rm --cached` removals — no source/config/test files.

## Initial Risks

- **`git rm --cached` scope**: must remove ALL tracked files under `reports/` recursively. Verify with `git ls-files reports/` after the command — must return empty.
- **Disk preservation**: `git rm --cached` (without `-f`) only removes from index, not disk. Files remain. Verify reports/ still exists on disk after the command.
- **mvnw.cmd on Windows**: does not need chmod; confirm Windows block is not changed for this issue.
- **README consistency**: other sections (How To Run, Without Docker) reference `./mvnw` directly — those are NOT in scope to change; only the `### Project Bootstrap` install section is updated.

## Notes For Product

- Fast-path (docs-only + git index cleanup). No product behavior changes.
- The `.gitignore` already has the correct rule; only the git index needs cleaning.
- `chmod +x apps/backend/mvnw` and `mvn clean install` are both valid solutions for the Mac user; show both so developers can choose.

## Workflow Metadata

Workflow Run ID: 20260625-154353-0959d3e
Generated From Branch: feature/readme-bootstrap-claude-settings
Generated From Commit: 0959d3ea5136c70c48679c1b629e873ba3bb22b2
Generated At: 2026-06-25T15:43:53Z
Source: user-input
Images analyzed: none

## Evidence

Files inspected:
- `.gitignore` (already contains `reports/` entry)
- `README.md` (lines 13–50 for install section; lines for mvnw references)
- `git ls-files reports/` — 24 tracked report files found

Facts found:
- `.gitignore` line 2: `reports/` — entry already present, rule correct
- 24 files under `reports/` are tracked in the git index (committed before gitignore rule took effect)
- `./mvnw clean install` at README line 27 — no chmod prerequisite shown
- Current install block mixes frontend + backend in same code block under `#### 1. Install project dependencies`
- `apps/frontend/package-lock.json` dirty (unrelated external change) — must NOT be staged
- Rebase is a no-op: branch is 3 commits ahead of origin/main, origin/main has no new commits

Files changed:
- None yet (intake only)

Tests run:
- None

Assumptions:
- "split the commands between frontend & backend" = two separate subsections (1a/1b), not just different labels within one block.
- "Why I need mvnw? It's not working for me in mac" = add chmod prerequisite AND show `mvn clean install` as alternative; do not remove `./mvnw` from the README entirely (it is used by the fast-local scripts).
- Only the `### Project Bootstrap` install section is changed in README — other `./mvnw` references elsewhere in the README are out of scope.

Unknowns:
- None.
