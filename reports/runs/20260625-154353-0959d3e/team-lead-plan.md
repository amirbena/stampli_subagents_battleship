# Team Lead Execution Plan

Workflow Run ID: 20260625-154353-0959d3e
Branch: feature/readme-bootstrap-claude-settings

## Requirement Summary
Three fixes: (1) untrack reports/ from git index (gitignore entry already correct); (2) split README install section into separate frontend + backend subsections with platform variants; (3) add chmod +x and mvn alternative for Mac users in the backend install block.

## Product Summary
Skipped (fast-path). Inline acceptance checklist in team-lead-classification.md.

## Architecture Status
Not required.

## Execution Route
`docs-only`

## Execution Mode
`cheap`

## Agents To Run / Skipped
- Run: infrastructure-agent (git rm --cached + README edits), code-review-agent (review-lite).
- Skipped: all others.

## Developer Assignments

**infrastructure-agent** — two tasks:

### Task A — Remove tracked reports/ files from git index
Run:
```bash
git rm --cached reports/ -r
```
Verify: `git ls-files reports/` returns empty. The files remain on disk (git rm --cached does not delete from disk).

### Task B — Edit `README.md` inside `### Project Bootstrap` only

Replace the current `#### 1. Install project dependencies` section (which has one mixed frontend+backend block) with two separate subsections:

**#### 1a. Frontend — install Node dependencies**
- macOS/Linux block: `cd apps/frontend` then `npm install`
- Windows block: `cd apps\frontend` then `npm install`
- Note: `npm install` is identical on both platforms; labelling makes that clear.

**#### 1b. Backend — install Maven dependencies**
- macOS/Linux block:
  ```bash
  cd apps/backend
  # Make the Maven Wrapper executable (required once after cloning on macOS/Linux)
  chmod +x mvnw
  ./mvnw clean install
  # Alternative: if you have Maven installed globally
  # mvn clean install
  ```
- Windows block:
  ```
  cd apps\backend
  mvnw.cmd clean install
  ```
- Keep/update the blockquote noting this resolves Maven dependencies into .m2 cache. Make it platform-neutral.
- Remove the old combined block entirely.

**Constraints:**
- Edit ONLY `README.md`. Stay within `### Project Bootstrap (one-time, before /requirement)`.
- Do NOT stage or touch `apps/frontend/package-lock.json`.
- Do NOT commit — Team Lead handles staging + commit.

## Work Order
1. Team Lead stashes package-lock.json.
2. infrastructure-agent: git rm --cached reports/ -r + README edit.
3. Team Lead unstashes.
4. Team Lead: stage README.md + run git rm --cached deletions; verify ls-files reports/ empty.
5. Ownership + diff-scope checks.
6. code-review-agent (review-lite).
7. release-pr-agent → push to PR #33.

## File Ownership
- `README.md` — infrastructure-agent.
- Git index cleanup (git rm --cached reports/) — infrastructure-agent.

## Shared File Handling
README.md assigned to infrastructure-agent. No other shared files in scope.

## Required Tests
None — docs + git index only.

## Runtime/Build/Test Failure Routing
N/A.

## QA Plan
Verify 8-item checklist by diff inspection and git ls-files.

## Security Review Required
No.

## Backend Integration Tests Required
No.

## E2E Mode
None.

## Demo Config Plan
N/A.

## Done Criteria
- git ls-files reports/ is empty.
- README install section split into 1a (frontend) + 1b (backend) with platform variants.
- Backend macOS block shows chmod + ./mvnw + mvn alternative.
- Code review APPROVED.
- PR #33 updated.

## Loop Prevention Plan
Max 2 fix cycles. Simple docs + git index fix.

## Risk Handling Policy
- git rm --cached scope: verify with git ls-files after command.
- Disk preservation: git rm --cached (no -f) leaves files on disk.
- package-lock.json: stashed by Team Lead; agent must not touch it.
