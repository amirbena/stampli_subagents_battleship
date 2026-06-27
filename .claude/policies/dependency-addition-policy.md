---
name: dependency-addition-policy
description: Governs dependency changes in package.json and pom.xml. Goal is visibility, reporting, validation, and risk-based review. Team Lead owns authorization. All changes must be auditable.
metadata:
  type: project
---

# Dependency Addition Policy

## Purpose

Dependency changes (additions, removals, and updates) are allowed when justified. The goal is **visibility, reporting, validation, and risk-based review** — not prohibition.

Every dependency change must be:
- Reported to Team Lead before the manifest is modified
- Validated by the implementing agent after authorization
- Included in the execution report using the dependency report template
- Included in the PR summary
- Escalated for Architecture or Security review when trigger conditions are met

## Default Rule

**Prefer existing dependencies.** Prefer platform capabilities and libraries already present in the project before introducing new ones.

No agent may modify `package.json` or `pom.xml` — to add, remove, or update a dependency — without explicit Team Lead authorization. Team Lead owns all dependency authorization and escalation decisions.

---

## Frontend Dependencies (package.json)

### Agent rules

`frontend-ui-agent` and `frontend-api-agent` must not run `npm install <package>` to add a new package.

If a package appears necessary:
1. **Stop** — do not install.
2. **Report to Team Lead** with:
   - Package name and version (if known)
   - Reason the existing dependencies are insufficient
   - Alternatives considered (including platform-native or already-installed options)
   - Whether Architecture or Security review may be required
3. **Wait** for Team Lead to authorize before touching `package.json`.

### Dependency validation (after authorization)

When `package.json` changes are authorized, the implementing agent (`frontend-ui-agent` or `frontend-api-agent`) must run the strongest available npm validation present in the repository:

1. `npm install` — verify dependency resolution succeeds with no errors
2. `npm audit` — run security audit; include full output or summary in execution report

Results must appear in the `## Dependency Report` block of the execution report. Do not omit the validation section even when no findings are present — write "No findings."

### Lockfile rule

- `package-lock.json` is always local-only.
- `package-lock.json` must never be staged, committed, or pushed.
- Running `npm install <package>` without Team Lead authorization is prohibited.
- `npm install` (no arguments) to restore existing dependencies is permitted; it must not result in net-new entries in `package.json`.

---

## Backend Dependencies (pom.xml)

### Agent rules

`java-backend-agent` must not modify `pom.xml` without Team Lead authorization.

If a dependency appears necessary:
1. **Stop** — do not edit `pom.xml`.
2. **Report to Team Lead** with:
   - Dependency `groupId:artifactId` and proposed version
   - Maven scope (`compile`, `provided`, `test`, `runtime`)
   - Reason the existing classpath is insufficient
   - Alternatives considered
   - Whether Architecture or Security review may be required
3. **Wait** for Team Lead to authorize before touching `pom.xml`.

### Dependency validation (after authorization)

When `pom.xml` changes are authorized, `java-backend-agent` must run the strongest available Maven validation present in the repository:

1. `./mvnw dependency:resolve` — verify all dependencies resolve successfully
2. `./mvnw dependency:tree` — capture dependency tree for audit trail
3. OWASP Dependency Check (`./mvnw org.owasp:dependency-check-maven:check`) — run only when already configured in `pom.xml`; do not add the plugin to enable this step

Results must appear in the `## Dependency Report` block of the execution report.

---

## Architecture Review Trigger

Architecture review is required when the dependency changes any of the following:

- System architecture or module boundaries
- Runtime model (e.g. adding a reactive stack, virtual threads)
- Persistence model (e.g. new ORM, new database driver)
- Communication model (e.g. new messaging library, WebSocket library)
- Deployment or runtime behavior (e.g. embedding a server, changing the classpath profile)
- Security model (e.g. authentication, authorization, secrets handling)
- Cross-agent contracts (shared types, serialization format)

When any of these apply, Team Lead must route to Architecture Agent before authorizing the dependency.

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

`test`-scoped and `devDependencies`-only additions do not automatically require security review, but Team Lead may require it when the library behavior is non-obvious.

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

Dependency changes must be visible in Team Lead decision records. No dependency change may be silently authorized.

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

Every authorized dependency change must be documented in the PR summary with:
- Package / artifact name and version
- Scope
- Reason
- Validation result summary (pass / findings)
- Reviews performed (Architecture / Security / none)

---

## Enforcement Points

| Agent | When | Action on violation |
|---|---|---|
| `code-review-agent` | Review checklist | Flag any `package.json` or `pom.xml` change lacking Team Lead authorization evidence; return `REQUIRES_CHANGES` |
| `release-pr-agent` | Pre-commit gate | Check `git diff --cached --name-only` for `package.json` / `pom.xml` changes; verify Team Lead authorization is recorded |

---

## Related

- `.claude/templates/dependency-report-template.md` — canonical dependency report block format
- `.claude/policies/gitignore-compliance-policy.md` — `package-lock.json` staging rules
- `.claude/metadata/file-ownership.yml` — pom.xml and package.json ownership declarations
- `.claude/skills/java-backend-agent/SKILL.md` — Maven dependency governance and validation
- `.claude/skills/frontend-ui-agent/SKILL.md` — npm dependency governance and validation
- `.claude/skills/frontend-api-agent/SKILL.md` — npm dependency governance and validation
- `.claude/skills/team-lead/SKILL.md` — dependency authorization, review, and escalation routing
- `.claude/skills/security-agent/SKILL.md` — dependency security review section
