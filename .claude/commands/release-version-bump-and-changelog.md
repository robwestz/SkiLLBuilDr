---
name: release-version-bump-and-changelog
description: Workflow command scaffold for release-version-bump-and-changelog in SkiLLBuilDr.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /release-version-bump-and-changelog

Use this workflow when working on **release-version-bump-and-changelog** in `SkiLLBuilDr`.

## Goal

Prepares and publishes a new release by updating the CHANGELOG and bumping the version in package.json.

## Common Files

- `CHANGELOG.md`
- `package.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update CHANGELOG.md with all notable changes since the previous release.
- Update the version number in package.json.
- Commit both files with a chore: message indicating the new version.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.