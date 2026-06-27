---
name: dependency-addition-policy
description: Governs when and how agents may add or modify dependencies in package.json (frontend) and pom.xml (backend). Default is no additions without Team Lead authorization.
metadata:
  type: project
---

# Dependency Addition Policy

## Default Rule

**Do not add dependencies.** Prefer platform capabilities and libraries already present in the project.

No agent may install or add a dependency — to either `package.json` or `pom.xml` — without explicit Team Lead authorization. Team Lead owns all dependency authorization decisions.

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

### Lockfile rule

- `package-lock.json` is always local-only.
- `package-lock.json` must never be staged, committed, or pushed.
- Running `npm install <package>` without Team Lead authorization is prohibited.
- Routine `npm install` (no arguments) to restore existing dependencies is permitted; it must not result in net-new entries in `package.json`.

---

## Backend Dependencies (pom.xml)

### Agent rules

`java-backend-agent` must not add a Maven dependency to `pom.xml` without Team Lead authorization.

If a dependency appears necessary:
1. **Stop** — do not edit `pom.xml`.
2. **Report to Team Lead** with:
   - Dependency `groupId:artifactId` and proposed version
   - Maven scope (`compile`, `provided`, `test`, `runtime`)
   - Reason the existing classpath is insufficient
   - Alternatives considered
   - Whether Architecture or Security review may be required
3. **Wait** for Team Lead to authorize before touching `pom.xml`.

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

## Documentation

Every authorized dependency addition must be documented in the PR summary with:
- Package / artifact name and version
- Scope
- Reason
- Reviews performed (Architecture / Security / none)

---

## Enforcement Points

| Agent | When | Action on violation |
|---|---|---|
| `code-review-agent` | Review checklist | Flag any `package.json` or `pom.xml` change lacking Team Lead authorization evidence; return `REQUIRES_CHANGES` |
| `release-pr-agent` | Pre-commit gate | Check `git diff --cached --name-only` for `package.json` / `pom.xml` changes; verify Team Lead authorization is recorded |

---

## Related

- `.claude/policies/gitignore-compliance-policy.md` — `package-lock.json` staging rules
- `.claude/skills/java-backend-agent/SKILL.md` — Maven dependency governance section
- `.claude/skills/frontend-ui-agent/SKILL.md` — npm dependency governance section
- `.claude/skills/frontend-api-agent/SKILL.md` — npm dependency governance section
- `.claude/skills/team-lead/SKILL.md` — dependency authorization routing
