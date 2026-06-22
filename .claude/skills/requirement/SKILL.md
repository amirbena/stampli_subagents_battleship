---
name: requirement
description: Entry point for the entire factory. User describes what they want to build, the skill asks clarifying questions, writes reports/requirements.md, selects the right model tier for each agent, then automatically kicks off the full multi-agent pipeline.
model: claude-opus-4-8
argument-hint: optional — paste your idea inline or answer questions interactively
---

# Requirement Intake & Pipeline Launcher

## Mission
Turn a freeform user description into a structured `reports/requirements.md`, select the right model tier for each agent based on complexity, then launch the full agent pipeline without further human input.

---

## Step 1 — Gather the requirement

If the user passed text via `$ARGUMENTS`, use that as the starting point.
If `$ARGUMENTS` is empty, ask the user:

> **What do you want to build?**
> Describe it in plain language — what it does, who uses it, and any specific features you care about. Everything else will be filled in automatically.

Wait for the user's response before continuing.

---

## Step 2 — Analyze & ask targeted follow-up questions

Read what the user wrote. Identify gaps in these four areas only — skip any area where the user already gave a clear answer:

| Area | Ask if unclear |
|------|---------------|
| **Core action** | What is the primary thing a user does in the app? |
| **Multiplayer / single user** | Is this one person or multiple people interacting? |
| **Data persistence** | Does data need to survive a page refresh or server restart? |
| **Out of scope** | Is there anything they explicitly do NOT want in v1? |

Ask only the questions that are genuinely unanswered. Maximum 4 questions. If everything is clear, skip to Step 3.

Wait for the user's answers before continuing.

---

## Step 3 — Write reports/requirements.md

Create the `reports/` directory if it does not exist before writing.

Using all information gathered, write `reports/requirements.md` at the project root with this exact structure:

```markdown
# Requirements

## What I want to build
<1-3 sentence plain-language description>

## Core features
<bullet list — one concrete feature per line, specific enough for an engineer to implement>

## Out of scope (v1)
<bullet list — things deliberately excluded>

## Open decisions
<bullet list — anything ambiguous that agents should resolve with sensible defaults>
```

Be concrete. "Users can create a room and share a code" is good. "Good UX" is not.

---

## Step 4 — Detect complexity and select model tier

Analyze the requirements and assign a complexity tier. This determines which model each agent runs on.

### Complexity signals

| Signal | Points |
|--------|--------|
| Multiplayer / real-time | +2 |
| Auth / user accounts | +2 |
| Complex domain rules (game logic, workflows, calculations) | +2 |
| External integrations (payment, email, OAuth) | +1 |
| Persistent storage (SQL/NoSQL) | +1 |
| Multiple user roles | +1 |
| Simple CRUD only | -2 |
| Single user, no auth | -1 |

**Tier assignment:**

| Total points | Tier | Label |
|---|---|---|
| 5+ | HIGH | Complex system — use Opus for planning, architecture, review |
| 2–4 | MEDIUM | Standard app — balanced model mix |
| 0–1 | LOW | Simple app — Sonnet/Haiku for most phases |

### Model assignment per tier

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

Print the detected tier and model assignments before continuing so the user can see what was selected.

---

## Step 5 — Confirm with the user

Print the contents of `reports/requirements.md` and ask:

> **Does this capture what you want?**
> Reply `yes` to launch the pipeline, or tell me what to change.

If the user requests changes, update `reports/requirements.md` and show it again.
Repeat until the user confirms.

---

## Step 6 — Launch the pipeline

Once confirmed, print:

```
Requirements locked. Complexity: <TIER>. Launching the full agent pipeline...

Phase 1  → product-agent        writes reports/product-spec.md
Phase 2  → architect-agent      writes reports/architecture.md
Phase 3  → java-backend-agent   builds apps/backend/
Phase 4  → frontend-agent       builds apps/frontend/       [parallel with Phase 3]
Phase 5  → backend-unit-tests   runs ./mvnw test
Phase 6  → playwright-e2e       runs npm run test:e2e       [parallel with Phase 5]
Phase 7  → security-agent       writes reports/security-report.md
Phase 8  → code-review-agent    writes reports/code-review-report.md
Phase 9  → infrastructure-agent writes docker-compose.yml + README.md
Phase 10 → release-pr-agent     opens GitHub PR
```

Then follow the Team Lead orchestration logic defined in `.claude/skills/team-lead/SKILL.md` exactly — spawn each agent using the model assignments computed in Step 4, enforce quality gates, and do not stop until the PR URL is printed.
