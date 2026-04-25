# CLAUDE.md — session entrypoint

> Claude Code reads this file at the start of every session in this repo.
> Read it fully before any work.

---

## STOP — onboarding required

**You may not write code, run tests, commit, or push until you have completed
[`AGENT_ONBOARDING.md`](./AGENT_ONBOARDING.md) and signed Gate 8.**

The 8 onboarding gates take ~5 minutes. The cost of skipping them is much
higher than the time saved. New sessions that ignore this routinely repeat
mistakes that earlier sessions already paid for.

---

## What this project is

Local browser, CLI, and assembly toolchain for Claude Code skills/commands
across all installed plugins (749 items today). Two surfaces:

- **`assembler.html`** — browser UI for assembling workspace packages
- **`assemble.mjs`** — headless CLI equivalent (the `skill-browser-assemble` npm bin)

Both produce ZIP packages whose `KICKOFF.md` is an executable contract — not
a checklist — with mandatory Phase 0 Preflight (per `frameworks/COMPOUND.md`),
Compound Mechanisms, Quality Gate, and skill-first fallback baked in.

The bigger goal: **autonomous multi-hour agent execution without human in the
loop.** Most of the infrastructure is in place. What's left is documented in
[`FUTURE_WORK.md`](./FUTURE_WORK.md).

---

## The non-negotiable contracts (read these in order)

1. [`AGENT_ONBOARDING.md`](./AGENT_ONBOARDING.md) — your session-level contract (8 gates, push/commit routine, hard constraints)
2. [`frameworks/COMPOUND.md`](./frameworks/COMPOUND.md) — your per-task contract (Phase 0 Preflight, Gap Scan, Compound Register, Context Refresh)
3. [`frameworks/QUALITY_GATE.md`](./frameworks/QUALITY_GATE.md) — your per-deliverable review (5 dimensions, cross-model adversarial)
4. [`.claude/skills/skill-development/SKILL.md`](./.claude/skills/skill-development/SKILL.md) — how to handle a no-fit (the only sanctioned escape valve)

---

## Project map

| What | Where |
|---|---|
| CLI entrypoints | `assemble.mjs`, `cli.mjs`, `intent.mjs`, `query.mjs`, `mcp-server.mjs`, `launch.mjs` |
| Browser UIs | `index.html`, `assembler.html`, `playground.html`, `landing.html` |
| Catalog build | `build.mjs` → `data.json` (gitignored) or `data.public.js` (committed snapshot) |
| Bundling | `bundle.mjs` → `dist/*.html` (gitignored) |
| Reusable lib | `kickoff-template.mjs`, `zip-builder.mjs`, `llm-client.mjs`, `hash-router.js` |
| Tests | `tests/*.test.mjs` (158 tests, run via `node --test tests/*.test.mjs`) |
| E2E | `tests/e2e/*.spec.js` (Playwright, run via `npx playwright test`) |
| Frameworks | `frameworks/` (7 imported reference specs + index) |
| Roadmap | `FUTURE_WORK.md` (8 deferred components) |
| Scenario factory | `factory/v1/` (Codex-built blind-eval gate, 4 scenarios + twins + leak-scan) |
| Project memory | `.omc/project-memory.json`, `memory/` |

---

## Conventions worth knowing

- **Zero runtime dependencies.** Dev deps only. Adding to `dependencies` requires operator approval.
- **Tier system:** `mvp` / `production` / `cutting-edge` controls Quality Gate threshold. Default for `assemble.mjs` is `production`.
- **Shared LLM key:** `assembler-llm-config-v1` localStorage entry — set once, used by Assembler, Browser, and Playground.
- **CLI ranking:** local IDF always; `--ai` opt-in for Groq/OpenRouter causal rerank when `GROQ_API_KEY` (or `OPENROUTER_API_KEY`) is set.
- **No commits without tests green.** No exceptions without operator approval.
- **No push to origin/main without operator approval.** Commit locally, surface unpushed commits in your status report.

---

## How to confirm you're ready

```bash
node --version              # ≥ 18
node --test tests/*.test.mjs # fail 0
git status                  # clean or known-dirty
ls data.json data.public.js # at least one
```

Then read `AGENT_ONBOARDING.md`, sign Gate 8, and proceed to your task's
KICKOFF.md (Phase 0 lives there).

---

## Communication norms with the operator (Robin)

- Be concise. Surface decisions, not deliberation.
- Ask for confirmation on irreversible actions (push, delete, force).
- Report unexpected state (unfamiliar files, branches, dirty trees) before acting on it.
- When you discover a bug in earlier work, name it and propose the fix — do not silently work around it.
- When tired or near context-limit, say so explicitly so the operator can restart you fresh rather than getting degraded output.
