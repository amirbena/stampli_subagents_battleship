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

## Completion signal — task-notification vs. ScheduleWakeup

When Team Lead spawns an agent with `run_in_background: true`, the harness
tracks it and emits a `task-notification` when the agent completes. Team Lead
is re-invoked automatically — no polling and no `ScheduleWakeup` call is
needed.

**Rules:**

- Do not call `ScheduleWakeup` while waiting for a harness-tracked background
  agent. The `task-notification` is the correct and sufficient completion signal.
- Do not ask the user to manually wake the workflow for harness-tracked
  background agents. Manual user wakeup is a failure mode, not the intended
  coordination mechanism.
- `ScheduleWakeup` is only appropriate for work the harness cannot track:
  CI pipelines, deployments, remote APIs, external queues, or long-running
  shell subprocesses launched with `&` (such as the E2E backend warmup in
  `e2e-warmup.md`).

**Intended flows:**

```
Harness-tracked work:
  Team Lead → run_in_background agent → harness tracks → task-notification
  → Team Lead resumes automatically

External / non-harness work:
  Team Lead → CI / deploy / shell subprocess / remote API
  → harness cannot track → ScheduleWakeup or shell poll loop is appropriate
```
