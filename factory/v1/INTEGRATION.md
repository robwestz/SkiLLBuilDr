# Scenario Factory v1 Integration

This workspace implements the blind-eval layer that should run between chunk iterations produced by the parent `assemble.mjs` CLI at the repo root (`../../assemble.mjs` relative to this file).

## Current parent behavior

`assemble.mjs` currently:

- ranks skills
- builds `KICKOFF.md`, `CLAUDE.md`, and `README.md`
- bundles `frameworks/` into a package zip
- leaves `chunkPlan: null` for the operator to fill during Phase 0

It does **not** yet run an eval gate between build chunks. That wiring is the operator follow-up after review.

## Recommended wiring point

Insert the gate at the boundary where a chunk is considered "built enough" to continue.

Recommended lifecycle:

1. Builder works in a build workspace that does **not** contain `scenarios/`.
2. When a chunk finishes, copy only the candidate chunk artifact into an eval workspace or temp directory.
3. Mount or copy this Scenario Factory workspace beside the candidate artifact.
4. Run:

```bash
bash factory/v1/scenarios/runner.sh --json --timeout 15
```

5. Parse the JSON result object:
   - all `PASS` or `SKIP`: allow the next chunk
   - any `FAIL` or `TIMEOUT`: stop the chain, collect artifacts, and redact feedback before returning anything to the builder
6. Surface only `builder_feedback.json` from failing scenarios back to the builder. Keep `human_debug.txt` and `twin_call_log.jsonl` operator-only.

## Proposed contract for assemble.mjs

Minimal operator implementation:

- add an optional flag such as `--scenario-gate <path>`
- when enabled, create an eval temp root per chunk
- copy the candidate chunk output into that root
- set `SUT_ROOT` to the candidate root when invoking the scenario runner
- archive the returned `artifacts/runs/<timestamp>` path with the chunk metadata

Suggested result handling:

- `exit 0`: continue chunk chain
- `exit 1`: mark chunk blocked by blind eval
- store the full runner JSON alongside the chunk record

## Separation rules

- Do not expose this workspace to the builder during the build phase.
- Do not point `SUT_ROOT` at the parent ECC repo or any shared holdout dataset.
- Do not send `human_debug.txt`, `probe_result.json`, or `twin_call_log.jsonl` back to the builder.
- Rotate denylist fingerprints and scenario seeds if a leak is suspected.

## Why this fits the current codebase

`assemble.mjs` already packages self-contained workspaces and explicitly instructs the operator to finish Phase 0 after extraction. That makes a separate eval workspace a natural fit: the builder package stays unchanged, while the gate runs as an independent post-chunk decision step.
