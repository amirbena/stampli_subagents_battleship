# Requirements Template
# Used by: requirement agent (Step 5)
# Load when writing reports/runs/<workflow-run-id>/requirements.md.
#
# BOUNDARY RULE: Expand user intent; do not design the solution.
# May define: user-visible behavior, user journey, product-level scope and risks.
# Must NOT mention: storage technology, API paths, backend enums, test types,
# E2E mode, `Architecture Required`, or agent routing decisions.
# See .claude/policies/agent-responsibility-boundaries-policy.md.

---

```md
# Requirement

## Raw User Request

<exact original text>

## Visual Analysis

<paste the Visual Analysis block from Step 0 here — omit section entirely if no images were attached>

## Requirement Summary

<1-3 sentence plain interpretation — informed by Visual Analysis if images were provided>

## Initial Scope

<bullet list of what is in scope — include visual/layout items surfaced by image analysis>

## Acceptance Criteria

<combine text-stated criteria + inferred criteria from Visual Analysis into one numbered list>

## Initial Risks

<bullet list of known risks>

## Notes For Product

<anything the Product Agent should know or watch for>
<if images were provided: note "Visual evidence attached — see ## Visual Analysis for exact defects and expected state">

## Workflow Metadata

Workflow Run ID: <id>
Generated From Branch: <branch>
Generated From Commit: <sha>
Generated At: <iso-timestamp>
Source: user-input
Images analyzed: <count, or "none">
```
