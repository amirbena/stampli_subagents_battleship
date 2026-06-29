# requirement — Requirement Intake Agent

**Model:** `claude-opus-4-8`
**Spawned by:** User (entry point to the factory)

## Responsibility

First agent in every workflow run. Receives raw requirements from the user, creates a run-isolated directory under `reports/runs/<id>/`, writes `requirements.md`, guards branch safety, and hands off to Team Lead.

## Owns

| Path | Description |
|---|---|
| `reports/runs/<id>/requirements.md` | Canonical requirement document for the run |
| `reports/.workflow.lock` | Workflow lock — prevents concurrent runs |
| `templates/requirements-template.md` | Template for structuring requirements |

## Does Not Do

- Does not implement any code
- Does not spawn implementation agents directly (hands off to Team Lead)
- Does not make architectural or routing decisions

## Sub-folders

| Path | Contents |
|---|---|
| `templates/` | `requirements-template.md` |
