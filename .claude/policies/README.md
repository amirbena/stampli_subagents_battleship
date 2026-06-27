# Policies

Policies are shared rules loaded by specific agents when relevant.

They must not define routing authority or gate advancement.
Team Lead remains the orchestrator.

## Policy Index

### Responsibility Boundaries and E2E

| Policy | Purpose | Primary loader |
|---|---|---|
| `agent-responsibility-boundaries-policy.md` | Defines what each agent (Requirement, Product, Architecture, Team Lead) may and must not decide; includes Architecture → Product REQUIRES_CHANGES routing | Requirement Intake, Product Agent, Architect Agent, Team Lead |
| `os-path-aware-execution-policy.md` | Rules for OS detection, path resolution from repo root, forbidden static paths, worktree isolation, runtime environment evidence | Team Lead (Step 5 pre-flight), Playwright E2E Agent |
| `e2e-dependency-preflight-policy.md` | E2E port conventions (frontend 3010, backend 8081), Chromium pre-gate with auto-install, E2E script verification, preflight checklist | Playwright E2E Agent, Team Lead (E2E pre-gate) |

### Governance

| Policy | Purpose | Primary loader |
|---|---|---|
| `agent-communication-policy.md` | Strict tree topology — prohibits SendMessage, run_in_background, and lateral peer contact for all execution agents | All execution agents (Team Lead Contract) |
| `background-agent-policy.md` | Governs Team Lead's use of run_in_background — result-collection rule, no gate advance while background outstanding | Team Lead (Step 6) |
| `dependency-addition-policy.md` | Governs dependency changes in `package.json` and `pom.xml`: visibility, reporting, validation, Team Lead authorization, Architecture/Security escalation triggers, and lockfile rules | java-backend-agent, frontend-ui-agent, frontend-api-agent, Team Lead (Dependency Policy), security-agent |
| `documentation-parity-policy.md` | Change-trigger matrix for keeping agent tables, file-ownership, routes, and policy README in sync | Team Lead (Step 0.5 and Step 14) |
| `requirement-intent-classification-policy.md` | WHAT-change vs DevEx WHAT-change vs HOW-change classification, refactor scope table, contract-change escalation rules; DevEx sub-type routes to Trigger 5 (skip Product, keep Architecture) | Team Lead (Step 0.5) |
| `qa-failure-routing-policy.md` | Routes QA findings back to Team Lead — defines which failures go to which agent | Team Lead (QA loop) |
| `test-failure-routing-policy.md` | Classification and routing table for all test failures (unit, integration, E2E, TypeScript compile) with self-heal rules and fix cycle limit | Team Lead (Step 7d) |
| `frontend-split-decision-policy.md` | Criteria for splitting into two frontend agents vs single agent — conservative defaults, split conditions, ownership boundaries, routing table | Team Lead (Step 6) |

### Backend

| Policy | Purpose | Primary loader |
|---|---|---|
| `backend-test-ownership-policy.md` | Defines @WebMvcTest (java-backend-agent) vs @SpringBootTest (backend-integration-tests-agent) decision table | java-backend-agent, backend-integration-tests-agent, Team Lead |
| `spring-test-runtime-policy.md` | @SpringBootTest justification format and exception-only trigger rules | backend-integration-tests-agent |
| `java-coding-standards.md` | Java style, naming, and Spring conventions | java-backend-agent |

### Frontend

| Policy | Purpose | Primary loader |
|---|---|---|
| `frontend-coding-standards.md` | TypeScript/React style, evidence block, single-agent and split-path gate commands, self-heal escalation | frontend-api-agent, frontend-ui-agent |
| `frontend-test-routing-policy.md` | Routes frontend test failures to the correct agent (api vs ui layer) | Team Lead (QA loop) |

### Infrastructure and Git

| Policy | Purpose | Primary loader |
|---|---|---|
| `git-preflight-policy.md` | Branch confirmation and Git Summary block required before any file edit | All implementation agents |
| `git-branch-policy.md` | Branch creation, sync, and naming decisions (Cases A–J); Case J triggers Step 5.5 similarity detection and routes to Cases A–I based on classification | Team Lead (Step 5) |
| `requirement-similarity-policy.md` | Defines same/extension/related/unrelated/unclear classifications, signal table, confidence rules, branch decision table, PR routing, and stash safety rules — loaded by Team Lead Step 5.5 only when a prior interrupted run was detected | Team Lead (Step 5.5, mandatory when Case J active) |
| `demo-config-policy.md` | Classifies demo/local config vs real credentials; defines what security review must flag | infrastructure-agent, security-agent |

### Artifact and Git Compliance

| Policy | Purpose | Primary loader |
|---|---|---|
| `reports-and-artifacts-policy.md` | Declares `reports/` as local execution evidence — never staged or committed; PR descriptions may summarise but not commit report files; prevents `reports/**` from entering git history | release-pr-agent (pre-commit gate), code-review-agent (review checklist), Team Lead (QA loop routing) |
| `gitignore-compliance-policy.md` | Files matching `.gitignore` must not be staged or committed; `package-lock.json` is always local-only — always in `.gitignore`, never tracked, never staged or pushed; defines verification commands and enforcement points | release-pr-agent (pre-commit gate), code-review-agent (review checklist), Team Lead (QA loop routing), frontend-api-agent, frontend-ui-agent, infrastructure-agent |
