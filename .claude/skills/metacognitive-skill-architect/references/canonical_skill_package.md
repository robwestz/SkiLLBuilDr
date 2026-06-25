# Reference: Canonical Skill Package

> Type: convention / mini-documentation
> Per-type DoD: see reference_standard.md

The reference layout a well-formed skill package follows. It is the shape the
validator and the templates both target. Use it as the mental model when reading
`example_good_skill.md` (a package that follows it) and `example_bad_skill.md`
(one that violates it).

## Content

```
.claude/skills/<name>/
  SKILL.md                 # REQUIRED — 9 elements (skill_standard.md)
  manifest.yaml            # REQUIRED — declared inventory (G4 parity)
  artifact_intent_cards.yaml  # REQUIRED — one VALID card per non-trivial file
  README.md                # recommended — human orientation
  ASSUMPTIONS.md           # required IF the skill makes inheritable decisions
  CHANGELOG.md             # recommended — build history
  references/              # optional — typed, DoD-aware supporting artifacts
  templates/               # optional — scaffolds the skill emits
  scripts/                 # optional — dependency-free Node .mjs
  tests/                   # optional — node --test for any scripts
  examples/                # optional — canonical example + anti-example + walkthroughs
```

## Minimum viable skill (smallest package that passes G1–G7)

A skill does not need every directory. The smallest passing package is:

```
.claude/skills/<name>/
  SKILL.md                 # 9 elements
  manifest.yaml            # lists SKILL.md, manifest.yaml, artifact_intent_cards.yaml
  artifact_intent_cards.yaml  # one VALID card per file above
```

This is the baseline `example_good_skill.md` demonstrates.

## How it is consumed

- Consumed by: `templates/new_skill/*`, `scripts/validate_skill_package.mjs`,
  and the `SKILL.md` workflow (Step 4 scaffold).
- Validation signal: a package whose tree matches this convention and whose
  manifest is in parity passes G1/G4.

## What this reference is NOT

- A requirement that every directory be present (optional dirs stay optional).
- A substitute for the per-file DoD in `skill_standard.md`.
