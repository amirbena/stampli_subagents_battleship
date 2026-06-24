# Frontend Coding Standards
# Shared by: frontend-api-agent, frontend-ui-agent
# Load when implementing or reviewing frontend code.

## Comment Philosophy

Add a comment only when the WHY is non-obvious: a hidden constraint, a subtle invariant, a
workaround for a specific behaviour, or logic that would surprise a reader. Never describe WHAT
the code does — well-named identifiers already do that.

Required comment locations are layer-specific and defined in each agent's SKILL.md.

## Evidence Block

Every agent output must include this block:

```md
## Evidence

Files inspected:
Facts found:
Files changed:
Tests run:
Assumptions:
Unknowns:
```

Note: `frontend-ui-agent` additionally supports a cheap/simple mode variant for styling-only
changes — see its SKILL.md for the abbreviated form.

## Self-Heal Escalation Rule

Self-heal up to **5 cycles** before escalating to Team Lead. This applies to all build, test,
and lint failures. Do not escalate earlier unless the failure is definitively outside this
agent's ownership boundary.

The smoke gate has its own separate limit (3 cycles) defined in `frontend-ui-agent`'s SKILL.md —
this 5-cycle rule does not override it.

## Single-Agent Gate Commands

When Team Lead spawned only this agent (no parallel frontend agent), run the full frontend gate
before reporting done:

```bash
cd apps/frontend && npm run test    # full Vitest suite
cd apps/frontend && npm run build   # TypeScript + Vite
```

The running agent owns this gate end-to-end. Report done to Team Lead only after both commands
pass.
