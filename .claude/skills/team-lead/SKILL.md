---
name: team-lead
description: Full pipeline orchestrator. Read reports/requirements.md, detect complexity tier, assign models, then spawn every agent in order until the PR is created.
model: claude-opus-4-8
argument-hint: <reports/requirements.md path — defaults to ./reports/requirements.md>
---

# Team Lead / Orchestrator

## Mission
Run the full multi-agent pipeline from a requirements file to a merged PR, without human intervention between steps.

## How to invoke
```
/team-lead
/team-lead path/to/reports/requirements.md
```

If no argument is given, default to `./reports/requirements.md`.

---

## Step 0 — Detect complexity and assign models

Before spawning any agent, read `reports/requirements.md` and score the complexity:

| Signal | Points |
|--------|--------|
| Multiplayer / real-time | +2 |
| Auth / user accounts | +2 |
| Complex domain rules | +2 |
| External integrations | +1 |
| Persistent storage (SQL/NoSQL) | +1 |
| Multiple user roles | +1 |
| Simple CRUD only | -2 |
| Single user, no auth | -1 |

| Score | Tier |
|-------|------|
| 5+ | HIGH |
| 2–4 | MEDIUM |
| 0–1 | LOW |

| Agent | HIGH | MEDIUM | LOW |
|-------|------|--------|-----|
| product-agent | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| architect-agent | claude-opus-4-8 | claude-sonnet-4-6 | claude-sonnet-4-6 |
| java-backend-agent | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-sonnet-4-6 |
| frontend-agent | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-sonnet-4-6 |
| backend-unit-tests-agent | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| playwright-e2e-agent | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-haiku-4-5-20251001 |
| security-agent | claude-opus-4-8 | claude-sonnet-4-6 | claude-sonnet-4-6 |
| code-review-agent | claude-opus-4-8 | claude-sonnet-4-6 | claude-sonnet-4-6 |
| infrastructure-agent | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 |
| release-pr-agent | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 | claude-haiku-4-5-20251001 |

Print the detected tier and model assignments before starting Phase 1.

---

## Pipeline

Execute the phases below in order. Each phase spawns one agent using the Agent tool with the model assigned in Step 0.
Wait for the agent to finish and write its output artifact before starting the next phase.
If an agent fails or its output artifact is missing, stop the pipeline and report the error — do not skip ahead.

---

### Phase 1 — Product Spec
**Spawn:** product-agent  
**Input:** full content of `reports/requirements.md`  
**Instructions:** Read `.claude/skills/product-agent/SKILL.md` and follow it exactly.  
**Done when:** `reports/product-spec.md` exists.

---

### Phase 2 — Architecture
**Spawn:** architect-agent  
**Input:** `reports/product-spec.md`  
**Instructions:** Read `.claude/skills/architect-agent/SKILL.md` and follow it exactly.  
**Done when:** `reports/architecture.md` exists.

---

### Phase 3 + 4 — Backend & Frontend (parallel)
Spawn both agents simultaneously:

**java-backend-agent**  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/java-backend-agent/SKILL.md` and follow it exactly.  
**Done when:** `apps/backend/src/main/java/` has production code.

**frontend-agent**  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/frontend-agent/SKILL.md` and follow it exactly.  
**Done when:** `apps/frontend/src/` has production code and `npm run build` exits 0.

---

### Phase 5 + 6 — Tests (parallel, after phases 3+4)
Spawn both agents simultaneously:

**backend-unit-tests-agent**  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/backend-unit-tests-agent/SKILL.md` and follow it exactly.  
**Done when:** `./mvnw test` exits 0.

**playwright-e2e-agent**  
**Input:** `reports/product-spec.md`  
**Instructions:** Read `.claude/skills/playwright-e2e-agent/SKILL.md` and follow it exactly.  
**Done when:** `npm run test:e2e` exits 0.

---

### Phase 7 — Security Review
**Spawn:** security-agent  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/security-agent/SKILL.md` and follow it exactly.  
**Done when:** `reports/security-report.md` verdict: APPROVED.  
**On REQUIRES CHANGES:** spawn the relevant implementation agent to fix, then re-run security-agent. Repeat until APPROVED.

---

### Phase 8 — Code Review
**Spawn:** code-review-agent  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/code-review-agent/SKILL.md` and follow it exactly.  
**Done when:** `reports/code-review-report.md` verdict: APPROVED.  
**On REQUIRES CHANGES:** spawn the relevant implementation agent to fix, then re-run code-review-agent. Repeat until APPROVED.

---

### Phase 9 — Infrastructure
**Spawn:** infrastructure-agent  
**Input:** `reports/architecture.md`  
**Instructions:** Read `.claude/skills/infrastructure-agent/SKILL.md` and follow it exactly.  
**Done when:** `docker-compose.yml` exists at project root and `README.md` documents how to run the app.

---

### Phase 10 — Release PR
**Spawn:** release-pr-agent  
**Input:** all reports in `reports/`  
**Instructions:** Read `.claude/skills/release-pr-agent/SKILL.md` and follow it exactly.  
**Done when:** PR is open on GitHub and its URL is printed.

---

## Quality Gate (enforce before Phase 10)

- [ ] `./mvnw test` exits 0
- [ ] `npm run build` exits 0
- [ ] `npm run test:e2e` exits 0
- [ ] `reports/security-report.md` verdict: APPROVED
- [ ] `reports/code-review-report.md` verdict: APPROVED
- [ ] `README.md` documents how to run the app
- [ ] `reports/final-pr-summary.md` exists

If any gate fails, stop and report which gate failed and which agent owns the fix.

---

## Rules
- Never skip a phase.
- File ownership is strict: each agent edits only the files listed in its SKILL.md.
- Never expose opponent ship positions in any API response.
