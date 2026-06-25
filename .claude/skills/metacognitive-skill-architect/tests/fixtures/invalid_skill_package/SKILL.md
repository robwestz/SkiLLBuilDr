---
name: invalid_skill_package
description: This description is deliberately far too long so that it exceeds the two hundred character maximum imposed by the skill standard, which means the package validator must report that the description exceeds the allowed length here today.
---

# Invalid Skill Package

A deliberately broken fixture used to prove the validator rejects bad packages.
It omits required headings and ships an undeclared helper file.

## When to use

- Never in production; this exists only as the canonical FAIL fixture.

## Inputs

- A path to this broken package directory.

## Outputs

- A list of validator failures.

## Examples

- Input: this package → Output: FAIL with several named problems.
