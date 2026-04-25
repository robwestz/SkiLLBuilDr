---
name: agent-onboarding
description: Mandatory 8-gate pre-work checklist for any agent starting work in this repo. Verifies environment health, reads the canonical contracts, signs the onboarding contract before code/test/commit/push is allowed. Invocable form of AGENT_ONBOARDING.md at repo root.
---

# Agent Onboarding

The session-level contract every agent must complete before doing any work
in this repo. Use this skill to walk through the 8 onboarding gates without
having to re-read the full `AGENT_ONBOARDING.md` each time — but the
authoritative spec lives there, and you should read it once per session.

## When to use

- At the start of every new session in this repo.
- When taking over a task from another agent (you must onboard yourself, not
  inherit the previous agent's signature).
- When you realize you started work without onboarding (stop, run this, sign).

## Inputs

- Your model + version (e.g. "Claude Opus 4.7 1M context")
- Your role (lead architect / builder / reviewer / subagent)
- Your tier target (`mvp` / `production` / `cutting-edge`)
- Your scope (single file / package / repo-wide)

## Outputs

- A signed `ONBOARDED:` line in your first user-facing message
- Verification that all 8 gates passed
- A green test suite run logged in your context

## Steps (each gate is mandatory)

1. **Read `AGENT_ONBOARDING.md`, `frameworks/FRAMEWORKS.md`, `FUTURE_WORK.md`.** Skim is acceptable; full read is required for the first two.
2. **Identify yourself** with the 4 inputs above in your first message.
3. **Verify environment:**
   ```bash
   node --version              # ≥ 18
   node --test tests/*.test.mjs # fail 0
   git status                  # branch + dirty state
   ls data.json data.public.js # at least one
   ```
4. **Inspect recent history:** `git log --oneline -10` and `git status --short`. If recent commits suggest a conflict with your task, surface to operator.
5. **Skill loadout self-check:** for the task you are about to take, name at least one specific catalog skill that covers it. If you cannot, use `/skill-development` (`.claude/skills/skill-development/SKILL.md`).
6. **Read Section A (Push & Commit Routine)** of `AGENT_ONBOARDING.md`. Acknowledge.
7. **Read Section B (Hard Constraints)** of `AGENT_ONBOARDING.md`. Acknowledge.
8. **Sign onboarding** with the line:
   ```
   ONBOARDED: <your-id> at <ISO-8601 timestamp> — gates 1–7 passed.
   ```

## Validation

- [ ] All 4 identity inputs are present in your first message
- [ ] Test suite shows `fail 0` (or you flagged the failures and got operator approval to proceed read-only)
- [ ] Git history was inspected — no untracked conflicts
- [ ] At least one catalog skill is named for the first chunk
- [ ] `ONBOARDED:` line is present and timestamped

## Examples

Good (signed and ready):

```
I'm Claude Opus 4.7 (1M context), taking the lead-architect role at
production tier on a repo-wide change. Tests: 158/158 pass. Git: clean
on main, ahead 0. First chunk uses /assemble-cli + /everything-claude-code:
plan.

ONBOARDED: claude-opus-4.7-1m at 2026-04-25T14:00:00Z — gates 1–7 passed.
```

Bad (skipped onboarding, started writing code):

```
Sure, I'll add that flag to assemble.mjs. Here's the patch:
[opens Edit tool]
```

The bad example would be rejected by the operator — no identification, no
environment verification, no signature. The agent would be asked to restart.

## Failure modes

- **Onboarding becomes a ritual without substance:** if you sign without
  actually running the verification commands, you have not onboarded. The
  signature is a load-bearing assertion; falsely signing is worse than
  skipping.
- **Onboarding bleeds into the task:** complete onboarding fully before
  starting Phase 0 of your KICKOFF. They are sequential, not interleaved.
- **Multiple agents share an onboarding signature:** each agent signs for
  itself. Subagents spawned by you must also onboard before they work.

## Provenance

This skill is the invocable form of `AGENT_ONBOARDING.md` at repo root.
The full spec is there; this skill is the procedural shortcut.
