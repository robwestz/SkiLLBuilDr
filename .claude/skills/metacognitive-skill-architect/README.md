# metacognitive-skill-architect (Skill #0)

The first brick in a local, modular skill system built as a **dogfood
snowball**: each new skill is more accurate than the last because the previous
artifacts already defined purpose, structure, Definition of Done, examples, and
quality gates.

This package is the **architect, gatekeeper, scaffolder, and validator** for
every skill that follows. Its one non-negotiable rule: **no file is created
before its Artifact Intent Card exists and passes the AIC standard.**

## Orientation (read in this order)

1. `SKILL.md` — the contract: when to use, inputs, outputs, steps, validation.
2. `ASSUMPTIONS.md` — the inheritable decisions this skill makes (and their status).
3. `references/skill_standard.md` — what a skill is + its Definition of Done.
4. `references/reference_standard.md` — what a reference is (broadly) + per-type DoD.
5. `references/artifact_intent_card_standard.md` — the create-time gate.
6. `references/process_standard.md` — DoD matrix, dependency graph, gates, commit rules.

## How to create the next skill with this skill

1. Run the `[GAP CONTRACT]` from `skill-development` to name the gap and type.
2. Write an Artifact Intent Card for every intended file (template in
   `templates/new_skill/artifact_intent_cards.yaml.template`).
3. Validate the cards (manually now; `scripts/validate_artifact_cards.mjs` later).
4. Scaffold from `templates/new_skill/`, fill every placeholder.
5. Update `manifest.yaml`, run the pre-commit grind, commit.
6. Verify with gates G1–G7 and write the post-commit report.

## Relationship to existing repo skills

- `skill-development` — remains the sanctioned route out of a Phase 0 no-fit.
  Skill #0 does not replace it; it layers the AIC gate and the package standards
  on top, so a skill produced via `skill-development` is also gated and complete.
- `agent-onboarding` — unchanged; this package assumes you have onboarded.

## Layout

```
metacognitive-skill-architect/
  SKILL.md            README.md           manifest.yaml
  ASSUMPTIONS.md      CHANGELOG.md
  references/         # standards + canonical/anti examples (Commit 3)
  templates/          # new_skill + new_reference scaffolds
  scripts/            # dependency-free Node validators (Commit 4)
  tests/              # node --test coverage (Commit 4)
  examples/           # walkthrough + dogfood rehearsal (Commit 3 / 5)
```

## Constraints

- Local, laptop-friendly, **no GPU**, no heavy local model, no new runtime deps
  (repo policy). Validators are dependency-free Node ESM.
