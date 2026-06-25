# ASSUMPTIONS — metacognitive-skill-architect (Skill #0)

Every architectural, format, or validation decision that future skills will
silently inherit is recorded here with an explicit status. A skill that reads
this file should never have to *re-discover* a decision — it either reuses it or
challenges it on the record.

## Status legend

- `locked` — decided for this session; change only with operator approval.
- `revisit_required` — a reasonable local default was taken, but it affects
  future skills/validation and should be reconsidered before Skill #2+.

## Assumptions

| # | Assumption | Rationale | Status | Affects |
|---|------------|-----------|--------|---------|
| A1 | Skill #0 lives at `.claude/skills/metacognitive-skill-architect/` | Matches the repo's existing catalog convention (`.claude/skills/<name>/`); a parallel top-level `skills/` tree would create two competing skill systems — an anti-pattern. | locked | All paths, manifest, validators |
| A2 | Skill #0 *governs and references* the existing `skill-development` skill rather than duplicating it | The repo already ships `.claude/skills/skill-development/SKILL.md` as the sanctioned no-fit escape valve. Skill #0 adds the Artifact Intent Card gate *on top of* it. | locked | SKILL.md, process_standard.md, dogfood rehearsal |
| A3 | Validators are dependency-free Node ESM (`.mjs`), not Python | CLAUDE.md mandates zero runtime dependencies; the test runner is `node --test`. Python would add an unmanaged toolchain. (Prompt suggested `.py`.) | locked | scripts/, tests/, manifest |
| A4 | Tests run via `node --test` and live in the skill's own `tests/` dir | Mirrors repo testing (`tests/*.test.mjs`) so Skill #0 tests are discoverable by the same command family. | revisit_required | Commit 4 test layout |
| A5 | Artifact Intent Cards are stored as YAML | Directly from the prompt schema; YAML is human-writable and machine-parseable without deps (simple line parser acceptable). | locked | AIC standard, validator |
| A6 | SKILL.md uses YAML frontmatter (`name`, `description`) | Required by the repo catalog ranker (see existing skills). | locked | skill_standard.md, templates |
| A7 | Target environment is a laptop, no GPU, ~32 GB RAM | From the prompt. No local model execution, no GPU deps, no heavy services. | locked | All artifacts, validators |
| A8 | "Reference" is interpreted broadly (templates, fixtures, schemas, examples, anti-examples, checklists, prompt fragments, walkthroughs...) | From the prompt's explicit definition. | locked | reference_standard.md |
| A9 | Commit rules harmonize with — do not override — repo rules (zero-dep, tests-green, no push to main without approval) | The repo's AGENT_ONBOARDING Section A/B is authoritative; Skill #0's process layers on top. | locked | process_standard.md |
| A10 | Documentation dialogue is Swedish; artifacts are English | Operator preference; English keeps artifacts consistent with the existing catalog. | revisit_required | All artifacts |

## Revisit log

When a `revisit_required` assumption is reconsidered, add a dated line here
describing the new decision and which assumption it supersedes.

- _(none yet)_
