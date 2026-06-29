# team-lead — Team Lead Agent

**Model:** `claude-opus-4-8`
**Spawned by:** Requirement Intake agent

## Responsibility

Autonomous cost-aware orchestrator. Reads requirements, classifies intent, plans execution, spawns implementation agents, tracks QA loops, runs quality gates, and makes the final release decision. Team Lead is the only agent that routes other agents.

## Owns

| Path | Description |
|---|---|
| `reports/runs/<id>/team-lead-classification.md` | Intent classification output |
| `reports/runs/<id>/team-lead-plan.md` | Execution plan |
| `reports/runs/<id>/ownership-check.md` | File ownership verification |
| `reports/runs/<id>/diff-scope-check.md` | Diff scope verification |
| `reports/runs/<id>/critical-path.md` | Phase timing report |

## Does Not Do

- Does not write product code under `apps/`
- Does not write `SKILL.md` or policy files (governance changes go through the full workflow)
- Does not bypass quality gates

## Sub-folders

| Path | Contents |
|---|---|
| `policies/` | Team Lead-only routing and classification policies (see `policies/README.md`) |
