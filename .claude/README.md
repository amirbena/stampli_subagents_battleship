# .claude — Gen4 Agent Factory Configuration

This directory contains all governance, skills, policies, templates, metadata, and runbooks
for the Gen4 multi-agent Battleship factory.

## Top-Level Structure

| Folder | Purpose |
|---|---|
| `skills/` | Agent skill definitions — one sub-folder per agent, each containing `SKILL.md` |
| `policies/` | Governance policies — global rules plus family sub-folders (java, frontend, e2e) |
| `metadata/` | Structured config consumed by agents at runtime (YML/MD) |
| `templates/` | Fill-in-the-blank report and artifact templates |
| `runbooks/` | Step-by-step operational sequences (e.g. E2E warmup) |

## Placement Rule

Every file lives at the **narrowest scope that covers all its consumers**:

| Scope | Location |
|---|---|
| Global (all agents) | `policies/` |
| Java family | `policies/java/` |
| Frontend family | `policies/frontend/` |
| E2E family | `policies/e2e/` |
| Team Lead only | `skills/team-lead/policies/` |
| Team Lead metadata | `metadata/team-lead/` |
| Team Lead templates | `templates/team-lead/` |
| Review metadata | `metadata/review/` |
| Review templates | `templates/review/` |
| Architecture templates | `templates/architecture/` |
| Agent-local templates | `skills/<agent>/templates/` |

See `policies/README.md` for the full policy index.
