# Team Lead Execution Plan

Workflow Run ID: 20260625-152016-60daef6
Branch: feature/readme-bootstrap-claude-settings

## Requirement Summary
Update `README.md` to document a one-time bootstrap/setup scenario before running the factory: (1) the repo is not auto-installed — run `npm install` (frontend) and `mvn clean install` (backend) first; (2) create `.claude/settings.json` with the provided permission allow/ask config + `theme` + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` so the autonomous flow stops prompting for tool permission on every command.

## Product Summary
Skipped (fast-path, docs-only). Inline acceptance checklist in team-lead-classification.md is the source of truth.

## Architecture Status
Not required — no contract/domain/schema/auth/multiplayer change.

## Execution Route
`docs-only`

## Execution Mode
`cheap`

## Agents To Run / Skipped
- Run: infrastructure-agent (owns run/setup documentation), code-review-agent (review-lite — always runs).
- Skipped: product, architect, java-backend, frontend-api, frontend-ui, backend-integration-tests, playwright-e2e, security.

## Developer Assignments
- **infrastructure-agent** — edit `README.md` only. Add a "Project Bootstrap" / first-time setup subsection covering: (a) manual install commands (`npm install` in `apps/frontend/`, `mvn clean install`/`./mvnw clean install` in `apps/backend/`) framed as a one-time prerequisite; (b) creating `.claude/settings.json` (file does NOT currently exist — only `.claude/settings.local.json` does) with the exact JSON from requirements.md, with prose explaining it pre-approves routine tool permissions so the flow doesn't prompt every command; (c) a note that destructive ops remain in the `ask` list (force-push, `git reset --hard`, `git clean`, `rm`) and still prompt by design. Integrate near existing `## Prerequisites`; do not contradict it. Reproduce the JSON verbatim from `requirements.md` lines 14–108.

## Work Order
1. infrastructure-agent edits README.md.
2. Team Lead ownership + diff-scope checks.
3. code-review-agent (review-lite).
4. Triage any findings → re-review if needed.
5. release-pr-agent → PR.

## File Ownership
- `README.md` — owned by infrastructure-agent for this run (run/setup documentation). No other production files in scope.

## Shared File Handling
README.md is a shared/root doc; assigned solely to infrastructure-agent this run. No other shared files touched.

## Required Tests
None. Docs-only: README is non-executable. No `npm run build` / `./mvnw test` needed (no frontend/backend source touched). Recorded in test-results.md.

## Runtime/Build/Test Failure Routing
N/A — no build/test commands run for docs-only change.

## QA Plan
Verify acceptance checklist items 1–7 by reading the final README diff. No automated QA loop expected.

## Security Review Required
No — docs-only. Code review confirms the destructive-command framing (ask-list presented as retained-by-design).

## Backend Integration Tests Required
No.

## E2E Mode
None.

## Demo Config Plan
N/A — no config files changed. (The README documents recommended `.claude/settings.json`; no actual settings file is created/modified by this change.)

## Done Criteria
- README satisfies inline acceptance checklist items 1–7.
- `git diff --name-only` shows only `README.md` + `reports/**`.
- code-review-agent verdict APPROVED (or APPROVED WITH RISKS).
- release-summary.md written; PR opened.

## Loop Prevention Plan
Docs-only; max 2 fix cycles on README findings expected. Cap per Finding ID: 10 (well above expected). No Product/Architecture reopens anticipated.

## Risk Handling Policy
- Verbatim JSON: reviewer diffs README JSON against requirements.md.
- Consistency: reviewer confirms no contradiction with existing `## Prerequisites`.
- Security framing: reviewer confirms `ask`-list note present.
