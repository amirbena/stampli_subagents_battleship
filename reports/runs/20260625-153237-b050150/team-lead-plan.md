# Team Lead Execution Plan

Workflow Run ID: 20260625-153237-b050150
Branch: feature/readme-bootstrap-claude-settings

## Requirement Summary
Two targeted README fixes to the `### Project Bootstrap` subsection: (1) remove hardcoded `"theme": "dark"` from the settings JSON block and add a prose note about user preference; (2) add Windows install command variants alongside macOS/Linux ones.

## Product Summary
Skipped (fast-path, docs-only). Inline acceptance checklist in team-lead-classification.md.

## Architecture Status
Not required.

## Execution Route
`docs-only`

## Execution Mode
`cheap`

## Agents To Run / Skipped
- Run: infrastructure-agent (README edits), code-review-agent (review-lite).
- Skipped: product, architect, java-backend, frontend-api, frontend-ui, backend-integration-tests, playwright-e2e, security.

## Developer Assignments

**infrastructure-agent** — edit `README.md` only. Two targeted edits inside `### Project Bootstrap (one-time, before /requirement)`:

**Edit 1 — Remove `"theme"` from settings JSON:**
- Find the `"theme": "dark",` line (currently line 51 in the working file).
- Remove it. The resulting first key of the JSON object becomes `"env"` — verify no dangling comma.
- Add a short prose note immediately before or after the JSON block explaining that `"theme"` is intentionally omitted and the user should add it themselves with their preferred value: `"light"`, `"dark"`, or `"system"`.

**Edit 2 — Add Windows install variants:**
- The current "Install project dependencies" code block shows only macOS/Linux commands.
- Split into two clearly labelled subsections (e.g. "macOS / Linux" and "Windows") — or use two separate fenced code blocks with labels — showing:
  - macOS/Linux frontend: `cd apps/frontend` then `npm install`
  - macOS/Linux backend: `cd apps/backend` then `./mvnw clean install`
  - Windows frontend: `cd apps/frontend` then `npm install` (identical, just labelled)
  - Windows backend: `cd apps/backend` then `mvnw.cmd clean install`
- Keep existing blockquote notes about first-time-only and `.m2` cache, updating if needed for Windows specifics (e.g. `.m2` cache lives at `%USERPROFILE%\.m2` on Windows).

**Stash strategy (Team Lead will handle before spawning agent):** stash `apps/frontend/package-lock.json` so the working tree is clean for the agent's commit. The agent must not touch package-lock.json.

## Work Order
1. Team Lead stashes package-lock.json.
2. infrastructure-agent edits README.md.
3. Team Lead pops stash.
4. Ownership + diff-scope checks (README.md only).
5. code-review-agent (review-lite).
6. release-pr-agent → amend/push to PR #33.

## File Ownership
- `README.md` — infrastructure-agent (this run).

## Shared File Handling
README.md assigned solely to infrastructure-agent this run. No other shared files in scope.

## Required Tests
None. Docs-only.

## Runtime/Build/Test Failure Routing
N/A.

## QA Plan
Verify 8-item acceptance checklist by README diff inspection. No automated QA loop.

## Security Review Required
No.

## Backend Integration Tests Required
No.

## E2E Mode
None.

## Demo Config Plan
N/A.

## Done Criteria
- README satisfies checklist items 1–8.
- JSON block is valid after `"theme"` removal.
- Windows install variants present and labelled.
- `git diff --name-only` shows README.md only (+ reports).
- code-review APPROVED.
- PR #33 updated via push.

## Loop Prevention Plan
Max 2 fix cycles expected. Simple docs edits.

## Risk Handling Policy
- JSON validity: reviewer confirms no dangling comma.
- Stash/unstash: Team Lead owns stash lifecycle; agent does not touch package-lock.json.
