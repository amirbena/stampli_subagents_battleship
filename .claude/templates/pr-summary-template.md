# PR Summary Template
# Use this template for reports/runs/<workflow-run-id>/release-summary.md.
# Keep the PR body short and review-focused.
# Full audit trail (test output, agent logs, finding registry, retry history)
# stays in reports/runs/<workflow-run-id>/.

---

# Summary

## Requirement
<1–3 sentences describing what was requested>

## What Changed
- <main change 1>
- <main change 2>
- <main change 3>

## Validation

| Check | Result |
|---|---|
| Backend tests | PASS / SKIPPED — reason |
| Frontend tests | PASS / SKIPPED — reason |
| Build | PASS / SKIPPED — reason |
| Playwright smoke / E2E | PASS / SKIPPED — reason |
| Code review | APPROVED / APPROVED WITH RISKS / SKIPPED — reason |

## Risks / Notes
- <only include real risks, known gaps, or important reviewer notes>
- If none: `No known blocking risks.`

## Files Changed
- <main changed areas — not a full file-by-file dump unless the change is small>

<!-- ## Documentation Parity
Include this section ONLY when the PR modifies .claude/ files, agent definitions,
policies, metadata, templates, CLAUDE.md, or any governance artifact.
Omit entirely for pure application changes with no governance impact.

Updated:
- <file> — <what was updated>

Deferred:
- <file> — <reason> (severity: Low)
-->

---
# Only add sections beyond this when actually relevant to the reviewer:
# demo config changes, unresolved findings, security notes, architecture decisions.
# Do NOT include: retry tables, agent execution history, cost sections,
# infrastructure safety boilerplate, or "what was not changed" confirmations.
