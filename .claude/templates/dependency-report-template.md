---
name: dependency-report-template
description: Canonical block format for dependency manifest changes. Every agent that modifies package.json or pom.xml must include this block in its execution report. Consumed by Team Lead for dependency review and escalation decisions.
---

# Dependency Report Template

## Usage

Every agent that modifies `package.json` or `pom.xml` must include a `## Dependency Report` block in its execution report using the format below.

Do not omit the validation section even when no findings are present — write "No findings." Do not leave any field blank; use `N/A` only when a field genuinely does not apply.

Team Lead reads this block to record the change in `team-lead-plan.md` and to decide whether Architecture or Security review is required.

---

## Block Format

```md
## Dependency Report

### Dependency Manifest Changes

| Field | Value |
|---|---|
| Manifest changed | `package.json` / `pom.xml` / both |
| Files changed | (list exact paths) |
| Team Lead review | Recorded in `reports/runs/<id>/team-lead-plan.md` under `## Dependency Changes` |

#### Added Dependencies

| Package / Artifact | Version | Scope | Reason |
|---|---|---|---|
| `example-lib` | `1.2.3` | `dependencies` / `compile` | Why it is needed |

#### Removed Dependencies

| Package / Artifact | Version | Scope | Reason |
|---|---|---|---|
| `example-lib` | `1.2.3` | `devDependencies` / `test` | Why it was removed |

#### Updated Dependencies

| Package / Artifact | Previous Version | New Version | Scope | Reason |
|---|---|---|---|---|
| `example-lib` | `1.1.0` | `1.2.3` | `dependencies` / `compile` | Why it was updated |

#### Expected Impact

(Describe the expected runtime, build, and behavioral impact of these changes.)

---

### Dependency Validation

#### Tool Executed

(List the validation commands run. Examples:
- `./mvnw dependency:resolve`
- `./mvnw dependency:tree`
- `./mvnw org.owasp:dependency-check-maven:check` — only if plugin is already configured
- `npm install`
- `npm audit`)

#### Result

- [ ] All dependencies resolved successfully
- [ ] No resolution errors
- [ ] Audit / security check completed

#### Findings

(Paste relevant output summary. If no issues found, write "No findings.")

#### Failed Checks

(List any checks that could not be run and why. Write "None" if all ran successfully.)

#### Tool Not Available

(If a validation tool is not configured in this repository — e.g. OWASP plugin not in pom.xml — record it here. Write "N/A" if all tools are available and ran.)

---

### CVE Remediation Fields (optional — include only when this report is for a CVE fix)

| Field | Value |
|---|---|
| CVE ID | (e.g. `CVE-2024-12345` — or audit finding reference if no CVE ID) |
| Affected package | (name of vulnerable package) |
| Current vulnerable version | (version before this fix) |
| Fixed version or safe range | (version applied or range that resolves the CVE) |
| Direct or transitive | `direct` / `transitive` |
| Severity / CVSS score | (e.g. `High / 8.1` — write `Unknown` if not available) |
| Remediation type | `patch` / `minor` / `major` / `override` / `exclusion` / `dependencyManagement` |
| Breaking-change risk | `none` / `low` / `high` / `unknown` |
| Supply-chain concerns | (confirm patch is from original maintainer; flag if unsigned or from unknown fork) |
| Security verification command | (e.g. `npm audit`, `./mvnw dependency:check`) |
| Security verification result | (paste relevant audit output confirming the CVE is resolved) |
| No compatible safe version | `false` / `true: <explanation>` |
```

---

## Rules

- Include this block for every execution that touches `package.json` or `pom.xml`.
- Include the block even for minor changes (e.g. version bump, removal).
- Do not omit validation results — record "No findings" if the audit found nothing.
- Team Lead must not approve release without reviewing this block when a manifest changed.

## Governance Reference

Load `.claude/policies/dependency-addition-policy.md` for escalation trigger conditions and reporting requirements.
