---
name: dependency-addition-policy
description: Governs dependency changes in package.json and pom.xml. Goal is visibility, reporting, validation, and risk-based review. Agents add independently; Team Lead reviews and decides escalation. All changes must be auditable.
metadata:
  type: project
---

# Dependency Addition Policy

## Purpose

Dependency changes (additions, removals, and updates) are allowed when justified. The goal is **visibility, reporting, validation, and risk-based review** — not prohibition.

Every dependency change must be:
- Added by the implementing agent when justified, without pre-authorization
- Validated by the implementing agent immediately after the change
- Reported to Team Lead via the `## Dependency Report` block in the execution report
- Included in the PR summary
- Escalated for Architecture or Security review by Team Lead when trigger conditions are met

## Default Rule

**Prefer existing dependencies.** Prefer platform capabilities and libraries already present in the project before introducing new ones.

Implementing agents may add, remove, or update dependencies independently when justified. Pre-authorization from Team Lead is not required. Team Lead reviews the dependency report after the fact and decides on escalation.

## Product Agent

Dependency addition alone does **not** trigger Product Agent. Product is involved only when the dependency is part of a user-visible behavior change, a new product capability, a UX change, an API contract change exposed to users, or an acceptance-criteria change.

---

## Frontend Dependencies (package.json)

### Agent rules

When a new frontend package is necessary, `frontend-ui-agent` or `frontend-api-agent` adds it directly. No pre-authorization required.

### Dependency validation (after change)

When `package.json` changes are authorized, the implementing agent (`frontend-ui-agent` or `frontend-api-agent`) must run the strongest available npm validation present in the repository:

1. `npm install` — verify dependency resolution succeeds with no errors
2. `npm audit` — run security audit; include full output or summary in execution report

Results must appear in the `## Dependency Report` block of the execution report. Do not omit the validation section even when no findings are present — write "No findings."

### Lockfile rule

- `package-lock.json` is always local-only.
- `package-lock.json` must never be staged, committed, or pushed.
- Running `npm install <package>` updates `package.json` — always follow with validation and include a `## Dependency Report` in the execution report.
- `npm install` (no arguments) to restore existing dependencies is permitted; it must not result in net-new entries in `package.json`.

---

## Backend Dependencies (pom.xml)

### Agent rules

When a new Maven dependency is necessary, `java-backend-agent` or `backend-integration-tests-agent` adds it directly. No pre-authorization required. `backend-integration-tests-agent` is limited to `scope=test` dependencies only.

### Dependency validation (after change)

When `pom.xml` changes are authorized, `java-backend-agent` must run the strongest available Maven validation present in the repository:

1. `./mvnw dependency:resolve` — verify all dependencies resolve successfully
2. `./mvnw dependency:tree` — capture dependency tree for audit trail
3. OWASP Dependency Check (`./mvnw org.owasp:dependency-check-maven:check`) — run only when already configured in `pom.xml`; do not add the plugin to enable this step

Results must appear in the `## Dependency Report` block of the execution report.

---

## Architecture Review Trigger

Dependency addition alone does **not** trigger Architecture Agent. Architecture is triggered only when the dependency materially affects the architecture:

- Runtime boundaries (e.g. adding a reactive stack, virtual threads, embedded server)
- Service contracts or cross-agent shared types / serialization format
- Persistence model (e.g. new ORM, new database driver, schema migration tooling)
- Networking or communication model (e.g. new HTTP client, WebSocket library, messaging library)
- Authentication or authorization model
- Deployment topology or classpath profile
- Observability strategy (e.g. new metrics or tracing library that changes the instrumentation model)
- Long-term maintainability or ownership (e.g. replacing a core framework, adding a second ORM)

When any of these apply, Team Lead routes to Architecture Agent. This is a routing decision, not a blocking gate — Team Lead records the decision and sequences Architecture alongside or before the next implementation step.

---

## Security Review Trigger

Security review is required for **production-scoped** dependencies touching any of the following areas:

| Area | Examples |
|---|---|
| Authentication / authorization | Spring Security, JWT libs, OAuth clients |
| Secrets handling | Vault clients, credential managers |
| Networking | HTTP clients, WebSocket impls, proxy libs |
| Serialization | Jackson alternatives, Protobuf, Avro |
| File handling | File I/O libs, archive libs |
| Browser APIs | `window.*` wrappers, file-system access, clipboard |
| External integrations | Payment SDKs, email clients, analytics |
| Data handling | Encryption libs, hashing libs, PII processing |

`test`-scoped and `devDependencies`-only additions do **not** automatically require security review when they have no runtime exposure and do not affect auth, secrets, networking, persistence, serialization, file handling, code execution, build output, or deployment behavior. Security may still be triggered if the dependency is unknown or suspicious, executes install scripts, affects build output, is flagged by audit tooling, or otherwise presents supply-chain risk.

## CVE Remediation Carve-Out

When Security Agent has identified a CVE and reported a recommended remediation path, implementation agents may apply **minimal safe CVE remediations without pre-patch Security review**, provided all of the following are true:

- Security Agent (or a dependency audit tool/advisory) has already identified the CVE and the fix path
- The remediation type is `patch` or `minor` (no major version upgrade, no override/exclusion/replacement)
- The affected package is an **existing dependency in the same package family** (see same-package-family definition in `.claude/skills/team-lead/policies/cve-remediation-routing-policy.md`)
- The change is a manifest/lockfile/base-image update with no risky strategy change (no new transitive pull-in of suspicious packages, no new install scripts)
- The implementing agent emits a complete `## Dependency Report` block including all CVE fields
- Security closure still happens after the remediation is applied

