# templates — Report and Artifact Templates

Fill-in-the-blank templates that agents load and populate when producing reports or artifacts.
Templates are not policies — they contain no rules, only structure.

## Sub-folders

| Folder | Purpose | Primary Consumer |
|---|---|---|
| `team-lead/` | Team Lead planning and classification templates | Team Lead |
| `review/` | Code review and security review finding templates | code-review-agent, security-agent |
| `architecture/` | Architecture phase templates | architect-agent, Team Lead |

## Files

### Root

| File | Purpose |
|---|---|
| `dependency-report-template.md` | `## Dependency Report` block required in every agent execution report when dependencies change |

### `team-lead/`

| File | Purpose |
|---|---|
| `team-lead-classification-template.md` | Intent classification output — written to `team-lead-classification.md` |
| `team-lead-execution-plan-template.md` | Full execution plan — written to `team-lead-plan.md` |
| `requirement-similarity-detection-template.md` | Interrupted-run similarity detection output |
| `scope-check-templates.md` | Ownership check and diff scope check report blocks |
| `critical-path-report-template.md` | Phase timing report written after release |

### `review/`

| File | Purpose |
|---|---|
| `finding-report-template.md` | Individual finding block (CR-001 / SEC-001) used in code review and security reports |

### `architecture/`

| File | Purpose |
|---|---|
| `ac-coverage-matrix-template.md` | AC-to-Test Coverage Matrix — column definitions and example rows |
