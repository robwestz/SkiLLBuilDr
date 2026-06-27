# session-kickoff-orchestrator (Skill #1)

The first skill built with Skill #0 (`metacognitive-skill-architect`). It runs a
deterministic, dependency-free ritual at the start of a session and emits a
**Session Intent Card** so each session starts from better priors than the last.

## Why this exists

Sessions used to start blind: drift (e.g. a `package.json`/`package-lock.json`
mismatch that breaks `npm ci`), a dirty tree, stale `revisit_required`
assumptions, and unfinished tasks were only discovered later, by accident. This
skill front-loads that state into one card.

## Run it

```bash
# print a Session Intent Card for the current repo
node .claude/skills/session-kickoff-orchestrator/scripts/kickoff.mjs

# also persist it under .agents/kickoffs/ (feeds the next session's card)
node .claude/skills/session-kickoff-orchestrator/scripts/kickoff.mjs --write
```

Exit code is always 0 when it can run: health problems are reported *in* the
card, not as a failure, so the kickoff never blocks a session from starting.

## What v1 does (and does not)

- **Does:** lockfile-drift detection, dirty-tree check, branch ahead/behind,
  contract presence, open-task and `revisit_required` load, previous-card link.
- **Does not (deferred to v2):** any model call / multi-model "council". v1 is
  fully deterministic and offline.

## Tests

```bash
node --test .claude/skills/session-kickoff-orchestrator/tests/*.test.mjs
```

## Dogfood lineage

Built under Skill #0's AIC gate; every file here has a card in
`artifact_intent_cards.yaml`, and the package passes
`metacognitive-skill-architect/scripts/validate_skill_package.mjs` (G1–G7).
