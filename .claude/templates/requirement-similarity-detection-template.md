# Requirement Similarity Detection

Use this template for `reports/runs/<workflow-run-id>/requirement-similarity-detection.md`.
Written by Team Lead Step 5.5. Only generated when an interrupted prior run was detected.

---

# Requirement Similarity Detection

Workflow Run ID:
Generated At:

## Run Context

Prior Run ID:
Prior Branch:
Prior PR: #<number> (<state: open|closed|merged>) or N/A
Stash Ref: <stash ref, e.g. stash@{0}> or N/A
Stash Message: <full stash message> or N/A

New Requirement Summary:
Prior Requirement Summary:

## Signal Evaluation

| Signal | Result | Evidence |
|---|---|---|
| Branch slug alignment | high / medium / low / N/A | <new slug vs prior branch name> |
| Requirement area overlap | match / partial / mismatch / N/A | <domain compared, e.g. "CORS config vs auth headers"> |
| Acceptance criteria inheritance | same / superset / extension / different / N/A | <brief comparison of AC lists> |
| Dirty file scope match | match / mismatch / no stash / N/A | <files in stash vs new requirement scope> |
| Prior PR alignment | match / mismatch / unavailable | <PR title/body vs new requirement, or "gh unavailable"> |

## Classification

Similarity Classification: same | extension | related | unrelated | unclear
Confidence: high | medium | low
Reason: <one sentence explaining the classification>

## Decision

Branch Action: <e.g. "continue on feature/cors-multi-port-origins after rebase" / "create new branch from main">
Stash Action: leave — ref recorded (stash pop/drop are not performed in PR 2)
PR Action: <e.g. "continue existing PR #37" / "create new PR at end of run" / "N/A">
Case Applied: <A / B / C / D / G / H / I — whichever Case from git-branch-policy.md was used>
Reason: <one sentence explaining the combined branch + PR decision>

## Deferred Items

The following are out of scope for this PR and must not be implemented:
- Automatic stash pop / apply (deferred to future PR after human review)
- Advanced PR body diff summarization
- Heartbeat-based staleness detection (PR 1b)
- Auto-resume from mid-agent (future PR)
- Vector / embedding semantic similarity
