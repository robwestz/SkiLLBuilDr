# Reference: Artifact Intent Card (AIC) Standard

The Artifact Intent Card is the gate the whole skill system rests on. **No file
is created or modified before its AIC exists and passes this standard.** If an
AIC cannot be filled in clearly, the file must not be created.

## Storage and format

- AICs are written in **YAML**.
- One skill's cards are collected in `artifact_intent_cards.yaml` at the skill
  root (one document per artifact, separated by `---`), OR inline in the
  pre-commit grind for documentation-only commits.
- A simple line-oriented parser is sufficient; no YAML library dependency is
  required (keep cards flat, avoid deep nesting beyond the enums below).

## Field specification

Legend: **(R)** required, **(O)** optional. Enum fields list allowed values.

| Field | Req | Type | Rule |
|-------|-----|------|------|
| `artifact_name` | R | string | Basename of the file. |
| `artifact_path` | R | string | Path relative to repo root (or `<ROOT>/...` if root undecided). |
| `artifact_type` | R | enum | one of: `skill`, `doc`, `script`, `schema`, `template`, `reference`, `test`, `config`, `example`, `other`. |
| `why_this_artifact_must_exist` | R | string | The justification. Empty/"seems reasonable" ⇒ FAIL. |
| `problem_it_prevents` | R | string | The concrete failure avoided. |
| `future_artifact_or_workflow_it_enables` | R | string | The downstream artifact/workflow improved. |
| `intended_consumer` | R | enum[] | one or more of: `human`, `Claude`, `future_agent`, `future_skill`, `validation_script`, `CLI_workflow`, `test_runner`. |
| `required_inputs` | R | string | What must exist for this artifact to be authored. |
| `expected_outputs` | R | string | What the artifact yields, including format. |
| `interface_contract` | R | string | The shape/structure consumers can rely on. |
| `definition_of_done` | R | string | The condition that makes it complete. |
| `validation_method` | R | string | How completion is checked (script name or manual checklist). |
| `failure_modes` | R | string | How it could go wrong. |
| `what_should_not_be_included` | R | string | Explicit scope boundary. |
| `assumptions` | R | string | Inheritable decisions (cross-link ASSUMPTIONS.md). |
| `downstream_snowball_effect` | R | string | How it makes the next step more accurate. |

## Pass/fail rules (a card is VALID iff)

- [ ] All 16 required fields are present and non-empty.
- [ ] `artifact_type` is a single value from its enum.
- [ ] `intended_consumer` is a non-empty list, each value from its enum.
- [ ] No required field contains a non-justification placeholder
      (`TODO`, `TBD`, `???`, `seems reasonable`, `figure out later`).
- [ ] `downstream_snowball_effect` names a *specific* future artifact/workflow,
      not a generic "improves quality".

Any failed check ⇒ the card is INVALID ⇒ the file must not be created.

## Canonical example (VALID)

```yaml
artifact_name: skill_standard.md
artifact_path: .claude/skills/metacognitive-skill-architect/references/skill_standard.md
artifact_type: reference
why_this_artifact_must_exist: Defines what a skill is and its minimum DoD.
problem_it_prevents: Inconsistent, half-finished skills with no shared baseline.
future_artifact_or_workflow_it_enables: SKILL.md.template and validate_skill_package.
intended_consumer: [human, future_agent, future_skill, validation_script]
required_inputs: Existing repo SKILL.md convention; the skill definition.
expected_outputs: Canonical skill anatomy + mandatory sections + DoD checklist.
interface_contract: Numbered section list the validator maps 1:1 to file checks.
definition_of_done: A novice can read it and know exactly what a complete skill requires.
validation_method: Cross-checked against example_good_skill and validate_skill_package.
failure_modes: Too abstract to validate against; or duplicates skill-development.
what_should_not_be_included: Domain-specific examples (those live in examples/).
assumptions: SKILL.md with YAML frontmatter is the format (repo convention).
downstream_snowball_effect: Every future skill is measured against one source.
```

## Anti-example (INVALID — do NOT accept)

```yaml
artifact_name: helpers.js
artifact_path: ./helpers.js
artifact_type: script
why_this_artifact_must_exist: Seems useful to have some helpers.   # placeholder ⇒ FAIL
problem_it_prevents:                                               # empty ⇒ FAIL
future_artifact_or_workflow_it_enables: TODO                       # placeholder ⇒ FAIL
intended_consumer: everyone                                        # not in enum ⇒ FAIL
# ... remaining required fields missing ⇒ FAIL
downstream_snowball_effect: makes things better                    # generic ⇒ FAIL
```

The anti-example fails on ≥5 named dimensions: placeholder justification, empty
required field, `TODO`, out-of-enum consumer, missing fields, and a generic
snowball claim. The difference from the canonical example is **validatable**,
not cosmetic.
