# Dogfood rehearsal — planning Skill #1 with Skill #0 (plan only)

> Type: walkthrough / rehearsal
> Per-type DoD (reference_standard.md): a reader can see the method applied to a
> concrete next skill, and can see that it caught a problem *before* any code.

This is the proof obligation for the dogfood-snowball claim. The
`skill_1_creation_walkthrough.md` describes the *method*; this file **runs the
method on paper** against a concrete Skill #1 and shows the payoff.

**Hard boundary:** no files for Skill #1 are created here. The deliverable is the
*plan and its gate evaluation*, not the skill. Nothing under
`.claude/skills/frontmatter-linter/` exists on disk after this rehearsal.

---

## 0. The candidate

- **Skill #1 — `frontmatter-linter`**: validates the YAML frontmatter of a
  `SKILL.md` (name present and matching directory; description present and
  ≤ 200 chars). A focused field linter, distinct from Skill #0 (which gates
  *whether a file may exist*) and from `skill-development` (which authors skills).

The gap contract and step sequence are in `skill_1_creation_walkthrough.md`
§1–§6. This rehearsal picks up at the point where Skill #0's artifacts start
paying off.

## 1. The snowball, made concrete

Each row is a decision that would be *invented from scratch* without Skill #0,
and is instead *inherited* because a prior artifact already settled it.

| Decision for Skill #1 | Inherited from (Skill #0 artifact) | Cost avoided |
|---|---|---|
| Package shape (`SKILL.md` + `manifest.yaml` + AICs + `scripts/` + `tests/`) | `canonical_skill_package.md` | Re-deriving a layout; structural drift |
| `SKILL.md` headings + DoD | `skill_standard.md`, `SKILL.md.template` | Forgetting Steps/Validation; over-long description |
| Per-file justification schema | `artifact_intent_card_standard.md`, `artifact_intent_cards.yaml.template` | Inventing a "why" format; unmotivated files |
| Pass/fail definition of the linter's own examples | `example_good_skill.md` / `example_bad_skill.md` (G5) | Examples that differ only cosmetically |
| What "done" means for the commit | `process_standard.md` §1, §5 | Ad-hoc, unverifiable DoD |
| Executable acceptance | `scripts/validate_skill_package.mjs`, `scripts/validate_artifact_cards.mjs` | Manual, drift-prone checking |

The point of the snowball: by Skill #1, *the only new thinking is the linter's
own logic.* Everything about being-a-valid-skill is supplied.

## 2. Rehearsed AIC gate (filled from the template, dry-run)

Filling `templates/new_skill/artifact_intent_cards.yaml.template` for the four
planned files. These are written here for the rehearsal; in a real build they
would live in `.claude/skills/frontmatter-linter/artifact_intent_cards.yaml`.

