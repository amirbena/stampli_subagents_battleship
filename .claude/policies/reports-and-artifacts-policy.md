---
name: reports-and-artifacts-policy
description: Defines reports/ as local execution evidence — never to be staged, committed, or pushed. Enforced by release-pr-agent and code-review-agent.
metadata:
  type: project
---

# Reports and Artifacts Policy

## Core Rule

**`reports/` is evidence, not truth.**

Files under `reports/` are local execution evidence — diagnostics, run summaries, screenshots, agent logs, and workflow lock files generated during a run. They are not source of truth and must never enter git history.

## Rules

- Agents may write temporary logs, diagnostics, screenshots, and run summaries under `reports/`.
- Agents must **never** stage or commit `reports/**`. This includes:
  - `reports/runs/<id>/*.md`
  - `reports/current-run.json`
  - `reports/.workflow.lock`
  - Any other file under `reports/`
- `.gitignore` already contains `reports/` — this policy makes the prohibition explicit for agents that receive staging instructions.
- `git add <explicit-path>` bypasses `.gitignore` for named paths. Agents must not use it on `reports/**` paths even when the path is explicit in their instructions.
- Permanent decisions, accepted criteria, and architecture records must live in tracked source files, not only in `reports/`.
- PR descriptions may **summarise** `reports/` content but must not commit report files.

## Enforcement Points

| Agent | Enforcement action |
|---|---|
| `release-pr-agent` | Runs the Pre-Commit Gitignore Compliance Gate before any push or PR update. If `reports/**` appears in staged files, stops and returns to Team Lead. |
| `code-review-agent` | Runs `git ls-files reports` as the first review check. Any output is a `Critical / Blocks PR: Yes` finding. |
| `team-lead` | Routes any `reports/**` staging violation to `release-pr-agent / git governance path`. |

## Related

- `.claude/policies/gitignore-compliance-policy.md` — broader gitignore compliance rules
- `.gitignore` — authoritative file pattern list
