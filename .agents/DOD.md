# DOD — Definition of Done Contract

> A task is **not done** until its DoD is actively verified. Self-assertion ("I think
> it's done") is not verification. Verification means a check ran, produced expected
> output, and the timestamp is recorded.

---

## The three check types

### `check: test`
A command that exits 0 on pass, non-zero on fail.

```yaml
- check: test
  command: "node --test tests/foo.test.mjs"
```

Verified by: `task verify <id>` runs the command. Records exit code + stdout
tail in the ledger. `passed_at` only set when exit code is 0.

### `check: artifact`
A file or directory that must exist (and optionally match a content regex).

```yaml
- check: artifact
  path: "dist/skill-browser.html"
  min_bytes: 100000          # optional
  contains: "buildr.nu"      # optional substring or regex
```

Verified by: `task verify <id>` checks `existsSync(path)` and conditions. Records
file size + checksum in the ledger.

### `check: manual`
A statement the user must confirm. Used for things only the user can verify
(visual UX, real-world behavior, external system state).

```yaml
- check: manual
  description: "Browser opens and shows 537 items in the list"
```

Verified by: `task verify <id>` prompts user for `y/n` confirmation. `passed_at`
records who confirmed and when.

---

## DoD must be defined at task open

```bash
task open "Add E2E test for basket flow" \
  --dod "test:npx playwright test tests/e2e/basket.spec.js" \
  --dod "artifact:tests/e2e/basket.spec.js" \
  --dod "manual:Basket survives reload"
```

Or via plan-document marker (see `PLAN_MARKERS.md`).

A task with **zero DoD checks** cannot be opened. The harness refuses with:
```
ERROR: task open requires at least one --dod. Did you mean a Q&A task? Use --qa.
```

---

## DoD verification flow

```
$ task verify t-007
[1/3] check: test ........................ ✓ exit 0
       node --test tests/e2e/basket.spec.js
       3 tests passed (2.4s)
[2/3] check: artifact .................... ✓ 18,432 bytes
       tests/e2e/basket.spec.js
[3/3] check: manual ...................... ?
       Basket survives reload
       Confirmed by user? [y/n]: y

All checks passed. Task t-007 ready for `task done`.
```

```
$ task done t-007
✓ All DoD checks have passed_at timestamps.
Task t-007 → done. Compound register prompt:
[COMPOUND]
BUILT: ?
GAINED: ?
ENABLES: ?
REUSABLE: ?
LEARNED: ?
```

The harness asks for the COMPOUND block before closing. The block is appended
to `.agents/COMPOUND_LOG.md` (machine-readable history) and the task is marked
done.

---

## DoD cannot be skipped

```
$ task done t-007
ERROR: 1 of 3 DoD checks have not passed:
  - check: test (last run: 2 hours ago, exit 1)

Re-run: task verify t-007
Or update DoD: task update t-007 --remove-dod 0  (requires reason)
```

Removing a DoD requires `--reason "<text>"`. The reason is logged. This is the
only way to close a task with an unmet DoD — and it's noisy on purpose.

---

## DoD inheritance from skills

Some skills have **default DoD checks** declared in their `SKILL.md` frontmatter:

```yaml
# .agents/skills/e2e-testing/SKILL.md
---
name: e2e-testing
default_dod:
  - check: test
    command: "npx playwright test"
---
```

When a task declares `--skill e2e-testing`, the harness offers to copy the
default DoD into the task. Operator confirms or edits.

---

## Why this exists

Self-reported "done" is the #1 source of work that comes back. The pattern:
1. Agent finishes coding, reports "done"
2. Operator merges or moves on
3. Days later, edge case surfaces — was never tested
4. Real cost: rebuild context, re-investigate, re-fix

Active verification at close-time eliminates this class. The cost is ~30 seconds
of extra commands per task. The savings are ~hours per regression caught.

---

## Failure modes

- **DoD too easy** ("test:echo ok") → Caught by Compound Register's GAINED/ENABLES specificity rules. Honest critique at close.
- **DoD changed mid-task to make it pass** → `task update --remove-dod` requires `--reason`; reasons are logged and grep:able.
- **`check: manual` rubber-stamped by user** → Operator's responsibility. Harness logs who confirmed.
- **`check: test` flaky** → Rerun on `task verify`. If still flaky, that's a separate task: "Stabilize flaky test X."

---

*DoD v1.0 — 2026-04-27.*
