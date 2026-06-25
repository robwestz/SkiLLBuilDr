# Reference: Anti-Patterns

> Type: checklist / mini-documentation
> Per-type DoD: see reference_standard.md

The failure modes Skill #0 exists to stop. Each anti-pattern names the smell,
why it is harmful, and the gate that catches it. If a package or card matches any
row, it is rejected.

## Content

| # | Anti-pattern | Why it is harmful | Caught by |
|---|--------------|-------------------|-----------|
| AP1 | **File created without an AIC** ("seems reasonable") | No recorded purpose; nobody can tell why it exists or what it enables | G2 |
| AP2 | **Placeholder justification** (`TODO`, `TBD`, "makes things better") | Pretends to satisfy the gate while saying nothing | G3 |
| AP3 | **Manifest drift** (file on disk not in manifest, or vice-versa) | The package's stated contents lie about reality | G4 |
| AP4 | **Cosmetic anti-example** (differs from the good example only by wording) | Proves nothing; the validator cannot show a real PASS/FAIL contrast | G5 |
| AP5 | **Duplicate skill** (re-implements an existing catalog skill) | Two competing systems; the snowball forks instead of compounding | manual review + ASSUMPTIONS A2 |
| AP6 | **Hidden assumption** (inheritable decision not in ASSUMPTIONS.md) | Future skills inherit an invisible decision and re-discover it the hard way | manual review + §7 policy |
| AP7 | **GPU / heavy-dep creep** (introduces a runtime dependency or model) | Breaks the laptop-friendly, zero-runtime-dep constraint | G7 |
| AP8 | **Prose-only skill** (no triggers, no DoD, no validation) | Cannot be invoked deterministically or verified | skill_standard.md DoD |
| AP9 | **Decorative reference** (nothing points to it, no per-type DoD) | Filler that inflates the package without adding accuracy | reference_standard.md cross-cutting DoD |
| AP10 | **Forward reference** (artifact depends on an unbuilt file) | Breaks the monotonic snowball; the dependency graph has dangling edges | process_standard.md §2 |

## How it is consumed

- Consumed by: reviewers running the manual gate, `example_bad_skill.md` (which
  instantiates several of these), and the validators (which automate AP1–AP4, AP7).
- Validation signal: a clean package matches zero rows.

## What this reference is NOT

- An exhaustive list of all possible mistakes — it is the high-frequency set the
  gate is tuned to catch. New recurring smells should be added here over time.
