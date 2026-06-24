# Git Pre-Flight Policy
# Shared by: java-backend-agent, frontend-api-agent, frontend-ui-agent
# Load at the start of every implementation task before touching any file.

## Pre-Flight Check

Team Lead has already decided the branch and synced it with `origin/main`. Do not re-run that decision.

Before touching any file, confirm you are on the branch Team Lead assigned:

```bash
git status
git branch --show-current
```

- Branch matches Team Lead's assignment → proceed.
- Branch is `main` → stop immediately and report. Never implement on `main`.
- Branch does not match → stop and report the mismatch to Team Lead.
- Working tree is dirty in an unexpected way → stop and report to Team Lead.

Do NOT run `git checkout`, `git rebase`, `git stash`, or any other branch operation — Team Lead already handled that.

## Git Summary — required at end of every implementation task

Include this block in your evidence section:

```md
## Git Summary
- Branch received from Team Lead:
- Branch confirmed: Yes / No
- Was on main: Yes / No
- Unexpected dirty state: Yes / No
- Commits created:
- Tests run:
- Follow-up needed:
```
