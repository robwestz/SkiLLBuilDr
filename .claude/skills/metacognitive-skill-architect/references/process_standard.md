# Reference: Process Standard

The process layer that ties the meta-specification together: the DoD matrix, the
dependency-graph convention, the validation gates, and the commit rules. It
**harmonizes with — never overrides —** the repo contracts
(`AGENT_ONBOARDING.md` Sections A/B, `CLAUDE.md`).

## 1. DoD matrix (artifact → DoD → validation signal)

| Artifact class | Definition of Done | Validation signal |
|----------------|--------------------|-------------------|
| Skill package | Meets `skill_standard.md` DoD | `validate_skill_package` PASS |
| Reference | Meets `reference_standard.md` per-type + cross-cutting DoD | Type-specific check / manual checklist |
| Artifact Intent Card | Meets `artifact_intent_card_standard.md` pass rules | `validate_artifact_cards` PASS |
| Template | Fills to a standard-passing artifact | Filled instance passes its standard |
| Script | Dependency-free Node, deterministic, non-zero exit on failure | `node --test` green |
| Example (canonical) | Passes its standard end-to-end | Validator PASS |
| Anti-example | Fails its standard on ≥1 named dimension | Validator FAIL for the stated reason |

## 2. Dependency-graph convention

Each artifact declares what it **enables** (downstream) via its AIC field
`future_artifact_or_workflow_it_enables`. The graph is expressed in plain text
as `A -> B` ("A enables/precedes B"). The intended Commit 1→5 ordering:

```
ASSUMPTIONS.md ----------------+
skill_standard.md -------------+--> SKILL.md.template --> example_good_skill --> validate_skill_package
reference_standard.md ---------+--> reference.md.template --> references/examples
aic_standard.md ---------------+--> artifact_intent_cards.yaml.template --> validate_artifact_cards
process_standard.md -----------+--> pre-commit gate --> dogfood rehearsal (Skill #1 plan)
```

Rule: an artifact may only depend on artifacts that already exist (no forward
references to unbuilt files). This is what makes the snowball monotonic.

## 3. Validation gates

Minimum gates, usable manually until the scripts exist (Commit 4):

- **G1 — Required files present.** Every file in `manifest.yaml` exists; no orphans.
- **G2 — AIC present.** Every non-trivial file has an Artifact Intent Card.
- **G3 — AIC valid.** Every card passes `artifact_intent_card_standard.md`.
- **G4 — Manifest parity.** `manifest.yaml` ⇄ filesystem match exactly.
- **G5 — Example divergence.** Canonical example PASSes; anti-example FAILs, and
  they differ on a *named* dimension.
- **G6 — Snowball reachability.** Skill #0 can describe how Skill #1 is created.
- **G7 — Resource hygiene.** No GPU assumptions, no heavy/runtime deps introduced.

Until Commit 4, gates are run as a manual checklist and the result recorded in
the post-commit report. From Commit 4, G1–G5 are automated.

## 4. Commit rules (harmonized with repo)

- Conventional-commits type prefix: `feat|fix|test|docs|chore|refactor|perf|build|ci`.
- Small, reversible commits; each commit has a stated purpose, its own DoD, and
  a validation result.
- **No commit without the relevant tests green** (repo rule). For docs-only
  commits, the relevant validation is the manual gate checklist.
- **No push to `origin/main` without operator approval** (repo rule). Feature
  branches and PRs are the delivery path.
- No new runtime dependency without operator approval (repo rule).

## 5. Mandatory pre-commit grind

Before every commit, record visibly:

1. Which files will be created/changed.
2. An Artifact Intent Card for each.
3. Why these files belong in this commit.
4. Which validation proves the commit's DoD.
5. What is deliberately deferred.
6. Residual risk after the commit.
7. How the commit improves the next commit.

A commit may not happen until this grind is complete.

## 6. Mandatory post-commit report

After every commit, record:

1. What changed.
2. Which files were created/changed.
3. Validation results.
4. Any failed checks.
5. Whether dogfood quality increased.
6. Next recommended step.

## 7. Assumptions policy

Any decision that affects architecture, file format, future skills, or
validation is recorded in `ASSUMPTIONS.md` with a status of `locked` or
`revisit_required`. A conservative local default may be taken to avoid
self-paralysis, but it must be logged, not hidden.
