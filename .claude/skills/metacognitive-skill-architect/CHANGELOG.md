# Changelog — metacognitive-skill-architect

All notable changes to Skill #0. Format loosely follows Keep a Changelog;
versions track the dogfood-snowball build commits.

## [Unreleased]

### Commit 4 — Validators
- Added `scripts/validate_skill_package.mjs` (gates G1/G2/G3/G4/G7 + SKILL.md DoD)
  and `scripts/validate_artifact_cards.mjs` (16-field AIC schema enforcement).
  Both dependency-free Node ESM, runnable as CLIs and importable for tests.
- Added `tests/validate_skill_package.test.mjs` and
  `tests/validate_artifact_cards.test.mjs` (12 `node --test` cases, incl. dogfood
  self-validation of this package).
- Added canonical fixtures `tests/fixtures/valid_skill_package/` (PASS) and
  `tests/fixtures/invalid_skill_package/` (FAIL on the 6 named dimensions).
- Updated `manifest.yaml` and `artifact_intent_cards.yaml` for the new files.

### Commit 3 — References and examples
- Added `references/canonical_skill_package.md` (package shape + minimum viable skill).
- Added `references/anti_patterns.md` (AP1–AP10 with the gate that catches each).
- Added `references/example_good_skill.md` (canonical PASS) and
  `references/example_bad_skill.md` (anti-example failing on 6 named dimensions).
- Added `examples/skill_1_creation_walkthrough.md` (how Skill #0 builds Skill #1).
- Updated `manifest.yaml` and `artifact_intent_cards.yaml` for the new files.

### Commit 2 — Skill #0 skeleton
- Added `SKILL.md` (9 required elements per skill_standard).
- Added `README.md` orientation and `CHANGELOG.md`.
- Added `manifest.yaml` declaring the package file inventory.
- Added core templates: `templates/new_skill/` (SKILL.md, manifest.yaml,
  README.md, artifact_intent_cards.yaml) and `templates/new_reference/reference.md`.

### Commit 1 — Meta-specification
- Added `ASSUMPTIONS.md` and the four reference standards: `skill_standard.md`,
  `reference_standard.md`, `artifact_intent_card_standard.md`,
  `process_standard.md`.

### Deferred
- Commit 3: canonical good example + anti-example + walkthroughs.
- Commit 4: dependency-free Node validators (`scripts/`) + `tests/`.
- Commit 5: dogfood rehearsal (Skill #1 plan).
