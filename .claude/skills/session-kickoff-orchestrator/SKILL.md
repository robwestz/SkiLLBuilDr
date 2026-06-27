---
name: session-kickoff-orchestrator
description: Run a deterministic, zero-dependency session-start ritual (repo health-check + knowledge load) that emits a Session Intent Card; use at the start of every session.
---

# Session Kickoff Orchestrator

Skill #1 — the first skill built *with* Skill #0's Artifact Intent Card gate. It
turns "start of session" into a deterministic ritual: it checks repo health
(lockfile drift, dirty tree, branch position, presence of the core contracts) and
loads carry-over knowledge (open tasks, `revisit_required` assumptions, recent
commits, the previous session's card), then renders a **Session Intent Card** in
markdown. v1 makes zero model calls and adds zero runtime dependencies; the
multi-model "council" is deferred to v2. Use it as the first action of any session
so the next session starts from better priors (the dogfood snowball).

## When to use

- At the very start of a session, before any feature work, to surface drift and
  carry-over context (wire it into the environment blueprint's session start).
- Before committing, to confirm the working tree and lockfile are still in sync.

## Inputs

- A repo root path (string; defaults to the nearest `.git` ancestor of cwd).
- Optional `--write` flag to persist the card under `.agents/kickoffs/`.
- Read-only repo artifacts: `package.json`, `package-lock.json`, `.agents/TASKS.json`,
  `.claude/skills/**/ASSUMPTIONS.md`, and `git` metadata.

## Outputs

- A **Session Intent Card** (markdown) printed to stdout, and — with `--write` —
  saved to `.agents/kickoffs/<iso-timestamp>-kickoff.md`.

## Steps

1. Resolve the repo root and read the health inputs (`package.json`,
   `package-lock.json`, `git status`/branch). Visible output: health section.
2. Load knowledge inputs (open tasks, `revisit_required` assumptions, recent
   commits, previous card). Visible output: knowledge section.
3. Render the Session Intent Card and (with `--write`) persist it. Visible output:
   the card on stdout.
4. Verify: run `node --test .claude/skills/session-kickoff-orchestrator/tests/*.test.mjs`
   and confirm the package passes `validate_skill_package.mjs` (G1–G7).

## Validation

- [ ] `node --test tests/*.test.mjs` for this skill is green.
- [ ] `detectLockfileDrift` flags a dependency present in `package.json` but absent
      from `package-lock.json` (the `npm ci` "Missing … from lock file" case).
- [ ] The rendered card reports `health: GREEN` only when no drift, a clean tree,
      and all contracts present.
- [ ] `validate_skill_package.mjs .claude/skills/session-kickoff-orchestrator` PASSES.

## Examples

```
Input:  node scripts/kickoff.mjs /path/to/repo
Output (abridged Session Intent Card):
  # Session Intent Card — 2026-06-25T10:00:00.000Z
  - branch: `main`
  - health: **ATTENTION**
  ## (a) Health check
  - lockfile: **DRIFT** — missing from lockfile: @xenova/transformers
  - working tree: clean
  ## (b) Knowledge load
  - open tasks: 2
  - revisit_required assumptions: 1
  ## Suggested focus
  - lockfile drift: 1 dep(s) missing from lockfile
```
