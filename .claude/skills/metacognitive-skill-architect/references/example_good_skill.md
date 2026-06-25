# Reference: Example — Good Skill (canonical)

> Type: example_output (canonical)
> Per-type DoD: see reference_standard.md — must PASS its standard end-to-end.

A minimal skill that passes every gate. Its runnable form lives at
`tests/fixtures/valid_skill_package/` (added in Commit 4) so the validator can
assert PASS on it. This document explains *why* it passes.

## The package

```
.claude/skills/frontmatter-linter/
  SKILL.md
  manifest.yaml
  artifact_intent_cards.yaml
```

### SKILL.md (abridged)

```markdown
---
name: frontmatter-linter
description: Validate YAML frontmatter (name, description) in SKILL.md files; use before committing a new or edited skill.
---

# Frontmatter Linter

Checks that a SKILL.md has a name matching its directory and a description under
200 chars. ... (When to use / Inputs / Outputs / Steps / Validation / Examples) ...
```

### manifest.yaml

```yaml
name: frontmatter-linter
version: 0.1.0
skill_number: 1
files:
  required: [SKILL.md, manifest.yaml]
artifact_intent_cards: artifact_intent_cards.yaml
```

### artifact_intent_cards.yaml — one VALID card per file (all 16 fields filled).

## Why it PASSES (mapped to gates)

| Gate | Why it passes |
|------|---------------|
| G1 required files present | SKILL.md + manifest.yaml + cards all exist |
| G2 AIC present | every file has a card |
| G3 AIC valid | all 16 fields, no placeholders, enum values valid |
| G4 manifest parity | manifest lists exactly the files on disk |
| G5 example divergence | n/a for this minimal skill (it IS the good example) |
| G6 snowball reachability | SKILL.md describes how the next linter variant is created |
| G7 resource hygiene | pure Node check, no deps, no GPU |

## How it is consumed

- Consumed by: `scripts/validate_skill_package.mjs` (asserts PASS) and the
  walkthrough as the "target shape".
- Validation signal: validator exit code 0 on `tests/fixtures/valid_skill_package/`.

## What this reference is NOT

- A full production skill — it is the smallest thing that legitimately passes,
  chosen so the PASS/FAIL contrast with `example_bad_skill.md` is unambiguous.
