# ASSUMPTIONS — session-kickoff-orchestrator

Inheritable decisions made by Skill #1. Status is `locked` or `revisit_required`.

| # | Assumption | Rationale | Status | Affects |
|---|------------|-----------|--------|---------|
| K1 | v1 is deterministic and offline: no model calls, no network. | Operator chose "small v1" (prove the snowball before adding the council). | locked | scope of scripts/kickoff.mjs |
| K2 | Validators/scripts are dependency-free Node ESM. | Inherited from Skill #0 / CLAUDE.md zero-runtime-deps policy. | locked | scripts/, tests/ |
| K3 | Session Intent Cards are stored at `.agents/kickoffs/<iso>-kickoff.md`. | Keeps session state beside the existing `.agents/` ledger; chronologically sortable filenames give a cheap "previous card" link. | revisit_required | card storage path, previousCard lookup |
| K4 | Lockfile drift = a dependency in package.json with no `node_modules/<name>` key in package-lock.json. | Matches the exact `npm ci` "Missing … from lock file" failure observed in CI; presence (not version) is enough to catch it. | revisit_required | detectLockfileDrift |
| K5 | The kickoff never fails the process on health problems (exit 0). | Kickoff must inform, not block a session from starting. | locked | scripts/kickoff.mjs main() |
| K6 | The multi-model "council" (3 role-assigned models + reconciliation) is a v2 concern. | Deferred by operator; keeps v1 free and reviewable. | revisit_required | future scripts/council.mjs |
