# Reference: Skill Standard

The single source of truth for **what a skill is** and the minimum Definition of
Done that makes one complete. The skill template, the package validator, and
every future skill are derived from this document.

> Relationship to the repo: this standard is compatible with — and refines —
> the existing `.claude/skills/skill-development/SKILL.md`. That skill remains
> the sanctioned route out of a Phase 0 no-fit; this standard adds the anatomy
> and DoD that any skill it produces must satisfy.

## Definition

A **skill** is a reusable package that helps a human or AI agent perform,
create, review, or validate a specific kind of work. A skill is not just
instructions: when relevant it also ships templates, examples, anti-examples,
scripts, tests, schemas, and references so that future runs are more accurate.

## Canonical anatomy

A skill package lives at `.claude/skills/<name>/` and is organized as:

```
.claude/skills/<name>/
  SKILL.md          # required — the contract (see below)
  README.md         # recommended — human orientation
  manifest.yaml     # recommended — declared file inventory (validator checks it)
  ASSUMPTIONS.md    # required when the skill makes inheritable decisions
  references/       # optional — first-class supporting artifacts
  templates/        # optional — scaffolds the skill emits
  scripts/          # optional — dependency-free Node validators/helpers
  tests/            # optional — node --test coverage for any scripts
  examples/         # optional — canonical good example + anti-example
```

Sections marked *optional* are encouraged but not required; sections marked
*required* are checked by the validator.

## Required `SKILL.md` structure

`SKILL.md` MUST contain:

1. **YAML frontmatter** with exactly:
   - `name:` — kebab-case, matches the directory name.
   - `description:` — one sentence, ≤ 200 chars, "what + when". The catalog
     ranker uses this verbatim, so it must be specific.
2. `# <Title Case Name>` — H1 title.
3. **One orienting paragraph** — the WHAT and the WHEN, concrete.
4. `## When to use` — at least two explicit triggers.
5. `## Inputs` — required inputs with type/shape.
6. `## Outputs` — what is produced, including format.
7. `## Steps` — verb-led, numbered, each with a visible output; the last step
   is a verification step.
8. `## Validation` — a checklist a reviewer can run to confirm completion.
9. `## Examples` — at least one concrete input → output example.

## Definition of Done (a skill is "done" when ALL are true)

- [ ] `SKILL.md` exists and contains all 9 required elements above.
- [ ] `description` frontmatter is ≤ 200 chars and states both *what* and *when*.
- [ ] Directory name == frontmatter `name`.
- [ ] Every file the skill claims to ship is listed in `manifest.yaml` and
      exists on disk (and vice-versa) — no orphans, no phantoms.
- [ ] Each non-trivial file in the package has a recorded Artifact Intent Card
      (see `artifact_intent_card_standard.md`).
- [ ] If the package ships scripts, they run under `node` with zero runtime
      dependencies and have at least one `node --test` case.
- [ ] If the skill makes inheritable decisions, `ASSUMPTIONS.md` records them.
- [ ] No GPU, no heavy-local-model, and no new runtime dependency is introduced.

## What a skill is NOT

- A dumping ground of prose with no triggers or DoD.
- A duplicate of an existing catalog skill (extend/reference instead).
- A wrapper that hides improvisation behind a `SKILL.md` title.

## Validation signal (for tooling)

A validator can assert skill completeness by checking, in order: frontmatter
fields → required `SKILL.md` headings → manifest⇄filesystem parity → AIC
presence → script/test/dependency policy. Each failed check maps to one DoD
bullet above.
