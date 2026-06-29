# team-lead/policies — Team Lead Internal Policies

These policies are consumed exclusively by Team Lead. They govern routing decisions,
classification logic, QA loops, and branch operations. Execution agents do not load these.

## Files

| File | Purpose | Loaded At |
|---|---|---|
| `requirement-intent-classification-policy.md` | WHAT-change / DevEx WHAT-change / HOW-change classification; refactor scope table; Trigger 5 fast-path | Step 0.5 |
| `requirement-similarity-policy.md` | Interrupted-run similarity detection; branch routing (same / extension / related / unrelated / unclear) | Step 5.5 (interrupted runs only) |
| `git-branch-policy.md` | Branch creation, sync, naming — Cases A–J; multi-team safety guards; rebase sequences | Step 5 (when a branch operation is needed) |
| `background-agent-policy.md` | `run_in_background` usage rules; task-notification vs ScheduleWakeup completion signal | Step 6 (before spawning background agents) |
| `frontend-split-decision-policy.md` | Single-agent vs split-agent decision criteria; ownership boundaries; routing table | Step 6 (frontend changes) |
| `frontend-test-routing-policy.md` | Routes frontend test failures to the correct agent (api vs ui vs integration) | Step 7d (frontend test failures) |
| `qa-failure-routing-policy.md` | Routes all QA failures back to the owning agent; E2E re-trigger ownership | QA loop |
| `test-failure-routing-policy.md` | Classification and routing table for unit, integration, E2E, and TypeScript compile failures; self-heal rules | Step 7d |
| `documentation-parity-policy.md` | Change-trigger matrix — which documentation must be updated when governance files or agent ownership changes | Step 0.5 and Step 14 |
