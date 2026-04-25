# Factory Rules

This workspace is operating under a local rule/constraint because the provided skill loadout does not cover scenario-factory authoring or leak-safe blind-eval wiring.

## Rule

Build the Scenario Factory using only workspace-local bash and Python stdlib utilities.

## Constraints

- Do not read or reference parent ECC scenario data, holdout fixtures, or environment paths outside this workspace.
- Treat `frameworks/` as read-only governance documents.
- Keep builder-visible feedback redacted; only `human_debug.txt` may contain full diagnostic detail.
- Keep twins deterministic, offline, and fault-injectable.
- Ensure leak-scan rejects scenario identifiers and fixture fingerprints in builder-facing code and artifacts.

## Registration

This document satisfies the Phase 0.3 sanctioned fallback path by formalizing the missing reusable rule/constraint before implementation begins.
