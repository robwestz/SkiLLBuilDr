# PROTOCOL — Compound Agent Activation Contract

> **Activation marker.** The presence of this file in a repo means the Compound Protocol
> is active for every agent (Claude, Codex, ralph, sub-agents, humans-with-an-LLM).
> No exceptions, no opt-out.
>
> If you are an agent and you are reading this for the first time in a session,
> you have one job before any other work: complete the activation checklist below.

---

## Activation checklist (per session, ~2 minutes)

1. Read this file (`PROTOCOL.md`) — you are doing this now.
2. Read [`COMPOUND.md`](./COMPOUND.md) — the 3-mechanism overlay (REGISTER / GAP SCAN / CONTEXT REFRESH).
3. Read [`SKILL_SELECT.md`](./SKILL_SELECT.md) — how to pick or create the right skill for this task.
4. Read [`DOD.md`](./DOD.md) — how to define and actively verify Definition of Done.
5. Run `node .agents/task.mjs status` — know the current open task before doing anything.
6. Sign in to the ledger:
   ```bash
   node .agents/task.mjs ack <your-agent-id>
   ```
   This records that an agent of identity `<id>` is now active in this session.

You may not Edit, Write, or non-trivial Bash before step 6 is done. Read-only inspection
(`Read`, `Grep`, `Glob`) is allowed during onboarding.

---

## The protocol in one paragraph

Every unit of work in this repo is a **task** with an **id**, a **goal**, and a
**Definition of Done**. Tasks live in `.agents/TASKS.json`. A task is not done
until its DoD is **actively verified** (not self-asserted). You may not start a
new task while another is `in_progress` without first parking it with a reason.
Skills are selected per task — if no existing skill fits, you create a new one
per the standard before continuing. The 3 Compound mechanisms run at task
boundaries. Hooks enforce the gates that humans forget.

---

## The four hard rules

### 1. No work without a task
Before any Edit/Write/non-trivial Bash, you must either:
- Be working on a current `in_progress` task (`task status` shows it), OR
- Be answering a pure Q&A prompt (no code changes, no commits, no tool side-effects)

If neither, run `node .agents/task.mjs open "<goal>" --dod "<check>"` first.
Q&A that turns into work mid-conversation: stop, open the task, then continue.

### 2. No task-switching without parking
If a task is `in_progress` and a new prompt asks for unrelated work:
- Surface to the user: "Task `<id>` is in progress. Park it?"
- On approval: `node .agents/task.mjs park <id> "<reason>"` then open the new task
- Never silent-drop. Parked tasks stay in the ledger and resurface at session start.

### 3. No "done" without active verification
A task transitions to `done` only via `node .agents/task.mjs done <id>`, which:
- Runs every DoD `check: test` command and refuses if any fail
- For `check: manual` items, requires the user to confirm by prompt
- For `check: artifact` items, requires the named artifact to exist
- Records `passed_at` timestamp for each check
Self-asserted "I'm done" without running the verification = protocol violation.

### 4. No block without unlock-path
Every gate that blocks (test fail, lint fail, scenario fail, DoD missing) must
present a concrete `unlock_command`. If the block message doesn't tell you how
to unblock, that is a protocol bug — surface it to the user before working
around it. Never `--no-verify` your way past a gate.

---

## What the hooks enforce

After running `node .agents/activate.mjs` once per repo, the following are
machine-enforced (not just instruction-followed):

| Trigger | Hook | What it checks |
|---|---|---|
| SessionStart | inject task status | Shows current task + N open tasks at session start |
| UserPromptSubmit | continuity gate | Surfaces task-switch prompts; refuses silent drops |
| PreToolUse:Edit/Write | task-required gate | Refuses edit if no `in_progress` task |
| PreToolUse:Bash (commit) | DoD gate | Refuses `git commit` if current task has unverified DoD |
| Stop | checkpoint | Writes `updated_at` + last-message-summary to current task |

Hooks are installed by `node .agents/activate.mjs`. The activation is **idempotent**
(safe to run multiple times) and writes to `.claude/settings.json` `hooks` section.

---

## Plan-document activation markers

Plan documents (`task_plan.md`, `PLAN.md`, etc.) can declare protocol-aware metadata
that the harness reads to pre-populate `TASKS.json`:

### Frontmatter form

```yaml
---
compound: active
phases:
  - id: phase-3
    goal: "Build E2E suite for browser tests"
    dod:
      - check: test
        command: "npx playwright test"
      - check: manual
        description: "5 specs exist in tests/e2e/"
    skills: ["e2e-testing", "playwright"]
---
```

### Inline form (in prose-style plans)

```
[COMPOUND-PHASE id=phase-3 goal="Build E2E suite" dod="npx playwright test;5 e2e specs" skills="e2e-testing"]
```

Run `node .agents/task.mjs import <plan-file>` to read markers and populate
the ledger. Existing tasks are not duplicated (matched by `id`).

See [`PLAN_MARKERS.md`](./PLAN_MARKERS.md) for full spec.

---

## Portability

This `.agents/` folder is designed to be **copied into any repo**. It has zero
runtime dependencies (Node ≥ 18 only). To bring the protocol to a new project:

```bash
cp -r .agents/ /path/to/new-repo/
cd /path/to/new-repo
node .agents/activate.mjs
```

That's it. The hooks install themselves into `.claude/settings.json`, the
TASKS.json initializes empty, and the contract is live.

---

## Failure modes

- **Agent ignores PROTOCOL.md** → Hook on UserPromptSubmit shows task status; agent learns within 1-2 prompts.
- **Hook gets in the way of legitimate Q&A** → Q&A doesn't trigger Edit/Write hooks; only side-effect tools are gated.
- **DoD gets gamed (fake `passed_at`)** → `task verify` re-runs commands and overwrites `passed_at`. Don't hand-edit TASKS.json.
- **Task ledger gets stale** → SessionStart hook surfaces stale tasks (no update in N days). Operator decides park/abandon.
- **Plan markers drift from reality** → `task import --diff` shows diffs between plan and ledger; operator reconciles.

---

## Identity declarations (current ledger)

| Agent ID | Notes |
|---|---|
| `claude-opus-4.7` | Primary builder for ECC-browser repo |
| `codex-gpt-5-codex` | Parallel builder; works on independent chunks |
| `human-robin` | Operator; final authority on direction and DoD signoff |

Add new identities to this table when a new agent class enters the repo.

---

*Protocol v1.0 — 2026-04-27. Activated when this file is present and `node .agents/activate.mjs` has been run at least once.*
