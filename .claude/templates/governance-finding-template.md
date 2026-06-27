# Governance Finding Template
# Used by: all agents when identifying a governance gap during execution
# Prefix: GF-XXX (Governance Finding)
# Do NOT use for code-review findings (CR-XXX) or security findings (SEC-XXX)
# Findings written here must NOT modify shared governance files — emit only

## Finding GF-001

- Finding ID: GF-001
- Title: <short descriptive title>
- Severity: Critical / High / Medium / Low
- Category: Policy / Ownership / Reporting / Routing / Validation / Security / Architecture / Agent Improvement / Documentation / Other
- Discovered By: <agent name>
- Discovered During: <step or phase — e.g. "Step 6 — java-backend-agent execution", "Step 9 — QA loop">
- Run ID: <workflow-run-id>
- Description: <what is wrong or missing>
- Evidence: <file path, line, or observation that surfaced this gap>
- Suggested Improvement: <what should change and in which file>
- Suggested Owner: <agent name or role responsible for the improvement>
- Suggested Follow-Up Task: <one-sentence task description for the governance PR or backlog item>
- Blocks Current Delivery: Yes / No

## Rules

- Assign every finding exactly one Category.
- Severity Critical means the gap caused or nearly caused a release defect, security issue, or data exposure.
- Do NOT modify the governance file referenced in Suggested Improvement. Emit the finding only.
- Do NOT route governance findings through the QA loop (Steps 8–9). They are collected separately by Team Lead.
- Self-improvement exception: an agent may fix its own SKILL.md or own reporting if and only if the finding's Suggested Owner is itself and the change is purely local to that agent's owned files. All other governance findings must be emitted and left for Team Lead.
- Blocks Current Delivery must be Yes only when the gap makes it impossible to safely complete the current task without first addressing the governance issue.
