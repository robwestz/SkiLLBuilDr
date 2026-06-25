# Reference: Example — Bad Skill (anti-example)

> Type: anti_example
> Per-type DoD: see reference_standard.md — must FAIL its standard on ≥1 NAMED
> dimension, differing from the canonical example in a *validatable* way.

A package that looks plausible but fails the gate. Its runnable form lives at
`tests/fixtures/invalid_skill_package/` (Commit 4) so the validator can assert
FAIL on it. This is the deliberate contrast to `example_good_skill.md`.

## The package

```
.claude/skills/frontmatter-helper/
  SKILL.md            # missing required headings + 240-char description
  helpers.mjs         # on disk but NOT in manifest
  manifest.yaml       # lists a references/notes.md that does NOT exist
  artifact_intent_cards.yaml   # one card with placeholder fields
```

## Named failing dimensions (each maps to a gate and an anti-pattern)

| Failing dimension | Gate | Anti-pattern | Expected validator message |
|-------------------|------|--------------|----------------------------|
| `description` is 240 chars (> 200) | skill_standard DoD | AP8 | "description exceeds 200 chars" |
| `SKILL.md` missing `## Steps` and `## Validation` | skill_standard DoD | AP8 | "missing required heading: Steps" |
| `helpers.mjs` present on disk, absent from manifest | G4 | AP3 | "orphan file not in manifest: helpers.mjs" |
| manifest lists `references/notes.md` that does not exist | G4 | AP3 | "phantom file in manifest: references/notes.md" |
| AIC has `why_this_artifact_must_exist: TODO` | G3 | AP2 | "placeholder in required field" |
| `helpers.mjs` has no AIC | G2 | AP1 | "file without Artifact Intent Card" |

## Why this is a VALID anti-example (not cosmetic)

It differs from `example_good_skill.md` on **six named, validatable dimensions**,
each producing a specific, predictable validator failure — satisfying G5's
requirement that good vs. bad differ in a way tooling can prove, not just in
wording.

## How it is consumed

- Consumed by: `scripts/validate_skill_package.mjs` and
  `scripts/validate_artifact_cards.mjs` (both must report FAIL with the messages
  above) and the test suite (Commit 4) which asserts non-zero exit.
- Validation signal: validator exit code ≠ 0 with at least the six failures listed.

## What this reference is NOT

- A package with random garbage — every fault is *deliberate and named* so the
  test suite can assert each one specifically.
