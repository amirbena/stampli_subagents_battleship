# Background Agent Policy

## Authority

Only Team Lead may use `run_in_background: true` on any agent invocation.
No execution agent may pass `run_in_background` under any circumstances.

## When background execution is permitted

Team Lead may background an agent only when all of the following are true:

1. The agent's task is fully independent of all other currently running agents
   (no shared file writes, no ordering dependency, no gate dependency).
2. The backgrounded agent produces a self-contained report that Team Lead
   can read and validate when it completes.
3. The invocation is recorded in `reports/runs/<workflow-run-id>/team-lead-plan.md`
   with the agent name and expected output path.

## Result-collection rule

No gate may be marked complete while any background agent result is outstanding.

Team Lead must:
1. Confirm the background agent has completed before advancing any gate.
2. Read and validate the agent's output report.
3. Record the completion in `team-lead-plan.md` before marking the gate done.

If a background agent fails or times out, Team Lead must handle the failure
(re-run, escalate, or write a workflow-blocker) before advancing.

## SendMessage scope

`SendMessage` is permitted for Team Lead solely to check the status of a
background agent Team Lead personally spawned. It must not be used to send
instructions or data to any agent, and must not be used to contact a peer agent.

## Escalation path

If Team Lead cannot safely proceed without a background agent's result:
pause the current gate → wait for completion → validate result → resume.
Do not advance gates optimistically.
