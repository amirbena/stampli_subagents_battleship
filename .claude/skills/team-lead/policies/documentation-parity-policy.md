# Documentation Parity Policy

## Purpose

Prevent governance documentation from drifting out of sync when agent definitions,
policies, metadata, or templates are modified.

## When this policy applies

Load this policy and perform a parity impact check when the current requirement modifies
any of the following:

| Changed artifact | Documentation that must stay in sync |
|---|---|
| Agent SKILL.md (new section, ownership, contract, trigger) | CLAUDE.md agent table; `file-ownership.yml` ownership list |
| New agent added | CLAUDE.md agent table; `file-ownership.yml`; `route-matrix.yml` |
| Agent removed or renamed | All of the above |
| New policy file created | `.claude/policies/README.md` |
| Policy file deleted or renamed | `.claude/policies/README.md` |
| Route added or changed | `route-matrix.yml`; CLAUDE.md if route affects agent table |
| Execution mode gate changed | `execution-modes.yml` |
| Quality gate added or removed | CLAUDE.md Quality Gates section; `execution-modes.yml` |
| File ownership changed | `file-ownership.yml`; agent SKILL.md Ownership section |
| Template added or renamed | Load reference in owning agent SKILL.md |
| Metadata file added or renamed | Load reference in Team Lead or owning agent SKILL.md |

## Parity impact check — required in Team Lead Step 0.5

1. Read the requirement and identify which artifact types above are affected.
2. For each match, record the required documentation update in
   `reports/runs/<workflow-run-id>/team-lead-classification.md`
   under `## Documentation Parity Impact`.
3. Assign each parity item a severity:
   - **High** — agent table, file-ownership, or route-matrix drift. These are queried
     at runtime by Team Lead. Stale entries cause mis-routing.
   - **Low** — policy README, template reference, or cosmetic naming drift.

## Pre-release gate — required in Team Lead Step 14

Before routing to Release PR Agent, Team Lead must:

1. Re-read the parity impact list from `team-lead-classification.md`.
2. Verify each required update was applied in this run.
3. For any **High**-severity item not yet applied: apply it before release. This is blocking.
4. For any **Low**-severity item not yet applied: document in PR summary under
   `## Documentation Parity` and defer with reason. This is not blocking.

## PR summary requirement

If any parity updates were required in this run, the release summary must include:

```md
## Documentation Parity

Updated:
- <file> — <what was updated>

Deferred:
- <file> — <reason> (severity: Low)
```

Omit this section entirely for runs where no parity impact was identified.
