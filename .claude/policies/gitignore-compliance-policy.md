---
name: gitignore-compliance-policy
description: Files matching .gitignore must not be staged or committed. Enforced by release-pr-agent (pre-commit gate) and code-review-agent (review checklist). package-lock.json may stay changed locally but must not be staged or pushed.
metadata:
  type: project
---

# Gitignore Compliance Policy

## Core Rules

- Files matching `.gitignore` must not be staged or committed.
- Generated and local artifacts must not appear in PR files changed.
- A user report that a gitignored or local-only file appears in a PR is a **blocking defect**.
- Do not delete local user data. Compliance is enforced at the staging and review level, not by file deletion.

## package-lock.json Strategy

`package-lock.json` and `**/package-lock.json` may remain tracked and may remain changed locally after `npm install`. This is acceptable and expected behavior.

**Agents must not stage, commit, or push `package-lock.json` unless the user explicitly requests dependency lockfile changes.**

| State | Allowed? |
|---|---|
| `package-lock.json` exists and is changed locally (`git status` shows it as modified) | Yes |
| `package-lock.json` appears in `git diff --cached --name-only` (staged) | **No — blocking defect** |
| `package-lock.json` appears in PR files changed without explicit user request | **No — blocking defect** |

Do not add `package-lock.json` to `.gitignore` as part of any automated run unless the user explicitly asks for it.

## Forbidden Staged/Committed Paths

The following paths must never appear in staged files or PR diff without explicit user approval:

```
reports/**
package-lock.json
**/package-lock.json
.env
.env.*
*.log
```

## Verification Commands

```bash
# Check staged files against .gitignore
git diff --cached --name-only | while read -r file; do
  if git check-ignore -q "$file"; then
    echo "$file"
  fi
done

# Check explicitly forbidden paths
git diff --cached --name-only | grep -E '^reports/|^package-lock\.json$|.*/package-lock\.json$'

# Check for tracked reports files (should return empty)
git ls-files reports

# Check tracked package-lock files
git ls-files '**/package-lock.json'
```

## Enforcement Points

| Agent | When | Action on violation |
|---|---|---|
| `release-pr-agent` | After staging, before `git push` or PR create/update | Stop; unstage forbidden files; return structured evidence to Team Lead |
| `code-review-agent` | First item in Review Checklist, before code review | Return `REQUIRES_CHANGES` with `Failure category: gitignore` or `reports` or `package-lock`; do not approve |

## Team Lead Routing

When either enforcement point triggers a violation, Team Lead must:
1. Stop the release flow.
2. Route remediation to `release-pr-agent / git governance path`.
3. Require correction evidence.
4. Rerun `code-review-agent` after correction.

## Related

- `.claude/policies/reports-and-artifacts-policy.md` — `reports/`-specific rules
- `.claude/skills/release-pr-agent/SKILL.md` — Pre-Commit Gitignore Compliance Gate
- `.claude/skills/code-review-agent/SKILL.md` — Gitignore and Local Artifact Compliance checklist item
- `.gitignore` — authoritative pattern list
