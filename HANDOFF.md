# Handoff — skill-browser

You're picking up a working local tool that we want to turn into a sellable/OSS product. This document gets you from cold-start to productive in ~10 minutes. Read top to bottom before touching code.

## What this is

A local browser for Claude Code **skills and slash-commands** across every installed plugin plus user-level and project-level skills. ~500 items from ~35 sources in a unified catalog. Three modes:

- **Browse** — filter by type / scope / source / category + live search
- **Compose** — natural-language intent → ranked skill suggestions (local IDF + category inference, no API)
- **Recipes** — saved skill chains that turn into paste-ready multi-step prompts

A **basket** drawer lets you select multiple skills, reorder them, and copy as a numbered prompt that Claude Code runs in sequence.

Two CLIs complement the UI for agents:
- `query.mjs` — substring filter (name / description / category / source)
- `intent.mjs` — natural-language ranker with score and "why matched" hints

## Project location and stack

- **Path:** `~/.claude/ecc-browser/` (Windows: `C:\Users\robin\.claude\ecc-browser\`)
- **Stack:** Node 18+, vanilla JS, zero npm deps
- **License:** MIT, author Robin Westerlund

## Current state (v0.4.0, 2026-04-21)

- 24/24 tests green (`bash test.sh`, ~1s)
- `dist/skill-browser.html` — **360 KB single-file bundle**, double-clickable, no server, no network
- `landing.html` — public-facing marketing page
- OSS-ready: LICENSE (MIT), CHANGELOG, CONTRIBUTING, .gitignore, package.json, `.nojekyll` for GitHub Pages
- CI: `.github/workflows/test.yml` (Node 18/20/22 matrix + synthetic fixture + bundle verification)
- `PUBLISH_CHECKLIST.md` — pre-release verification

## File tour

```
~/.claude/ecc-browser/
├── build.mjs           # Scanner → data.json + data.js + recipes.js
├── bundle.mjs          # Inlines data+recipes into dist/skill-browser.html
├── query.mjs           # Substring filter CLI  → TSV/JSON
├── intent.mjs          # NL ranker CLI → text/TSV/JSON with scores
├── launch.sh           # Cross-platform opener: rebuild + open in browser
├── index.html          # Single-page UI: Browse / Compose / Recipes + basket
├── landing.html        # Marketing page
├── recipes.json        # 15 seed recipes
├── package.json        # v0.4.0, zero deps, Node ≥18, MIT
├── README.md / CHANGELOG / CONTRIBUTING / LICENSE / PUBLISH_CHECKLIST / MORNING_BRIEF / task_plan
├── HANDOFF.md          # This file
├── .gitignore / .nojekyll / .github/workflows/test.yml
├── tests/              # 24 node:test tests
├── test.sh             # Test runner
├── dist/               # Built single-file bundle (gitignored)
├── data.json/data.js   # Generated catalog (gitignored; contains user plugin paths)
└── recipes.js          # Generated from recipes.json (gitignored)
```

## Run it

```bash
cd ~/.claude/ecc-browser

node build.mjs              # scan plugins + user + (optional project)
bash launch.sh              # rebuild + open index.html in browser
bash test.sh                # run all 24 tests
node bundle.mjs             # → dist/skill-browser.html (360 KB self-contained)

node query.mjs "kotlin"
node intent.mjs "review my Python code for security"
node query.mjs --list-sources
```

## Architecture in one paragraph

`build.mjs` walks `~/.claude/plugins/cache/**/.claude-plugin/plugin.json` (reading `name` as namespace) + `~/.claude/skills/` + `~/.claude/commands/` + optional `--project <path>/.claude/{skills,commands}`. It parses YAML frontmatter, derives categories via prefix rules, and emits `data.json` (canonical), `data.js` (`window.__ECC_DATA__ = {...}` for `file://` use), and `recipes.js`. `index.html` loads the two `.js` files via `<script>`, renders three tabs, and persists basket + custom recipes + settings in `localStorage`. `bundle.mjs` inlines everything into one HTML. The CLIs read `data.json` directly.

## Vision

Robin's endgame: **buildr.nu** — a platform for composing LLM-driven workflows from modular skill references. This tool is the discovery + composition primitive. Next layers:

1. **LLM-assembled prompt chains** — user describes a goal → produce a multi-step prompt invoking skills in sequence. Basket + "Copy as prompt" already does a crude version; Haiku integration would sharpen it.
2. **Autonomous projects** — a basket is essentially an execution plan for a Claude session. Wiring "Run basket" to drive a live session closes the loop.
3. **Sellable** — MIT tool + hosted service. Free OSS, paid plans for team recipe sync / private indexes / cloud execution. Pricing TBD.

Inspiration: Robin's prior tool-hub builds at `~/Downloads/dr3mr/tool3r/` and `~/Downloads/llm_build/the_index/tools/` — Team Factory / Phase Launcher / Session Briefing / Blueprint Forge / Handoff Writer. Several concepts already seeded into recipes; the rest is a well for more.

## What's NOT built (honest gaps)

| Gap | Why deferred | Effort |
|---|---|---|
| Haiku intent re-ranking | API key + opt-in UX + cost handling | Half-day |
| Autonomous executor (run basket in live Claude session) | Non-trivial orchestration | Multi-day |
| Deploy to buildr.nu | Needs Robin's DNS + hosting | Depends on choice |
| Paywall / Stripe | Premature before traction | Day (when needed) |
| Screenshots / demo GIF | Needs visual review | Half-day |
| Team sync of recipes | Requires server + auth | Week+ |
| Brand/name finalization | Robin's call | UI sweep |
| Firefox/Safari manual test | Hasn't been touched | Hour |
| Catalog freshness on plugin update | Manual rebuild today; watcher would help | Half-day |

## Recommended next moves (ordered)

### 1 hour
1. Visual sweep + Firefox / Safari check. Fix obvious issues. UI only exercised in Chromium.
2. Fix one UX wart — basket drawer on small screens, scroll position when switching tabs, recipe ordering.

### Half day
3. **Haiku intent re-rank opt-in** — add "Use Claude for ranking (requires API key)" setting. On enable, Compose sends top-20 local candidates + intent to Haiku, re-ranks with explanation text. Local fallback when no key. Cache 20 most recent.
4. **Deploy landing + bundle to GitHub Pages** — push repo → Settings → Pages → root folder. Verify `/landing.html` + `/dist/skill-browser.html` serve. Gives Robin a shareable URL.
5. **More recipes from tool3r corpus** — fork Handoff Writer / Retrospective Builder / Constraint Mapper as recipe chains. Target 20-25 total.

### Full day
6. **Autonomous executor v1** — "Run basket" button invokes Claude API (subprocess or hosted) to execute each slug sequentially with handoffs. Highest leverage in the vision.
7. **Private/team skill index** — `build.mjs --extra <path>` for extra skill directories. UI source marker for "team" vs "plugin"/"user".
8. **Recipes marketplace** — JSON index hosted on GitHub Pages listing community recipes. Import from URL.

## Key decisions already made

| Decision | Why |
|---|---|
| Single-file HTML bundle | Max distributability; no server; localStorage state |
| Zero npm deps | No supply-chain risk; zero install friction |
| Local-only intent matcher by default | Cost, privacy, offline-first. Haiku opt-in later. |
| Slug namespacing = plugin `name` field | Matches Claude Code's own slash-command resolution |
| Latest plugin version by mtime | Works regardless of semver / sha / "unknown" |
| Basket + recipes in localStorage | Trivial, zero backend, survives refresh |
| Generated files gitignored | Contain user's local plugin paths |
| Dark default, light toggle | Matches Claude Code; supports marketing contexts |

## Working with Robin — observed preferences

- **Swedish-first**, English fine. Reads both.
- Prefers **pragmatic over perfect**. Concrete delivery beats meta-discussion.
- Values **honesty about mechanism limits** ("I can't run 5h unattended, but here's what I can do").
- Builds **at night**; asks agents to continue autonomously. `ScheduleWakeup` with `<<autonomous-loop-dynamic>>` is the pattern.
- **Brand:** buildr.nu. "Skill Browser" is working product name; he has "Buildr" in many other places (see `~/.claude/skills/buildr-*`).
- Mines inspiration from prior builds in `~/Downloads/`.
- Uses a **fact-forcing gate** (ECC `gateguard` skill). Every Edit/Write/Bash requires 4 facts up front: callers, duplicate check, data shape, verbatim instruction. Factor the latency in.

## How to start a new session

Open Claude Code with `~/.claude/ecc-browser/` as the working directory. First-turn prompts that work well:

- **Continue work:** "Read HANDOFF.md, then pick the highest-value item from recommended next moves and propose a plan."
- **Deploy:** "Read HANDOFF.md and PUBLISH_CHECKLIST.md. Walk me through deploying to GitHub Pages."
- **Vision:** "Read HANDOFF.md. Let's design the autonomous executor — smallest v1 that actually runs a basket."

The `ecc-menu` skill at `~/.claude/skills/ecc-menu/SKILL.md` teaches new agents to use `query.mjs` / `intent.mjs` so sub-agents can discover and invoke other skills.

## Troubleshooting

- **Tests fail at build.test.mjs** — run `node build.mjs` manually. Usually a missing plugin.json or path-assumption mismatch.
- **Bundle too small** — guard triggers in `bundle.mjs` when `data.js` wasn't generated. Rerun `build.mjs`.
- **UI loads blank** — devtools → check if `data.js`/`recipes.js` 404'd. Working-dir issue.
- **URL hash basket not loading** — format is `#basket=/slug1,/slug2` (comma-separated, URL-encoded slugs with leading `/`).
- **Category shows "Misc"** — `deriveCategory` in `build.mjs` lacks a rule for that name. Add a regex.

---

## Self-evaluation (advanced-evaluation applied, 2026-04-21)

Applying direct-scoring with 1-5 scale per criterion, evidence-first justification, one improvement per criterion, following Zheng et al. (2023) chain-of-thought pattern. **Bias disclosure:** I wrote the code, so self-enhancement bias is live — scores likely optimistic by 0.5-1 point. Treat these as a starting hypothesis, not ground truth. A second judge (human or different LLM) should re-evaluate before major decisions.

### Criteria and weights

| Criterion | Weight | Scale |
|---|---|---|
| Production readiness | 0.25 | 1-5 |
| Feature completeness vs. vision | 0.20 | 1-5 |
| Code quality and maintainability | 0.15 | 1-5 |
| UX polish (current tooling) | 0.15 | 1-5 |
| Test coverage + rigor | 0.10 | 1-5 |
| Documentation + onboarding | 0.10 | 1-5 |
| Distribution readiness (OSS) | 0.05 | 1-5 |

### Per-criterion direct scoring

**Production readiness · weight 0.25 · score 3.5 / 5**
- Evidence: v0.4.0 cut with CHANGELOG; 24 tests pass; bundle is self-contained and runs offline; .github/workflows/test.yml green; LICENSE + package.json in place
- Evidence against: Not deployed anywhere public; no error tracking/telemetry; no version-migration path for localStorage schema changes; `data.json` contains user-local paths (privacy risk if shared accidentally)
- Justification: Codebase is internally consistent and ships an artifact (dist/skill-browser.html) anyone can open, but "production" for a sellable tool also means live URL + support channel + monitoring — none of those exist yet.
- Improvement: Deploy to GitHub Pages this week to convert "theoretical distributable" into "actually distributed."

**Feature completeness vs. vision · weight 0.20 · score 3 / 5**
- Evidence: Browse + Compose + Recipes + basket + prompt generation = the core primitive exists; 15 recipes cover common workflows; URL-share works
- Evidence against: The vision's key differentiators (autonomous executor, LLM-assembled chains, team sync) are NOT built. We have discovery and composition; we don't have execution.
- Justification: We shipped v0.x of a discovery tool. v1.0-as-vision-defined means "push a basket, Claude runs it." That's multi-day work, and a plausible gate before paid plans.
- Improvement: Pick the minimal autonomous-executor experiment. Even a "copy this prompt, paste in Claude Code, watch" guided flow is a first step.

**Code quality and maintainability · weight 0.15 · score 4 / 5**
- Evidence: Zero npm deps; ESM throughout; small files (biggest is ~800 LOC index.html); clear separation between scanner/CLI/UI; no external state except localStorage; all public contracts exposed via data.json schema
- Evidence against: `index.html` is a single ~60KB file that mixes HTML/CSS/JS — would benefit from split when it grows past ~100KB; `deriveCategory` rules are an array of regexes (works but will drift); no error boundaries for catastrophic `data.json` corruption
- Justification: Clean, readable, consistent — new session can be productive inside an hour. Some ad-hoc patterns that'd need refactoring at 2x the LOC.
- Improvement: Extract Compose logic from index.html into `compose.js` when adding Haiku re-rank — that module will be the first to grow non-trivially.

**UX polish · weight 0.15 · score 3 / 5**
- Evidence: Keyboard shortcuts (/ B C R T ?); theme toggle; welcome overlay; help modal; empty-state with "Clear all filters"; share-link; export/import recipes
- Evidence against: Only tested in Chromium; mobile layout not verified; basket drawer ordering UI is ↑↓ buttons (no drag-drop); no undo for basket clear; toast position can overlap drawer on narrow screens
- Justification: Above "prototype" but not "polished consumer product." Missing the affordances power users expect (drag, undo, responsive).
- Improvement: 30-minute sweep: test Firefox + Safari, test mobile viewport, add "Undo" after basket clear.

**Test coverage · weight 0.10 · score 4 / 5**
- Evidence: 24 tests across build, query, intent, recipes, bundle; all use zero-dep `node:test`; CI runs on Node 18/20/22; bundle test asserts UI-primitive presence
- Evidence against: No end-to-end tests of the UI (clicking through tabs, verifying basket behavior) — I can't run Playwright autonomously easily; intent-scoring tests are basic (only 3 cases); no regression fixtures for edge-case catalog shapes
- Justification: Good smoke coverage that prevents the most common breakages. UI is effectively manually tested — fine for now, risky at 10k users.
- Improvement: Add 3-5 Playwright tests before the first marketing push (tab switching, basket copy-as-prompt, theme toggle persistence).

**Documentation · weight 0.10 · score 4.5 / 5**
- Evidence: README + CONTRIBUTING + CHANGELOG + PUBLISH_CHECKLIST + MORNING_BRIEF + task_plan + this HANDOFF; SKILL.md separately tells agents how to invoke; code is lightly commented where non-obvious
- Evidence against: No architecture diagram; no screenshots in README; no worked examples of extending (e.g., "add a new plugin type")
- Justification: Any competent engineer can read and ship inside an hour. Marketing-facing docs (what users see on landing) are lighter.
- Improvement: Add 2-3 screenshots to README and landing once UI is firefox-verified.

**Distribution readiness · weight 0.05 · score 4 / 5**
- Evidence: package.json with files whitelist; .gitignore protects local paths; .nojekyll for GH Pages; MIT; CHANGELOG Keep-a-Changelog
- Evidence against: No npm publish yet (bin points to bash script, which is imperfect for cross-platform); no GitHub release yet; no social share preview tags in landing.html
- Justification: Technically publishable. Hasn't been published.
- Improvement: Publish to npm (or switch bin to a Node-based entrypoint if bash becomes a constraint on Windows-only users).

### Aggregate

Weighted average: 3.5 × 0.25 + 3.0 × 0.20 + 4.0 × 0.15 + 3.0 × 0.15 + 4.0 × 0.10 + 4.5 × 0.10 + 4.0 × 0.05 = **3.52 / 5**

Reading: "working v0.x tool, discoverable, shippable; missing the moat (autonomous execution) and the polish (browser breadth, mobile, drag-drop). Good foundation to hand off."

### Confidence + position-consistency note

Not applicable to direct scoring. But I'd characterize confidence as: high on code quality / tests / docs (I can observe these directly); medium on UX (no mobile/Firefox data); low on "vs vision" (subjective, bias-heavy, depends on how Robin defines "done").

### Anti-patterns I've avoided (per advanced-evaluation skill)

- ✅ Evidence before score (chain-of-thought) on every criterion
- ✅ One criterion = one measurable aspect
- ✅ Weighted aggregate, not naive mean
- ✅ Disclosed self-enhancement bias

### Anti-patterns I'm still at risk of

- ⚠ Single-judge evaluation (me only) — mitigated by flagging it; real mitigation is "have Robin or a fresh agent re-score after reading HANDOFF"
- ⚠ Length bias — I've written long justifications; could be pattern-matching "more detail = higher score"
- ⚠ Authority bias in vision-score — hard to separate "what was actually built" from "what I described confidently"

### Recommended re-evaluation

Before major investment decisions (deploy, pricing, expansion), a fresh session should:

1. Re-score using the same rubric without reading this section first
2. Compare score-by-score with mine; flag any delta ≥1 point
3. Spot-check the biggest-delta criterion with direct testing

That's pairwise-without-position-swap, but good enough for a sanity check. If resources allow, a second LLM judge on the same rubric catches self-enhancement bias.

---

## Contact

Robin Westerlund · `analys@camjo.se`

Domain for the product: **buildr.nu** (not deployed yet — near-term task).
