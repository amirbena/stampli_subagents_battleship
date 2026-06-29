# Review Validity Schema

Every code review and security review report must include the metadata fields below. These fields are what the Team Lead's SHA Validity Gate (Step 14) reads before routing to release.

## Required Metadata: Code Review Report Header

```markdown
# Code Review Report

Workflow Run ID: <workflow-run-id>
Generated From Branch: <branch-name>
Generated From Commit: <full 40-character SHA — output of `git rev-parse HEAD` at time of review>
Generated At: <ISO-8601 timestamp>
Review Mode: full | delta
Review Purpose: minimal-contract | delta | final
Delta Base SHA: <SHA of the commit that was previously reviewed — omit for Review Mode: full>
Delta Changed Files:
  - <file path 1 — only when Review Mode: delta>
  - <file path 2>
```

**`Review Purpose` field:**
- `minimal-contract` — early classification gate for frontend-backend boundary contract risk; may run for CVE remediation or for any non-CVE finding that presents frontend-backend boundary contract risk before expensive Full E2E. Written to `code-review-minimal-contract.md`, NOT `code-review-report.md`. Does NOT satisfy the final Code Review release gate. Only used when E2E mode is `Full` and the Full E2E validates a flow that depends on the potentially broken frontend-backend contract.
- `delta` — post-fix re-review after a Small or Medium fix; written to `code-review-report.md`. Does NOT satisfy the final Code Review release gate unless Team Lead determines no additional changes were made.
- `final` — final Code Review after all validation evidence exists; written to `code-review-report.md`. Required for release. `Release PR Agent` must reject any `code-review-report.md` that lacks `Review Purpose: final`.

**SHA tracking for delta review loops (when minimal-contract review precedes a delta review):**
- When a minimal-contract review is run first, store its `Generated From Commit` SHA separately in `team-lead-plan.md` as `Minimal Contract Review SHA`.
- When the delta review loop begins (after a minimal-contract blocking finding is fixed), the `Delta Base SHA` for the first delta review is the `Minimal Contract Review SHA`, not the branch diverge point.
- Each subsequent delta review in the loop uses the prior delta review's `Generated From Commit` as the new `Delta Base SHA`.
- Team Lead must record all SHA transitions in `team-lead-plan.md`.

## Required Metadata: Security Report Header

```markdown
# Security Report

Workflow Run ID: <workflow-run-id>
Generated From Branch: <branch-name>
Generated From Commit: <full 40-character SHA — output of `git rev-parse HEAD` at time of review>
Generated At: <ISO-8601 timestamp>
Review Mode: full | delta
Delta Base SHA: <SHA of the commit that was previously reviewed — omit for Review Mode: full>
Delta Changed Files:
  - <file path 1 — only when Review Mode: delta>
  - <file path 2>
```

## Review Mode Definitions

| Mode | When to use | What to review |
|------|-------------|----------------|
| `full` | First review in a run, broad/architectural/cross-cutting change, or Large fix after a `REQUIRES CHANGES` verdict | All files changed since the branch diverged from `main` |
| `delta` | Post-fix re-review after a Small or Medium targeted fix was routed by Team Lead | Only the files that changed between `Delta Base SHA` and `HEAD` |
| `minimal-contract` | Optional early classification gate for frontend-backend boundary contract risk — invoked by Team Lead before expensive Full E2E when there is evidence or high risk that the frontend-backend contract changed or broke. May run for CVE remediation or for non-CVE findings. Only applies when E2E mode is `Full`; do not invoke for `Smoke` or `None` modes. See `cve-remediation-routing-policy.md` Section 6 for trigger and skip conditions. | Only dependency manifest/lockfile changes (or the changed files and callers for non-CVE findings), immediate callers, and contract-sensitive surfaces — type signatures, serialization shapes, HTTP headers, auth contracts |

**`minimal-contract` mode rules:**
- Always writes to `code-review-minimal-contract.md`, never to `code-review-report.md`
- Reports `Review Purpose: minimal-contract`
- A `PASS` verdict opens the path to the next required gate — it does NOT satisfy the final Code Review gate
- A `BLOCKING` verdict stops forward progress regardless of whether E2E is required

## Team Lead: SHA Validity Gate (Step 14)

Before routing to `release-pr-agent`, Team Lead runs:

```bash
git diff --name-only <last-reviewed-sha>..HEAD
```

Where `<last-reviewed-sha>` is the `Generated From Commit` SHA in the most recent `code-review-report.md`.

### Decision Table

| Files changed since last review | Action |
|---------------------------------|--------|
| No files changed | Review remains valid — proceed to release |
| Only `reports/**` or `*.md` documentation changed | Team Lead may keep review valid; record reason in release summary |
| Production code, tests, config, or contracts changed (Small or Medium fix) | Delta re-review: spawn `code-review-agent` with `Review Mode: delta`, passing `Delta Base SHA` |
| Broad, architectural, or cross-cutting change (Large fix) | Full re-review: spawn `code-review-agent` with `Review Mode: full` |

Security review re-check follows the same table but also applies when any change touches identity, session, auth, hidden-data boundary, or input sanitization — even if it is a Small fix.

## Post-Review Fix Severity Routing

When code review or security review returns `REQUIRES CHANGES`, Team Lead classifies the fix by severity before routing to the implementation agent.

### Small Fix

**Definition:** Test selector, copy/comment tweak, log message, minor assertion — no logic change, no contract change, no identity-sensitive code.

| Step | Action |
|------|--------|
| 1 | Route to owning agent with exact finding |
| 2 | Agent fixes and reruns `verification_command` |
| 3 | Team Lead runs SHA Validity Gate |
| 4 | Spawn `code-review-agent` with `Review Mode: delta` |
| 5 | Security re-review: **not required** (unless fix touches identity/auth/sanitization) |

### Medium Fix

**Definition:** API wrapper, hook, controller validation, serialization logic, error mapping, DTO field.

| Step | Action |
|------|--------|
| 1 | Route to owning agent with exact finding |
| 2 | Agent fixes and reruns `verification_command` |
| 3 | Team Lead runs SHA Validity Gate |
| 4 | Spawn `code-review-agent` with `Review Mode: delta` |
| 5 | Security re-review: **required** if fix touches identity, session, auth, hidden-data boundary, or input sanitization; otherwise skip |

### Large Fix

**Definition:** Contract change, new endpoint, new domain class, new state transition, or change spanning multiple layers.

| Step | Action |
|------|--------|
| 1 | Team Lead evaluates whether Architecture reopen is needed (counts against the 3-reopen run limit) |
| 2 | Route to owning agent(s) — may run backend + frontend in parallel if independent |
| 3 | Agent(s) fix and rerun their verification commands |
| 4 | Team Lead runs full test gate before re-review |
| 5 | Spawn `code-review-agent` with `Review Mode: full` |
| 6 | Spawn `security-agent` with `Review Mode: full` |