**The CVE remediation carve-out takes precedence over the generic production-scoped dependency Security-review trigger** only for straightforward patch/minor remediation on an existing dependency family. The full Security review trigger continues to apply to: new dependency additions, dependency replacement, override/exclusion strategies, parent-major upgrades, high/unknown security risk, security-sensitive behavior changes, suspicious supply-chain behavior, new install/build scripts, no-compatible-safe-version paths.

### What implementation agents may do under the carve-out

- Apply safe patch/minor version bumps to existing packages in the same family
- Update manifest (`package.json` / `pom.xml`) and lockfile
- Update Dockerfile base image or container config when infrastructure-owned (same image family, patch/minor tag update)
- Run basic audit/dependency verification (`npm audit`, `./mvnw dependency:resolve`, `./mvnw dependency:tree`)
- Record: CVE ID, affected package, previous version, fixed version/range, direct/transitive status, production-impacting scope, remediation type, and breaking-change risk if known
- Run relevant build/unit/integration/startup checks appropriate to their layer
- Report blockers, unsafe version gaps, or uncertainty to Team Lead

### What implementation agents must not do

Implementation agents must never own:
- Security risk acceptance (deciding an unresolved CVE is acceptable to ship)
- Deciding that no compatible safe version exists without escalating to Team Lead + Security
- Approving override/exclusion/replacement safety
- Approving auth/crypto/session/deserialization security behavior changes
- Supply-chain risk acceptance
- Final CVE closure verification

These decisions belong to Team Lead + Security Agent.

---

## Validation Mode Preservation

**Validation mode is plan-owned, not dependency-owned.** The validation mode selected in the Team Lead work plan (`cheap` / `normal` / `full` / `E2E`) reflects the risk profile of the planned change. A dependency update — including CVE remediation — must not downgrade or replace that mode.

An implementing agent may add targeted dependency validation steps (e.g. `npm audit`, `./mvnw dependency:resolve`) as additive checks alongside the original gates. These do not substitute for the original quality gates.

---

## Dependency Reporting

Every dependency change must be reported using the `## Dependency Report` block defined in `.claude/templates/dependency-report-template.md`.

**Required fields:**
- Manifest changed (`package.json` / `pom.xml`)
- Added, removed, and updated dependencies (name, version, scope, reason)
- Expected impact
- Validation tool executed
- Validation result and findings

This block is included in the implementing agent's execution report. No manifest change may be omitted.

## Team Lead Review

When a dependency change is reported, Team Lead must:

1. Read the `## Dependency Report` block in the agent's execution report.
2. Review dependency validation results (resolution output, audit / tree summary).
3. Record the dependency change under `## Dependency Changes` in `reports/runs/<workflow-run-id>/team-lead-plan.md`.
4. Include the dependency change in the final PR summary.
5. Decide whether Architecture review is required (see Architecture Escalation triggers).
6. Decide whether Security review is required (see Security Escalation triggers).

Dependency changes must be visible in Team Lead decision records. No dependency change may be omitted from the report.

## Security Review Integration

Team Lead decides whether Security review is required:

**Reuse existing Security review** when Security Agent is already running in this workflow and the dependency change falls naturally within its scope. Team Lead records this decision in `team-lead-plan.md`.

**Trigger additional Security review** when any of the following applies:
- New production-scoped dependency introduced
- Major version upgrade authorized
- Dependency validation reports findings (`npm audit` severity High or Critical, or OWASP findings)
- Team Lead identifies elevated risk

When Security Agent reviews a dependency:
- Security Agent may run available dependency security tooling
- Security Agent may perform a dependency sanity review
- Security Agent verifies validation results
- Findings are returned to Team Lead with owner routing
- Team Lead routes remediation and tracks resolution

## Documentation

Every dependency change must be documented in the PR summary with:
- Package / artifact name and version
- Scope
- Reason
- Validation result summary (pass / findings)
- Reviews performed (Architecture / Security / none)

---

## Enforcement Points

| Agent | When | Action on violation |
|---|---|---|
| `code-review-agent` | Review checklist | Flag any `package.json` or `pom.xml` change lacking a `## Dependency Report` block in the execution report; return `REQUIRES_CHANGES` |
| `release-pr-agent` | Pre-commit gate | Check `git diff --cached --name-only` for `package.json` / `pom.xml` changes; verify a dependency report is recorded in `team-lead-plan.md` |

---

## Related

- `.claude/templates/dependency-report-template.md` — canonical dependency report block format
- `.claude/policies/gitignore-compliance-policy.md` — `package-lock.json` staging rules
- `.claude/metadata/file-ownership.yml` — pom.xml and package.json ownership declarations
- `.claude/skills/java-backend-agent/SKILL.md` — Maven dependency governance and validation
- `.claude/skills/frontend-ui-agent/SKILL.md` — npm dependency governance and validation
- `.claude/skills/frontend-api-agent/SKILL.md` — npm dependency governance and validation
- `.claude/skills/team-lead/SKILL.md` — dependency review, escalation routing
- `.claude/skills/security-agent/SKILL.md` — dependency security review section
