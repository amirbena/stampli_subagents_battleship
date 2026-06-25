# Team Lead Classification Template

Use this template for `reports/runs/<workflow-run-id>/team-lead-classification.md`.
Load and fill in every field. Additional sections (Scope Validation from Step 1b,
Branch Decision from Step 5, Documentation Parity Impact from Step 0.5) are appended
to this file as the run progresses.

---

# Team Lead Classification

Workflow Run ID:
Generated From Branch:
Generated From Commit:
Generated At:

## Decision Tree Evaluation

| Step | Question | Answer | Reason |
|---|---|---|---|
| 1 | Docs-only? | Yes/No | ... |
| 2 | UI-only? | Yes/No | ... |
| 3 | Java backend behavior affected? | Yes/No | ... |
| 4 | API/shared contract affected? | Yes/No | ... |
| 5 | Auth/session/user data affected? | Yes/No | ... |
| 6 | Multiplayer/sync/hidden data affected? | Yes/No | ... |
| 7 | Demo config / dotenv affected? | Yes/No | ... |
| 8 | Infra/CI/deployment affected beyond allowed config? | Yes/No | ... |

## Classification Route

docs-only / frontend-only / java-backend-only / backend-and-frontend / config-aware / infra / auth-security / multiplayer-session / full-stack-complex

## Architecture Required

Yes / No

## Architecture Decision Reason

## Execution Mode

cheap / normal / full

## Agents To Run

## Agents To Skip

## Runtime / Build / Test Failure Routing Policy

How failures should be routed if validation fails.

## Demo Config Policy

Does this requirement need visible config?
Are values demo/local/placeholder?
Is human setup required?

## Risk Notes

## Workflow Metadata

Workflow Run ID:
