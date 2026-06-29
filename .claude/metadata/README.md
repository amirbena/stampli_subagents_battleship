# metadata — Structured Agent Configuration

Runtime configuration files consumed by agents. Not policies (no rules here) — just
structured data that agents load to look up values, modes, and schemas.

## Sub-folders

| Folder | Purpose | Primary Consumer |
|---|---|---|
| `team-lead/` | Team Lead execution config | Team Lead |
| `review/` | Review lifecycle schema and severity routing | Team Lead, code-review-agent, security-agent |

## Files

### `team-lead/`

| File | Purpose |
|---|---|
| `execution-modes.yml` | Defines `cheap`, `normal`, and `full` execution modes — gate sets and token budgets |
| `route-matrix.yml` | Label-to-description map for all Team Lead routing decisions |

### `review/`

| File | Purpose |
|---|---|
| `review-validity-schema.md` | Defines Full / Delta review modes; Small / Medium / Large fix severity routing table |

### Root

| File | Purpose |
|---|---|
| `file-ownership.yml` | Canonical list of every agent's owned paths and the shared files list |
