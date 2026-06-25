# Example: Creating Skill #1 with Skill #0 (walkthrough)

> Type: walkthrough
> Per-type DoD: see reference_standard.md — a novice can reproduce it end-to-end.

A full worked process showing how Skill #0 makes the next skill more accurate.
The subject is a hypothetical **Skill #1 — `frontmatter-linter`**. This is a
*walkthrough of the method*; the actual build is rehearsed in
`dogfood_rehearsal.md` (Commit 5).

## Preconditions

- You have onboarded (`agent-onboarding`).
- A Phase 0 skill-scan returned `partial`/`miss` for "validate SKILL.md frontmatter".
- `skill-development` routed you here to author the skill under the AIC gate.

## Step 1 — Gap contract (from skill-development)

```
[GAP CONTRACT]
GAP:      no covering skill validates SKILL.md frontmatter (name/description)
TRIGGER:  "add a frontmatter check before committing new skills"
REJECTED: skill-development (authors skills, does not lint frontmatter);
          metacognitive-skill-architect (gates creation, not a field linter)
TYPE:     skill   (reusable capability)
NAME:     frontmatter-linter
SCOPE:    project-local
```

## Step 2 — Write an Artifact Intent Card per intended file

Using `templates/new_skill/artifact_intent_cards.yaml.template`, fill one card
for each of: `SKILL.md`, `manifest.yaml`, `scripts/lint.mjs`, `tests/lint.test.mjs`.
Each card must satisfy all 16 fields with no placeholders.

> Snowball effect: because `artifact_intent_card_standard.md` already exists, you
> are filling a known schema, not inventing one. This is where Skill #0 pays off.

## Step 3 — Validate the cards

Run (Commit 4 onward):

```bash
node .claude/skills/metacognitive-skill-architect/scripts/validate_artifact_cards.mjs \
  .claude/skills/frontmatter-linter/artifact_intent_cards.yaml
```

Any INVALID card ⇒ stop and fix it before creating the file it describes.

## Step 4 — Scaffold from templates

Copy `templates/new_skill/*` into `.claude/skills/frontmatter-linter/` and fill
every `{{placeholder}}`. The shape already matches `skill_standard.md`, so the
result is structurally correct by construction.

## Step 5 — Update manifest + run the pre-commit grind

Make `manifest.yaml` match the files on disk, then complete the 7-point grind
(`process_standard.md` §5).

## Step 6 — Validate the package

```bash
node .claude/skills/metacognitive-skill-architect/scripts/validate_skill_package.mjs \
  .claude/skills/frontmatter-linter
```

Expect PASS (G1–G7). Commit per the harmonized commit rules; write the
post-commit report.

## Why this is more accurate than building Skill #1 cold

| Without Skill #0 | With Skill #0 |
|------------------|---------------|
| Invent a SKILL.md shape | Scaffold from a standard-backed template |
| Forget validation/DoD | DoD checklist is built into the template |
| Ad-hoc "why" (or none) | AIC gate forces a justification per file |
| Manifest drifts | Parity gate G4 catches drift |
| good/bad examples differ cosmetically | G5 forces a validatable contrast |

## How it is consumed

- Consumed by: a human or agent creating any new skill; referenced by `SKILL.md`
  Examples section.
- Validation signal: following it yields a package that passes `validate_skill_package.mjs`.

## What this walkthrough is NOT

- The actual Skill #1 implementation — that is intentionally deferred (the point
  is to prove the *method*, see `dogfood_rehearsal.md`).
