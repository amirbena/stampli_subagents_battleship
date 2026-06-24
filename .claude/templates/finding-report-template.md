# Finding Report Template
# Used by: code-review-agent (Finding CR-XXX), security-agent (Finding SEC-XXX)
# Load when writing the Findings section of a report.

## Finding <PREFIX>-001

- Finding ID: <PREFIX>-001
- Observed failure: <what was observed>
- Evidence: <file path, line, or test output>
- Suspected root cause: <root cause hypothesis>
- Suspected owner: <agent name>
- Files involved: <list>
- Recommended next agent: <agent name>
- Attempt count: 0
- Severity: Critical / High / Medium / Low
- Blocks PR: Yes / No
- required_fix: <what must change>
- verification_command: <command to verify the fix>

## Rules

- Assign every finding to exactly one suspected owner.
- Only Critical findings block PR.
- Do not fix findings yourself.
- Do not spawn the suspected owner directly — return control to Team Lead.
- Each finding must include a `verification_command`.
