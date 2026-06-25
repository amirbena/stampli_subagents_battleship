# Policies

Policies are shared rules loaded by specific agents when relevant.

They must not define routing authority or gate advancement.
Team Lead remains the orchestrator.

## Policy Index

### Governance

| Policy | Purpose | Primary loader |
|---|---|---|
| `agent-communication-policy.md` | Strict tree topology — prohibits SendMessage, run_in_background, and lateral peer contact for all execution agents | All execution agents (Team Lead Contract) |
| `background-agent-policy.md` | Governs Team Lead's use of run_in_background — result-collection rule, no gate advance while background outstanding | Team Lead (Step 6) |
| `documentation-parity-policy.md` | Change-trigger matrix for keeping agent tables, file-ownership, routes, and policy README in sync | Team Lead (Step 0.5 and Step 14) |
| `requirement-intent-classification-policy.md` | WHAT-change vs HOW-change classification, refactor scope table, contract-change escalation rules | Team Lead (Step 0.5) |
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
| `git-branch-policy.md` | Branch creation, sync, and naming decisions (Cases A–I) | Team Lead (Step 5) |
| `demo-config-policy.md` | Classifies demo/local config vs real credentials; defines what security review must flag | infrastructure-agent, security-agent |
