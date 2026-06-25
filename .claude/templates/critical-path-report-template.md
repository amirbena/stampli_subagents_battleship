# Critical Path Report Template

Team Lead writes this after PR creation using actual `date` command timestamps recorded at each phase transition.
Do not invent or estimate durations. If a phase timestamp was not recorded, leave Duration blank.

## Critical Path Report

Workflow Run ID: <id>
Branch: <branch>
Recorded At: <ISO-8601 from `date -u +"%Y-%m-%dT%H:%M:%SZ"`>

## Phase Timings

| Phase | Start | End | Duration (min) | Agents | Notes |
|-------|-------|-----|---------------|--------|-------|
| Requirement Intake | | | | requirement-agent | |
| Product Agent | | | | product-agent | Full / Light / Skipped |
| Architect Agent | | | | architect-agent | Run / Skipped |
| Backend Implementation | | | | java-backend-agent | |
| Frontend Implementation | | | | ui-agent / api-agent / both | Single / Split path |
| Unit Tests | | | | java-backend-agent, frontend agents | Backend + frontend in parallel |
| Frontend Gate (TL) | | | | Team Lead | Split path only; N/A if single |
| Integration Tests | | | | backend-integration-tests-agent | Run / Skipped (exception-only) |
| E2E Tests | | | | playwright-e2e-agent | Full / Smoke / None |
| Security Review | | | | security-agent | Run / Skipped |
| Code Review | | | | code-review-agent | |
| Fix Cycles | | | | various | N/A if no REQUIRES CHANGES |
| PR Creation | | | | release-pr-agent | |
| **Total** | | | | | |

## Critical Path Analysis

Longest phase: <phase name> — <duration> min
Second longest: <phase name> — <duration> min
Phases overlapped (parallel): <list>

## Potential Savings

| Opportunity | Estimate | Risk |
|------------|---------|------|
| <e.g. E2E backend warm before review completes> | <minutes> | <risk level> |

## Recording Instructions for Team Lead

Record timestamps using:
```bash
date -u +"%H:%M UTC"
```

Run this at the start and end of each major phase and note it in the finding registry or in a scratch section of `team-lead-plan.md`. At the end of the run, compile the table above from those notes.

Do not estimate or invent durations. If a phase boundary was not timestamped, note "not recorded" in the Duration column rather than guessing.
