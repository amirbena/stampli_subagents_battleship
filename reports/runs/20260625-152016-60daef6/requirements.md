# Requirement

## Raw User Request

> I want to update the readme
>
> like this scenario
>
> the project isn't npm install or mvn install
>
> I want that before you start:
>
> Check if This claude settings is here:
> ```json
> {
>   "theme": "dark",
>   "env": {
>     "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
>   },
>   "permissions": {
>     "allow": [
>       "Read",
>       "Glob",
>       "Grep",
>       "Edit",
>       "Write",
>       "Agent",
>       "Skill(*)",
>       "Skill(claude-api)",
>       "Skill(claude-api:*)",
>
>       "WebFetch(domain:github.com)",
>       "WebFetch(domain:raw.githubusercontent.com)",
>
>       "Bash(git status*)",
>       "Bash(git log*)",
>       "Bash(git diff*)",
>       "Bash(git show*)",
>       "Bash(git fetch*)",
>       "Bash(git pull*)",
>       "Bash(git push*)",
>       "Bash(git add*)",
>       "Bash(git commit*)",
>       "Bash(git checkout*)",
>       "Bash(git switch*)",
>       "Bash(git branch*)",
>       "Bash(git stash*)",
>       "Bash(git rebase*)",
>       "Bash(git merge*)",
>       "Bash(git tag*)",
>       "Bash(git rev-parse*)",
>       "Bash(git config*)",
>       "Bash(git remote*)",
>       "Bash(git reset*)",
>       "Bash(git restore*)",
>       "Bash(git ls-files*)",
>       "Bash(git grep*)",
>       "Bash(git blame*)",
>
>       "Bash(npm*)",
>       "Bash(npx*)",
>       "Bash(node*)",
>
>       "Bash(./mvnw*)",
>       "Bash(mvn*)",
>
>       "Bash(ls*)",
>       "Bash(cat*)",
>       "Bash(echo*)",
>       "Bash(pwd*)",
>       "Bash(find*)",
>       "Bash(grep*)",
>       "Bash(xargs*)",
>       "Bash(which*)",
>       "Bash(jq*)",
>       "Bash(test*)",
>       "Bash(true)",
>       "Bash(false)",
>       "Bash(chmod*)",
>       "Bash(mkdir*)",
>
>       "Bash(curl*)",
>
>       "Bash(gh pr*)",
>       "Bash(gh --version*)",
>       "Bash(gh auth*)",
>       "Bash(gh repo*)",
>       "Bash(gh issue*)",
>       "Bash(gh api*)",
>
>       "mcp__visualize__read_me",
>       "mcp__visualize__show_widget"
>     ],
>     "ask": [
>       "Bash(git push --force*)",
>       "Bash(git push -f*)",
>       "Bash(git reset --hard*)",
>       "Bash(git reset -n*)",
>       "Bash(git branch -D*)",
>       "Bash(git clean*)",
>       "Bash(rm *)",
>       "Bash(rm -r*)",
>       "Bash(rm -f*)",
>       "Bash(del *)"
>     ]
>   }
> }
> ```
>
> And executed first npm install or mvn clean install
>
> I don't want that the flow everytime ask this

## Requirement Summary

Update `README.md` to document a one-time **project bootstrap / setup scenario** that must be completed *before* running the factory flow (`/requirement`). Two things must be documented: (1) that the repo is **not** auto-bootstrapped — the developer must run `npm install` (frontend) and `mvn clean install` (backend) first; and (2) that a specific `.claude/settings.json` (the permission allow/ask configuration quoted above, plus `theme` and the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env flag) must be present so the autonomous flow stops prompting for permission on every command.

## Initial Scope

In scope:
- Add/extend a README section that tells the developer to **place the provided `.claude/settings.json`** (exact JSON above) before starting, and explains *why* — it pre-approves the tool permissions the agents use so the flow does not ask for confirmation every time.
- Add/extend a README section documenting the **mandatory bootstrap commands** that are not run automatically:
  - Frontend: `npm install` (in `apps/frontend/`)
  - Backend: `mvn clean install` / `./mvnw clean install` (in `apps/backend/`)
- Make clear this is a **one-time prerequisite** that runs before `/requirement`, fitting alongside the existing `## Prerequisites` and `## How To Run` sections.
- Reference the existing `ask`-list entries (force-push, hard reset, `rm`, etc.) so the reader understands which destructive actions still prompt by design.

Out of scope:
- No application/runtime code changes (frontend or backend).
- No changes to the actual `.claude/settings.json` permission set itself — this is documentation of the recommended settings, not a behavioral change to the agents.
- No new endpoints, domain logic, or game behavior.

## Acceptance Criteria

1. `README.md` documents that the project is **not** auto-installed and that the developer must run `npm install` (frontend) and `mvn clean install` / `./mvnw clean install` (backend) before starting the flow.
2. `README.md` includes the recommended `.claude/settings.json` content (the exact permission `allow`/`ask` lists, `theme`, and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env flag) with a short explanation that placing it prevents the flow from asking for tool permission on every command.
3. The README clearly states this bootstrap + settings step is a **one-time prerequisite** performed before `/requirement`, placed logically near the existing Prerequisites / How To Run content.
4. The README notes which operations remain in the `ask` list (force-push, `git reset --hard`, `git clean`, `rm`) and therefore still prompt by design — pre-approval covers routine tools only, not destructive ones.
5. Documentation only — `git diff` shows no changes outside `README.md` (and the run report files). No production code, config, or test files are modified.
6. README remains internally consistent: existing Prerequisites / How To Run sections are not contradicted, and any new section cross-references them rather than duplicating conflicting instructions.

## Initial Risks

- **Duplication / inconsistency:** README already has a `## Prerequisites` section. New content must integrate, not contradict (e.g. existing text says "must be installed and verified before running `/requirement`"). Risk of stating two different setup orders.
- **Settings accuracy:** The quoted `.claude/settings.json` must be reproduced verbatim; a typo in the permission globs would mislead a developer into a config that still prompts.
- **Security framing:** Documenting a broad pre-approved `allow` list could read as encouraging users to disable safety prompts. Mitigation: emphasize the retained `ask` list for destructive commands.
- **Scope creep:** Temptation to also edit `.claude/settings.json` itself — request is documentation only; do not modify agent permissions.

## Notes For Product

- This is a **documentation-only (README)** change — a strong fast-path / refactor-class candidate (no API surface, no user-facing app behavior, no backend/frontend code). Likely no Product Agent needed beyond confirming acceptance criteria.
- Verify against the live repo whether a tracked `.claude/settings.json` already exists; if so, the README should point to it / keep it as the source of truth rather than pasting a second copy that can drift. If it does not exist, the README should instruct the developer to create it with the provided content.
- Confirm the correct install directories and commands match the existing How-To-Run / Prerequisites sections (`apps/frontend` for `npm install`, `apps/backend` for the Maven wrapper).

## Workflow Metadata

Workflow Run ID: 20260625-152016-60daef6
Generated From Branch: feature/readme-bootstrap-claude-settings
Generated From Commit: 60daef625357333e2978e49834c2fed975f2f6dc
Generated At: 2026-06-25T15:20:16Z
Source: user-input
Images analyzed: none
