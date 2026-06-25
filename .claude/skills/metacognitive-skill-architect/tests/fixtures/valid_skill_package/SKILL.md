---
name: valid_skill_package
description: Validate YAML frontmatter (name, description) in SKILL.md files; use before committing a new or edited skill.
---

# Valid Skill Package

A minimal skill that passes every automated gate. It checks that a SKILL.md has a
name matching its directory and a description under 200 characters, and exists
purely as the canonical PASS fixture for the package validator.

## When to use

- Before committing a new skill, to confirm its frontmatter is well-formed.
- When editing an existing SKILL.md and you want a quick structural check.

## Inputs

- A path to a skill package directory containing a `SKILL.md`.

## Outputs

- A PASS/FAIL result with one line per detected problem.

## Steps

1. Read the target `SKILL.md` and parse its frontmatter.
2. Check `name` matches the directory and `description` is under 200 chars.
3. Verify the required headings are present.
4. Report PASS or the list of problems (verification step).

## Validation

- [ ] Frontmatter has `name` and `description`.
- [ ] `description` is at most 200 characters.
- [ ] All required headings are present.

## Examples

- Input: a package whose `SKILL.md` has a 150-char description → Output: PASS.
