# SKILL_SELECT — Skill Selection Contract

> Every task uses **one or more named skills**. If no existing skill fits the task,
> you create a new skill per the standard before doing the work. No "I'll just write it ad-hoc."

---

## When this contract fires

At task creation (`task open "<goal>"`), the harness asks you to declare skills.
You may also re-declare during `task verify` if you discover the wrong skill was selected.

---

## The selection algorithm

### Step 1: Search the local + plugin skill index

```bash
# Local user skills + project skills
ls ~/.claude/skills/ .claude/skills/ .agents/skills/ 2>/dev/null

# Plugin skills (catalog)
node query.mjs --list-skills | grep -i "<keyword>"

# Or, if the project has the ECC-browser catalog:
node query.mjs --search "<keyword>" --type skill
```

### Step 2: Match against task goal

For each candidate skill, ask:
1. Does the skill's **trigger description** match the task's goal? (semantic match)
2. Does the skill's **scope** cover the task's deliverable? (coverage match)
3. Has the skill been **used in this repo before**? (prior validation)

### Step 3: Decide

| Match quality | Action |
|---|---|
| `perfect-fit` — one skill clearly covers the task | Declare skill at task open: `task open "<goal>" --skill <id>` |
| `partial` — skill covers some aspects, not all | Declare partial skill + open sub-task to cover the gap |
| `miss` — no existing skill fits | **Stop. Create a new skill before continuing.** See below. |

### Step 4 (only for `miss`): Create new skill per standard

Run the skill-development flow:

```bash
claude /skill-development
# OR
claude /agent-onboarding   # then jump to Gate 5 → skill-development
```

The new skill must:
- Have a name, trigger description, and content (per `SKILL.md` convention)
- Live in `.agents/skills/<name>/SKILL.md` for project-scope OR `~/.claude/skills/<name>/`
  for user-scope (operator decides)
- Be registered in the local catalog (`build.mjs` rebuild) so future searches find it
- Be declared on the originating task: `task update <id> --skill <new-name>`

You may not proceed past skill-creation back to the original task until the new
skill is created, registered, and declared. This is the only sanctioned escape
from "no fitting skill exists."

---

## Why this exists

Without a forced selection step, agents default to "I'll just write it" which means:
- No reusable artifact for next time the same task appears
- No accumulated knowledge in the skill catalog
- Drift toward ad-hoc patterns that don't compound

With a forced selection, every task either reinforces an existing skill or
**generates a new one as a byproduct**. The skill catalog grows monotonically.
That is the compound effect.

---

## Multiple skills per task

A task may declare multiple skills if it spans capabilities:

```bash
task open "Build E2E suite" --skill e2e-testing --skill playwright --skill tdd-workflow
```

The harness records all of them. Compound Register at task close mentions which
skills were actually exercised.

---

## When to skip skill-select

Tasks with `state: q-and-a` (pure question-answer, no code change, no tool side
effects) skip skill selection. Everything else, including planning, documenting,
and reviewing, requires at least one declared skill — even if the skill is
generic like `documentation-lookup` or `planner`.

If a task is created without a skill and tries to do work, the PreToolUse:Edit
hook will refuse. Recovery: `task update <id> --skill <id>`.

---

## Failure modes

- **Skill chosen too broadly** ("I'll use `general-purpose`") → useless for compound; treat as `miss` and force-create a project-specific skill.
- **Skill chosen but not actually used** → Compound Register at task close should call this out. Honest "GAINED: nothing" is better than fake.
- **New skill created but not registered** → `build.mjs` rebuild step is part of the standard; verify with `node query.mjs --search <new-name>`.
- **Skill catalog has duplicates** → `skill-comply` / `skill-stocktake` skills in the ECC catalog can audit. Run periodically.

---

*Skill-select v1.0 — 2026-04-27.*