```yaml
artifact_name: SKILL.md
artifact_path: .claude/skills/frontmatter-linter/SKILL.md
artifact_type: skill
why_this_artifact_must_exist: Declares the frontmatter-linter capability and its contract so agents can invoke it.
problem_it_prevents: SKILL.md files merged with a missing/over-long description or a name that does not match its directory.
future_artifact_or_workflow_it_enables: A pre-commit frontmatter check used by every new skill, including Skill #2+.
intended_consumer: [human, Claude, future_agent]
required_inputs: skill_standard.md headings; the lint rules (name, description<=200, name==dir).
expected_outputs: A SKILL.md with frontmatter and the six required headings.
interface_contract: name matches directory; description <= 200 chars; headings When to use/Inputs/Outputs/Steps/Validation/Examples.
definition_of_done: validate_skill_package.mjs passes on the package; lint rules documented under Steps.
validation_method: node scripts/validate_skill_package.mjs .claude/skills/frontmatter-linter
failure_modes: Description creeps past 200 chars; Steps section omitted.
what_should_not_be_included: The lint implementation (belongs in scripts/lint.mjs).
assumptions: SKILL.md frontmatter is the lint target (inherits ASSUMPTIONS.md A-format).
downstream_snowball_effect: Gives Skill #2 a working linter to call instead of re-checking frontmatter by hand.

---
artifact_name: manifest.yaml
artifact_path: .claude/skills/frontmatter-linter/manifest.yaml
artifact_type: config
why_this_artifact_must_exist: Declares the package inventory so G4 parity is checkable.
problem_it_prevents: Phantom or orphan files drifting from the real tree.
future_artifact_or_workflow_it_enables: Automated parity checks across every future skill.
intended_consumer: [validation_script, future_agent]
required_inputs: The final file list of the package.
expected_outputs: A manifest listing SKILL.md, manifest.yaml, scripts/lint.mjs, tests/lint.test.mjs and the cards pointer.
interface_contract: Block/inline lists keyed by section; cards pointer to artifact_intent_cards.yaml.
definition_of_done: validate_skill_package.mjs reports no phantom and no orphan files.
validation_method: node scripts/validate_skill_package.mjs .claude/skills/frontmatter-linter
failure_modes: A new file is added without a manifest entry.
what_should_not_be_included: Build output or generated data.
assumptions: One manifest per skill package.
downstream_snowball_effect: Lets the package validator trust Skill #1 the same way it trusts Skill #0.

---
artifact_name: lint.mjs
artifact_path: .claude/skills/frontmatter-linter/scripts/lint.mjs
artifact_type: script
why_this_artifact_must_exist: Implements the actual frontmatter checks the skill promises.
problem_it_prevents: A skill that claims to lint frontmatter but performs no check.
future_artifact_or_workflow_it_enables: A CI/pre-commit hook that rejects bad frontmatter automatically.
intended_consumer: [CLI_workflow, test_runner, future_agent]
required_inputs: A path to a SKILL.md (or a skill directory).
expected_outputs: Exit 0 on valid frontmatter, exit 1 with named violations otherwise.
interface_contract: CLI node lint.mjs <path>; exported pure function lintFrontmatter(text, dirName) for tests.
definition_of_done: Passes lint.test.mjs; dependency-free Node ESM.
validation_method: node --test on lint.test.mjs
failure_modes: Reading description length in bytes vs chars; mishandling quoted names.
what_should_not_be_included: Any heavy/ML/GPU import (G7); a YAML library (parse line-oriented).
assumptions: Frontmatter is a leading --- fenced block (inherits Skill #0's parser approach).
downstream_snowball_effect: Becomes the reusable check that validate_skill_package.mjs can later delegate to.

---
artifact_name: lint.test.mjs
artifact_path: .claude/skills/frontmatter-linter/tests/lint.test.mjs
artifact_type: test
why_this_artifact_must_exist: Proves the linter accepts good frontmatter and rejects each named violation.
problem_it_prevents: A silently broken linter that passes everything.
future_artifact_or_workflow_it_enables: Regression safety as the linter evolves.
intended_consumer: [test_runner, future_agent]
required_inputs: The lintFrontmatter export and fixture strings.
expected_outputs: node --test cases asserting PASS and each FAIL reason.
interface_contract: node:test cases importing lintFrontmatter.
definition_of_done: All cases pass under node --test tests/*.test.mjs.
validation_method: node --test .claude/skills/frontmatter-linter/tests/lint.test.mjs
failure_modes: Asserting on message wording that later drifts.
what_should_not_be_included: Network or filesystem writes.
assumptions: Fixtures mirror the good/bad pair pattern (G5).
downstream_snowball_effect: Locks linter behavior so Skill #2 can depend on it.
```

## 3. Dry-run of the gates against the plan

Reading the gate definitions from `process_standard.md` §3 and applying them to
the plan above — *before any file is written*:

| Gate | Applied to the plan | Result |
|---|---|---|
| G1 required files | SKILL.md + manifest.yaml planned | would PASS |
| G2 AIC present | all four files have a card above | would PASS |
| G3 AIC valid | 16 fields, no placeholders (see §4 catch) | PASS *after* the fix |
| G4 parity | manifest list == planned tree | would PASS |
| G5 divergence | linter's own good/bad fixtures differ on a named rule (missing name vs present) | would PASS |
| G6 snowball | this document demonstrates Skill #0 → Skill #1 reachability | PASS |
| G7 hygiene | "no heavy/ML/GPU import" stated in lint.mjs card | would PASS |

## 4. The problem the method caught early

The rehearsal is only worth anything if it catches something. It did:

- **Drafting the `lint.test.mjs` card, the `interface_contract` field was first
  left implied** ("tests the linter"). Filling the 16-field schema forced the
  question *"which exact export do the tests import?"* — which surfaced that
  `lint.mjs` must expose a **pure `lintFrontmatter(text, dirName)`** function, not
  only a CLI. Without that, the tests would have to shell out and parse stdout.
  This interface decision was made *before* a line of `lint.mjs` existed, instead
  of being discovered painfully during test-writing.
- **A latent ambiguity in the rule "description ≤ 200"**: chars vs bytes. The
  `failure_modes` field on the `lint.mjs` card named it, so it becomes a written
  test case rather than a production surprise.

Both are the snowball working as intended: the *standard* and the *card schema*
did the thinking, the author only had to answer.

## 5. What was deliberately NOT done

- No `.claude/skills/frontmatter-linter/` directory, and no files in it.
- No edits to Skill #0's own validators to special-case Skill #1.
- No new runtime dependency.

## 6. Verdict

The method improves the next step: of the six decisions in §1, five are inherited
rather than invented, and the AIC gate caught one interface decision and one rule
ambiguity *before* code. The next action a builder takes (Step 4 of the
walkthrough — scaffold from templates) starts from a validated plan, so the first
`validate_skill_package.mjs` run on the real package is expected to pass on the
first or second try rather than after a sequence of structural fixes.

## What this rehearsal is NOT

- An implementation of `frontmatter-linter` — that is intentionally deferred.
- A guarantee the linter's *logic* is correct — only that its *package and
  intent* are sound before building.
