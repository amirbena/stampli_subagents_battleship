# Requirement

## Raw User Request

> theme should be as user chose
> and readme should detect between windows / mac

(Clarified context from the preceding conversation: these are two targeted fixes to the README bootstrap section added in PR #33 on branch `feature/readme-bootstrap-claude-settings`.)

## Requirement Summary

Two focused edits to the `### Project Bootstrap` subsection of `README.md`:

1. **Theme fix** — The `.claude/settings.json` block currently hardcodes `"theme": "dark"` (line 51). Remove the `theme` field entirely and add a prose note that the user should omit it or set it to their own preference (`"light"`, `"dark"`, or `"system"`).

2. **Platform-aware install commands** — The "Install project dependencies" section (lines 15–35) currently shows only macOS/Linux commands. Add a Windows variant for both the frontend and backend steps: Windows uses `mvnw.cmd clean install` (not `./mvnw clean install`) for the backend; the `cd` syntax stays the same but the Maven wrapper filename differs. Both variants should be clearly labelled so a developer on either OS can follow without confusion.

## Initial Scope

In scope:
- `README.md` only — two small edits to the `### Project Bootstrap (one-time, before /requirement)` subsection.
- Remove `"theme": "dark"` from the settings JSON block; add a note explaining the user sets their own theme.
- Add Windows install commands alongside the macOS/Linux ones for both frontend (`npm install` — identical, just label it) and backend (`mvnw.cmd clean install` vs `./mvnw clean install`).

Out of scope:
- No changes to `.claude/settings.json`, `.claude/settings.local.json`, or any other file.
- No production source code, test, config, or infra changes.
- No changes outside the `### Project Bootstrap` subsection of README.

## Acceptance Criteria

1. The `.claude/settings.json` block in README no longer contains a `"theme"` key.
2. README includes a prose note near the settings block advising users to omit `"theme"` or set it to `"light"`, `"dark"`, or `"system"` per their preference.
3. The "Install project dependencies" section shows clearly labelled commands for both **macOS/Linux** and **Windows**.
4. The macOS/Linux backend command remains `./mvnw clean install`.
5. The Windows backend command is `mvnw.cmd clean install` (correct Windows Maven Wrapper invocation).
6. The frontend `npm install` is correctly shown for both platforms (command is identical; labelling makes that clear).
7. `git diff --name-only` shows only `README.md` changed (plus any run report files).
8. No other content in README is altered.

## Initial Risks

- **JSON validity**: removing `"theme"` must leave the remaining JSON syntactically valid (trailing comma issue if `"theme"` was the last key before the comma-separated object). Verify the resulting JSON is valid.
- **Existing prose references**: check whether any other README paragraph refers to the theme setting; update for consistency if so.
- **Windows path separators in prose**: `cd apps/frontend` works in both PowerShell and cmd, so no path separator issue there. Only the Maven wrapper invocation differs.

## Notes For Product

- Documentation-only change; no product behavior. Fast-path (docs-only) applies with no UX interaction risk.
- The `"theme"` field was first/topmost in the settings JSON. After removal, `"env"` becomes the first key — confirm the resulting block is still valid JSON.
- No Product Agent or Architecture Agent needed.

## Workflow Metadata

Workflow Run ID: 20260625-153237-b050150
Generated From Branch: feature/readme-bootstrap-claude-settings
Generated From Commit: b050150fe4d712f3f143150266d393aae025034b
Generated At: 2026-06-25T15:32:37Z
Source: user-input
Images analyzed: none

## Evidence

Files inspected:
- `README.md` (lines 15–56 via grep)
- `reports/.workflow.lock` (confirmed completed — no conflict)

Facts found:
- `"theme": "dark"` at README line 51 inside the `.claude/settings.json` block
- Install section (lines 15–35) shows only macOS/Linux; no Windows variant
- Working tree dirty only on `apps/frontend/package-lock.json` (unrelated external change; rebase is a no-op — branch already 2 commits ahead of origin/main with nothing new on main)
- `.claude/settings.json` does not exist (only `.claude/settings.local.json`)

Files changed:
- None yet (intake only)

Tests run:
- None

Assumptions:
- "theme should be as user chose" means remove the hardcoded `"theme": "dark"` key and add a note; not that the README should auto-detect the user's OS theme setting.
- "readme should detect between windows / mac" means show both platform variants side by side (labelled tabs/sections), not runtime detection logic.
- The requirement targets only the `### Project Bootstrap` section — no other README content changes.
- Continuing on the same branch `feature/readme-bootstrap-claude-settings` (Case C — related continuation, same PR) is correct.

Unknowns:
- None.
