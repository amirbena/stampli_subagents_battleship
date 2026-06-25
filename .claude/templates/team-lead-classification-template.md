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

## Interrupted Run Recovery

Prior Run Detected: Yes / No
Prior Run ID: <id> or N/A
Lock Age at Detection: <N minutes> or N/A
Stash Created: Yes / No
Stash Ref: <ref> or N/A
Stash Message: <message> or N/A
Recovery Report: reports/runs/<id>/interrupted-run-detection.md or N/A

## Requirement Similarity Detection

Triggered: Yes / No
Classification: same | extension | related | unrelated | unclear | N/A
Confidence: high | medium | low | N/A
Report: reports/runs/<id>/requirement-similarity-detection.md or N/A
Branch Outcome: <what was decided, e.g. "continue on feature/cors-multi-port-origins" / "new branch from main">
Stash Outcome: leave — ref recorded / N/A
PR Outcome: continue existing #<N> / new PR / N/A
Note: Stash pop and stash drop are not performed by similarity detection. Stash contents
      are left in place for human or agent inspection via the ref above.

## Workflow Metadata

Workflow Run ID:
