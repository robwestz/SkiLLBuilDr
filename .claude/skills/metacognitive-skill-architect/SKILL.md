---
name: metacognitive-skill-architect
description: Gate, scaffold, and validate new skills via an Artifact Intent Card before any file is created; use when building or reviewing a skill package in this repo.
---

# Metacognitive Skill Architect

Skill #0 — the skill that builds skills. It enforces a single rule: **no file is
created until its Artifact Intent Card (AIC) is written and passes the AIC
standard.** It is the architect (defines what a skill/reference is), the
gatekeeper (rejects unjustified files), the scaffolder (emits templates for new
skill packages), and the validator (checks packages and AICs). It governs and
references the repo's existing `skill-development` skill rather than replacing it.

## When to use

- You are about to create a new skill package and want it to be complete,
  validatable, and consistent with the catalog from the first file.
- A Phase 0 skill-scan returned `partial`/`miss` and `skill-development` sent you
  here to author the artifact under a strict create-time gate.
- You are reviewing an existing skill/reference package and need a pass/fail
  verdict against the standards.
- You are planning Skill #1+ and want the dogfood snowball to make each step
  more accurate than the last.

## Inputs

- A **gap statement** (one sentence) and the **triggering goal** (verbatim).
- For each file you intend to create: a filled **Artifact Intent Card** (YAML,
  per `references/artifact_intent_card_standard.md`).
- The target package path under `.claude/skills/<name>/`.

## Outputs

- A scaffolded skill package under `.claude/skills/<name>/` produced from
  `templates/new_skill/` (SKILL.md, README.md, manifest.yaml, AIC collection).
- A pass/fail validation verdict per gate G1–G7 (`references/process_standard.md`).
- An updated `ASSUMPTIONS.md` whenever an inheritable decision is made.

## Steps

1. **Restate the gap as a contract** (reuse the `[GAP CONTRACT]` block from
   `skill-development`); decide artifact type via its decision tree.
2. **Write an Artifact Intent Card** for every file you intend to create; print
   each card. (Visible output.)
3. **Validate the cards** against `references/artifact_intent_card_standard.md`
   (manually now; via `scripts/validate_artifact_cards.mjs` from Commit 4).
   Any INVALID card ⇒ stop; do not create that file.
4. **Scaffold** the package from `templates/new_skill/` and fill every
   placeholder (no blanks left). (Visible output: the created files.)
5. **Update `manifest.yaml`** so it matches the files on disk exactly.
6. **Run the pre-commit grind** (`process_standard.md` §5), commit per the
   harmonized commit rules.
7. **Verify** with the gate checklist G1–G7 and record a post-commit report
   (`process_standard.md` §6). (Verification step.)

## Validation

- [ ] Every created/changed file had a VALID AIC before creation (G2, G3).
- [ ] `SKILL.md` of the produced skill has all 9 required elements
      (`references/skill_standard.md`).
- [ ] `manifest.yaml` ⇄ filesystem parity holds (G4).
- [ ] Canonical example PASSes and anti-example FAILs on a named dimension (G5).
- [ ] Skill #0 can describe how the next skill is created (G6).
- [ ] No GPU assumption and no new runtime dependency introduced (G7).

## Examples

Input → Output (abridged):

```
Input:
  gap:     "no covering skill for validating markdown frontmatter"
  goal:    "add a frontmatter linter to the assemble pipeline"
  type:    skill  (reusable capability)

Output (after the AIC gate passes for each file):
  .claude/skills/frontmatter-linter/
    SKILL.md            # 9 required elements, filled from template
    README.md
    manifest.yaml       # lists every file; parity verified
    artifact_intent_cards.yaml   # one VALID card per file above
  Verdict: G1-G7 PASS
```

See `examples/skill_1_creation_walkthrough.md` for the full worked process and
`references/example_bad_skill.md` for what a rejected package looks like.
