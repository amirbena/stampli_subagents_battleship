# Agent Communication Policy

## Topology

This factory runs a strict tree. All inter-agent communication flows exclusively through
Team Lead. No execution agent may initiate contact with any other agent for any reason.

## Prohibited — all execution agents

The following tools and behaviors are prohibited for every agent except Team Lead:

- `SendMessage` — execution agents must not use this tool under any circumstances.
- `run_in_background` — execution agents must not pass this parameter on any tool call.
- `Agent(*)`  / `Skill(*)` — execution agents must not spawn, call, or invoke any other agent.
- Lateral contact — an execution agent must not contact a peer agent via any mechanism,
  including indirect patterns (writing to a shared file to trigger another agent, etc.).

If peer coordination is needed: stop, report the dependency in the Evidence section,
and return control to Team Lead. Do not fill the gap by spawning a subagent.

## Team Lead exceptions

Team Lead is the only entity permitted to:

- Spawn agents (via `Skill(*)`).
- Use `run_in_background` when governed by `.claude/policies/background-agent-policy.md`.
- Use `SendMessage` solely to monitor a background subagent Team Lead personally spawned.

## `AGENT_TEAMS` flag scope

`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled for background agent progress tracking
only. It does not authorize named persistent agents, lateral peer messaging, or any
communication pattern that bypasses Team Lead. All agents remain ephemeral and report
only upward to Team Lead.

## Escalation path

Report the gap in the Evidence section → return to Team Lead → await routing decision.
