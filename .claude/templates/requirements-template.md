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

## Notes For Product  *(include this section only when the requirement affects end-user product/application behavior)*

<anything the Product Agent should know or watch for — include only when end-user product/game/UI behavior is involved>
<if images were provided: note "Visual evidence attached — see ## Visual Analysis for exact defects and expected state">
<if the requirement is DevEx/infrastructure/local-tooling only: OMIT this section entirely and use Routing Hints below instead>

## Routing Hints  *(include this section for DevEx / infrastructure / local-tooling / governance requirements; omit for pure product requirements)*

Requirement subject: <product / developer-experience / local-tooling / infrastructure / governance / docs-only>
Product Agent likely required: Yes / No — <brief reason; for DevEx/infra use "No — subject is developer-local, no end-user behavior change">
Architecture likely required: <Yes — reason / No>
Primary owners: <Infrastructure Agent / Backend Agent / Architect Agent / Docs — as appropriate>
Notes for Team Lead: <anything Team Lead should know before routing — e.g. "new endpoint may be needed; Architecture should decide route and contract before Implementation">
Notes for Architecture: <technical ambiguities or decisions that belong to Architecture, not Product>
Notes for Infrastructure: <script/local-dev/Docker/CI scope hints>
Notes for Backend: <backend scope hints — only if a minimal code change is likely; do not design the solution>

## Workflow Metadata

Workflow Run ID: <id>
Generated From Branch: <branch>
Generated From Commit: <sha>
Generated At: <iso-timestamp>
Source: user-input
Images analyzed: <count, or "none">
```
