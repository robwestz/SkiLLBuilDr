# Reference: Reference Standard

References are **first-class artifacts**, not decoration. This document defines
the supported reference types and the minimum quality bar each must clear before
it counts toward a skill's Definition of Done.

## Definition

A **reference** is any supporting artifact that makes future runs of a skill
more accurate. The term is deliberately broad.

## Reference taxonomy and per-type DoD

| Reference type | Purpose | Minimum DoD | Validation signal |
|----------------|---------|-------------|-------------------|
| Template | Scaffold a new artifact with no blanks left ambiguous | Has placeholders that are *named and explained*; produces a valid artifact when filled | Filling it yields an artifact that passes the relevant standard |
| Example input | Show the expected shape of input | Realistic, minimal, self-contained | Parses/loads without external state |
| Example output (canonical) | Show a known-good result | Passes the relevant standard end-to-end | Validator returns PASS on it |
| Anti-example | Show what does NOT qualify and why | Differs from the canonical example in ≥1 *named* failing dimension | Validator returns FAIL on it for the stated reason |
| Test fixture | Provide deterministic data for tests | Stable, version-controlled, no secrets | Referenced by at least one test |
| Script | Automate a check or transform | Dependency-free Node; deterministic; non-zero exit on failure | Has a `node --test` case |
| Checklist | Enumerate manual gates | Each item is a binary pass/fail assertion | A reviewer can run it without judgment calls |
| JSON/YAML schema | Constrain a data shape | Declares required fields + types | A validator can check instances against it |
| Mini-documentation | Explain a convention concisely | States the decision and its rationale | Referenced by ≥1 other artifact |
| Decided convention | Record a chosen norm | Names the choice and the rejected alternatives | Appears in ASSUMPTIONS.md if inheritable |
| Comparison case | Contrast two approaches | States the dimension being compared | Conclusion is actionable |
| Prompt fragment | Reusable LLM instruction block | Self-contained; states intended model role | Produces stable behavior when injected |
| Validation rule | A single enforceable constraint | Expressed as pass/fail | Implementable by a validator |
| Walkthrough | Narrate a full worked process | Covers happy path start→finish | A novice can reproduce it |

## Storage convention

- References that are *files* live in the skill's `references/` directory.
- References that are *scaffolds* live in `templates/`.
- References that are *executable* live in `scripts/` (with tests in `tests/`).
- References that are *worked examples* live in `examples/`.

If a reference is intentionally **not** stored as a file (e.g. a convention that
lives only in `ASSUMPTIONS.md`), that exception must be stated where the
reference would otherwise be expected.

## Cross-cutting DoD (every reference)

- [ ] Its type is identifiable from this taxonomy.
- [ ] It clears the per-type minimum DoD above.
- [ ] It is referenced by, or referenceable from, at least one other artifact
      (a reference that nothing points to is a candidate for deletion).
- [ ] It contains no secrets, no machine-local absolute paths, no GPU/heavy-deps.

## What references are NOT

- Filler added to make a package "look complete".
- Copies of upstream docs with no local decision applied.
- Examples and anti-examples that differ only cosmetically (they must differ in
  a *named, validatable* dimension — see `process_standard.md`).
