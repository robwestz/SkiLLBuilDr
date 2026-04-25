# AGENT ONBOARDING — required reading before any work

> **This document is mandatory for every agent that starts work in this repo.**
> If you skipped it and started anyway, stop. Go back. Read this. Sign 0.6 in your KICKOFF.

This is the project's contract with you. It applies for the rest of your session
and every future session that reads `CLAUDE.md` (which references this file).

---

## Why this exists

Agents that start without onboarding repeat known mistakes, miss the catalog
of capabilities the project has already built, and either ask the operator
trivial questions or improvise quietly. Both fail the "no human in the loop"
goal of this project. The solution is the same one used in human onboarding:
a short, mandatory checklist before access is granted.

You may not write code, run tests, commit, or push until **all 8 onboarding
gates** below are passing. The 9th gate (Phase 0 Preflight) is per-task, not
per-session, and is described in `frameworks/COMPOUND.md`.

---

## The 8 onboarding gates

### Gate 1 — Read the canonical context

- [ ] Read this file (`AGENT_ONBOARDING.md`) in full.
- [ ] Read `frameworks/FRAMEWORKS.md` index to know what reusable specs exist.
- [ ] Read `FUTURE_WORK.md` to know what is deliberately deferred (so you don't accidentally re-build it).

### Gate 2 — Identify yourself

State, in your first user-facing message:

- Who you are (model + version, e.g. "Claude Opus 4.7 1M context", "Codex GPT-5.4")
- What role you are taking (lead architect / builder / reviewer / subagent)
- What tier you are operating at (`mvp` / `production` / `cutting-edge`)
- Which scope you are touching (single file / package / repo-wide)

### Gate 3 — Verify the environment is healthy

Run these commands. **All must succeed before you start.** If any fails, fix
the underlying problem before proceeding (do not work around it).

```bash
node --version          # expect ≥ 18
node --test tests/*.test.mjs   # expect "fail 0"
git status              # confirm branch + clean-or-known-dirty state
ls data.json data.public.js 2>/dev/null  # at least one must exist
```

If you cannot run these (e.g. no shell access), state that explicitly and
narrow your work to read-only research.

### Gate 4 — Inspect the recent history

```bash
git log --oneline -10   # see what just landed
git status --short      # see what's already in flight (don't trample it)
```

If recent commits suggest someone else is actively working on the same area,
**stop and surface the conflict to the operator before starting**.

### Gate 5 — Skill loadout self-check

For every task you take on:

- Run `/skill-development` (see `.claude/skills/skill-development/SKILL.md`)
  if Phase 0.2 of your KICKOFF returns `partial` or `miss`. The skill-first
  fallback is the only sanctioned route out of a no-fit. Ad-hoc improvisation
  is forbidden — see Phase 0.3 in your KICKOFF.

- Confirm you can name **at least one specific skill from the catalog** that
  covers the work. If you cannot, you are not yet ready to start.

### Gate 6 — Read the push/commit routine (Section A below)

Acknowledge the rules in Section A. They are not suggestions. Violating them
is a hard-fail that the operator will reverse, costing your session credibility.

### Gate 7 — Read the hard constraints (Section B below)

Acknowledge the constraints in Section B. These are project-level rules that
apply across all tasks regardless of KICKOFF specifics.

### Gate 8 — Sign onboarding

Append a single line to your first user-facing message:

```
ONBOARDED: <your-id> at <ISO-8601 timestamp> — gates 1–7 passed.
```

This signature certifies you have read and accepted everything above. The
operator will reject work from any agent that has not signed onboarding.

---

## Section A — Push & Commit Routine

### Commit cadence

- **Commit at chunk boundaries**, not at task end. Each chunk ends with its
  own `[COMPOUND]` block (per `frameworks/COMPOUND.md`) — that is your commit
  signal.
- **No commits without tests green** for the affected module. If tests are
  flaky, either fix them or document the flake explicitly in the commit body
  with a quarantine plan.
- **No --amend on commits that have been pushed.** Always create a new commit.

### Commit message format

Use conventional-commits style. The first line is `<type>: <imperative summary>`
where `<type>` is one of: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`,
`perf`, `build`, `ci`.

Examples that pass review:

- `feat: assemble.mjs --scenario-gate flag wires factory/v1/ as blind eval`
- `fix: slugifyLabel truncates at 80 chars (Windows path-limit fix)`
- `test: expand zip-builder coverage from 2 → 7 cases`

The commit body should explain **why**, not what. The diff already shows what.
Reference the chunk that produced the work and the Quality Gate verdict if it
is non-trivial. Always end with the appropriate `Co-Authored-By:` trailer when
the work was AI-assisted.

### Push routine

1. **Run tests one more time.** `node --test tests/*.test.mjs` must show `fail 0`.
2. **Pull first, always.** `git pull --no-rebase --no-edit origin main` — this
   integrates remote work (Robin sometimes merges PRs in parallel) without
   rewriting any of your commits.
3. **Then push.** `git push origin main`.
4. **If push fails on branch protection,** stop. Surface to operator. Do not
   force or skip hooks under any circumstance.

### Push permission

**You may not push to `origin/main` unless one of these is true:**

- The operator gave you explicit approval for this specific push.
- A standing rule for your session explicitly allows you to push (e.g.
  "you may push when tests are green and the change is documentation-only").

If neither is true, commit locally and surface the unpushed commits in your
status report. The operator decides when to push.

### Branch hygiene

- Long-running or risky work goes on a feature branch (`<role>/<short-desc>`).
- Small fixes / docs / typo-style work can go directly on main if push permission
  is granted.
- Never push to a branch you don't own.
- Never force-push. Never skip hooks (`--no-verify`). Never bypass signing.

### Worktree handling

If you are working in a git worktree (e.g. via `git worktree add`):

- Your commits are visible in the parent repo's `git log` — they share history.
- Pushes from a worktree push the parent's branch, with all the same rules.
- When done, ask the operator to clean up the worktree — do not delete it
  yourself if the operator might want to review your unpushed commits.

---

## Section B — Hard Constraints

These apply regardless of KICKOFF, regardless of tier, regardless of urgency.

### Zero runtime dependencies

This project ships as a self-contained Node.js + bash + python-stdlib tool.
Adding a runtime `dependencies` to `package.json` requires explicit operator
approval. Dev-deps for testing/playwright are fine. Bundling a small inline
helper from a vetted source is fine. New transitive dependency trees are not.

### No destructive ops without explicit confirmation

Forbidden without a one-line operator approval in the same session:

- `rm -rf` on anything outside `out/`, `dist/`, `coverage/`, `node_modules/`,
  `.cache/`, `test-results/`, or your own temp dirs
- `git reset --hard`, `git push --force`, `git rebase -i` on shared branches
- Dropping/truncating database tables
- Deleting branches that have unmerged work
- Rewriting commit history that has been pushed

### Never silently work around a failing check

If `npm test` fails, fix the test or fix the code — do not delete the test.
If a hook blocks your edit, present the required facts and proceed; do not
disable the hook. If a CI check is red, surface it; do not bypass it.

### Never read or write outside the workspace boundary

Without operator approval, do not:

- Read files outside the project root or your assigned worktree
- Write files outside the project root or `out/`
- Send anything outside the operator's machine (no telemetry, no analytics,
  no API calls to external services other than the LLM provider you were
  explicitly given a key for)

### Always surface, never hide

If you discover a bug in someone else's code: surface it (a `note:` line in
your status report, or an `OPEN_QUESTIONS.md` entry). Do not silently fix it
unless your task explicitly authorizes that.

If you cannot complete a chunk: surface the blocker. Do not pretend completion
in `[COMPOUND]` block. The blast radius of a falsely-claimed-done chunk is
much larger than a clearly-flagged blocker.

If you used a workaround instead of the right fix: say so explicitly in your
commit body, and add an entry to `FUTURE_WORK.md` for the proper fix.

---

## What "ready to start work" looks like

You are ready when:

1. ✓ Onboarding signed (Gate 8)
2. ✓ Phase 0 Preflight signed in your task's KICKOFF (per `frameworks/COMPOUND.md`)
3. ✓ Skill loadout reviewed and gaps closed via `/skill-development` if needed
4. ✓ Tests green
5. ✓ Recent git history understood
6. ✓ A specific catalog skill is named for the first chunk

If any of these is unchecked, you are not ready. The cost of one extra check
is minutes; the cost of skipping is a wrecked branch and a tired operator.

---

## Provenance and authority

This document is the project's standing contract with agents. It supersedes
ad-hoc instructions in single chat turns when those conflict. The operator
can override any specific clause for a specific task — but the override must
be explicit and per-task, not implicit.

Maintained at the repo root so every agent that lands here finds it. New
sessions auto-load it via `CLAUDE.md`. The skill-form is at
`.claude/skills/agent-onboarding/SKILL.md` for explicit invocation.

When this contract changes, bump its version in the table below and link the
commit. Old sessions that completed before the change are not retroactively
required to comply.

| Version | Date | Commit | Summary |
|---|---|---|---|
| 1.0 | 2026-04-25 | (this commit) | Initial 8-gate onboarding + push/commit + hard constraints |
