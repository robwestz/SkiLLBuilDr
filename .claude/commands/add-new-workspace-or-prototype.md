---
name: add-new-workspace-or-prototype
description: Workflow command scaffold for add-new-workspace-or-prototype in SkiLLBuilDr.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-workspace-or-prototype

Use this workflow when working on **add-new-workspace-or-prototype** in `SkiLLBuilDr`.

## Goal

Adds a new workspace or prototype to the monorepo, including agent logic, prompts, test cases, outputs, and documentation.

## Common Files

- `workspaces/<workspace-name>/agent/*.mjs`
- `workspaces/<workspace-name>/prompts/*.md`
- `workspaces/<workspace-name>/test-cases/*.json`
- `workspaces/<workspace-name>/outputs/*/CLAUDE.md`
- `workspaces/<workspace-name>/outputs/*/KICKOFF.md`
- `workspaces/<workspace-name>/outputs/*/REASONING.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create a new directory under workspaces/ with the workspace name.
- Add agent logic files (e.g., agent/bdi.mjs, agent/llm.mjs, agent/assembler.mjs, agent/ranker.mjs).
- Add prompts (e.g., prompts/rank-skills.md).
- Add test cases (e.g., test-cases/*.json).
- Add outputs for sample runs (e.g., outputs/<project>/CLAUDE.md, KICKOFF.md, REASONING.md, workflows/main.yaml).

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.