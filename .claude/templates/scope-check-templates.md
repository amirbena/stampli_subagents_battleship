# Scope Check Templates

Report formats for Team Lead Step 7 ownership and scope verification.
Load this file and use the relevant section for each check.

---

## Ownership Check

Write to `reports/runs/<workflow-run-id>/ownership-check.md`:

```md
# Ownership Check

## Agent

## Assignment

## Allowed Paths

## Actual Changed Files

## Violations

## Decision

Pass / Escalate / Revert / Continue With Risk / Hard Block

## Reason

## Follow-up Action
```

---

## Diff Scope Check

Write to `reports/runs/<workflow-run-id>/diff-scope-check.md`:

```md
# Diff Scope Check

## Expected Changed Areas

## Actual Changed Files

## Out-Of-Scope Files

## Shared Files Changed

## Route Still Valid
Yes/No

## Mode Still Valid
Yes/No

## Required Escalation
None / Architecture / Security / Java Backend / Frontend / Config / Stronger Tests

## Decision
Continue / Escalate / Continue With Risk / Hard Block

## Reason
```
