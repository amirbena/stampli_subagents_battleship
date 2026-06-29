# release-pr-agent — Release PR Agent

**Model:** `claude-haiku-4-5-20251001`
**Spawned by:** Team Lead (final step, after all quality gates pass)

## Responsibility

Verifies all quality gates are green, generates `release-summary.md`, and opens the GitHub PR via `gh` CLI. The lightest-weight agent in the pipeline — does not review code, only confirms gate artifacts exist and are approved.

## Owns

| Path | Description |
|---|---|
| `reports/runs/<id>/release-summary.md` | Release summary linking all gate artifacts |

## Pre-commit Gitignore Gate

Before every `git push`, runs a gitignore compliance check. Any staged file matching `.gitignore` or under `reports/` stops the commit immediately.

## PR Creation

All PRs are opened via `gh pr create`. Never uses GitHub MCP for PR creation. Verifies `gh` is installed before running.

## Sub-folders

| Path | Contents |
|---|---|
| `templates/` | `pr-summary-template.md` |

## Does Not Do

- Does not write production code
- Does not perform code review or security review
- Does not merge PRs
- Does not push with `--force`
