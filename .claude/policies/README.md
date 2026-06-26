# Governance Policies

This directory contains governance policies for the Gen4 multi-agent Battleship factory.

## Policy Placement Rule

Files directly under `.claude/policies/` are **global policies** that apply broadly across the system.
Narrower policies live under family folders or agent-local folders.
Future policies should be placed at the **narrowest correct ownership scope**.

| Scope | Location | Load By |
|---|---|---|
| Global (all agents) | `.claude/policies/` | All agents |
| Java family | `.claude/policies/java/` | java-backend-agent, backend-integration-tests-agent, Team Lead (routing) |
| Frontend family | `.claude/policies/frontend/` | frontend-api-agent, frontend-ui-agent |
| E2E family | `.claude/policies/e2e/` | playwright-e2e-agent, Team Lead (E2E pre-gate) |
| Team Lead only | `.claude/skills/team-lead/policies/` | Team Lead |

## Global Policies (directly under `.claude/policies/`)

These apply to all agents or all implementation agents:

| File | Purpose | Primary Loaders |
|---|---|---|
| `agent-communication-policy.md` | Strict tree topology; prohibits lateral contact | All agents |
| `agent-responsibility-boundaries-policy.md` | Defines which agent owns which decision type; Architecture→Product reopen flow | Requirement, Product, Architect, Team Lead |
| `dependency-addition-policy.md` | Governs dependency changes in `package.json` and `pom.xml`: visibility, reporting, validation, Team Lead authorization, Architecture/Security escalation triggers, and lockfile rules | java-backend-agent, frontend-ui-agent, frontend-api-agent, Team Lead, security-agent |
| `git-preflight-policy.md` | Branch confirmation + Git Summary block required before any file edit | All implementation agents |
| `gitignore-compliance-policy.md` | Files matching `.gitignore` must not be staged; `package-lock.json` always local | release-pr-agent, code-review-agent, all agents |
| `reports-and-artifacts-policy.md` | `reports/` is local execution evidence — never staged or committed | release-pr-agent, code-review-agent, Team Lead |
| `demo-config-policy.md` | Classifies demo/local config vs real credentials; what security must flag | infrastructure-agent, security-agent |

## Java Family Policies (`.claude/policies/java/`)

| File | Purpose | Primary Loaders |
|---|---|---|
| `backend-test-ownership-policy.md` | `@WebMvcTest` vs `@SpringBootTest` decision table | java-backend-agent, backend-integration-tests-agent, Team Lead |
| `spring-test-runtime-policy.md` | `@SpringBootTest` justification format; exception-only triggers | backend-integration-tests-agent, Team Lead |
| `java-coding-standards.md` | Java style, naming, Spring conventions | java-backend-agent |

## Frontend Family Policies (`.claude/policies/frontend/`)

| File | Purpose | Primary Loaders |
|---|---|---|
| `frontend-coding-standards.md` | TypeScript/React style; evidence block; gate commands; self-heal escalation | frontend-api-agent, frontend-ui-agent |

## E2E Family Policies (`.claude/policies/e2e/`)

| File | Purpose | Primary Loaders |
|---|---|---|
| `e2e-dependency-preflight-policy.md` | Port conventions; Chromium pre-gate; E2E script verification | playwright-e2e-agent, Team Lead |
| `os-path-aware-execution-policy.md` | OS detection; path resolution; forbidden static paths | playwright-e2e-agent, Team Lead |

## Team Lead Policies (`.claude/skills/team-lead/policies/`)

These are Team Lead internal routing and classification policies:

| File | Purpose |
|---|---|
| `background-agent-policy.md` | Governs `run_in_background` usage |
| `documentation-parity-policy.md` | Change-trigger matrix for keeping docs in sync |
| `frontend-split-decision-policy.md` | Criteria for splitting into two frontend agents |
| `frontend-test-routing-policy.md` | Routes frontend test failures to correct agent |
| `git-branch-policy.md` | Branch creation, sync, naming decisions (Cases A–J) |
| `qa-failure-routing-policy.md` | Routes QA findings back to owning agent |
| `requirement-intent-classification-policy.md` | WHAT-change vs HOW-change classification |
| `requirement-similarity-policy.md` | Interrupted-run similarity detection and branch routing |
| `test-failure-routing-policy.md` | Classification and routing table for all test failures |
