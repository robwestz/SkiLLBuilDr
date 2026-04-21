# Sonnet Handoff — Autonomous execution plan

**From:** Opus 4.7 (1M context), 2026-04-21 evening
**To:** Sonnet 4.6 (one or more sessions) while Robin waits for token reset
**Project:** SkillBuildR / ecc-browser (`C:\Users\robin\.claude\ecc-browser`)
**Mindset:** Robin's durable rule → **every phase ships production-grade code, no MVPs.** See `memory/feedback_ambition_production_grade.md`. If a part can't meet live-quality in the current PR's scope, gate it out and flag it — don't ship half-done.

You (Sonnet) are capable of executing this plan autonomously. Opus already finished Fas 0 v1 PR 1. You pick up with PR 2.

---

## Session-zero protocol (do at the start of every session)

1. **Read** in order:
    - `HANDOFF.md` — original project context
    - `memory/MEMORY.md` + every file it indexes
    - `task_plan.md` — Manus-style plan with phase history
    - **This file** — for the active plan and progress tracker
    - `CHANGELOG.md` `## [Unreleased]` section
2. **Verify green:** `bash test.sh` passes.
3. **Identify next PR** from the progress tracker at the bottom of this file.
4. **Follow `/writing-plans`**: deliver a concrete plan for the chosen PR before coding. If Robin is offline and the PR is clearly within approved scope, proceed; otherwise, deposit the plan in this file under the PR's entry and wait.
5. **Respect gateguard.** Every Edit/Write/Bash needs the four facts up front. Factor this latency into pacing — plan two related edits at once so you only quote facts once per operation type.

---

## Rules of engagement (non-negotiable)

- Never `git push --force`, `reset --hard`, `checkout --`, `--no-verify`, or `rm -rf` unless Robin explicitly approves.
- Never commit the gitignored generated files: `data.json`, `data.js`, `recipes.js`, `dist/`, `node_modules/`.
- Never publish to npm, never tag a release, never push to a remote without Robin's OK.
- Tests must pass before a commit. If a test fails, fix the root cause — never `.skip()`.
- If gateguard blocks you twice on the same operation, STOP and leave a note for Robin. Don't brute-force.
- If you discover scope beyond this plan, STOP and append a new PR entry below — don't silently expand.
- If Robin asks "are you sure", assume skepticism is warranted. Re-verify.

## The Fact-Forcing Gate — pattern you'll use constantly

Every Edit/Write/Bash triggers a gate asking for four facts:
1. List ALL files that import/require this file (use Grep)
2. List the public functions/classes affected by this change
3. If this file reads/writes data files, show field names, structure, date format (synthetic values only)
4. Quote Robin's current instruction verbatim

For new files (Write), the questions are: callers, duplicate check via Glob, data shape, verbatim instruction. For Bash, just the verbatim quote. **Present facts, then immediately retry the operation in the same turn.** The gate remembers nothing between turns — each operation needs its own facts fresh.

---

## Modus operandi — compose skills, don't reinvent

Use the ecc-browser itself to surface the right skills/commands per task:

```bash
node query.mjs --category Security --type skill
node intent.mjs "review a Playwright test for flakiness" --limit 5
node intent.mjs "instrument PostHog product analytics" --limit 5
```

Pick skills by **intent**, not by name-memory. The ranker's top-3 is almost always right. When uncertain, `/ecc-menu` is the meta-skill that documents the tool for agents.

Release grind — run all of these before marking any PR "done":

1. `/everything-claude-code:verification-loop` — tests + build verified
2. `/critique` — UX check if the PR touched UI
3. `/raise-the-bar` — "would a premium buyer accept this without excuses?"
4. `/everything-claude-code:security-review` — if the PR touched keys, network, or user input
5. `/polish` — alignment, spacing, typography if UI-touching

Each fas-release (not just PR) additionally needs `/advanced-evaluation` re-score by a **fresh session** (ask Robin to run this; don't self-score).

---

## Phase plan

Phases are ordered. Do not parallelize across phases. Within a PR, waves marked ∥ run in parallel (fire multiple Agent subagents in a single message).

---

### Fas 0 v1 — Public launch surface

**Goal:** From "theoretically distributable" to "live URL with premium polish, cross-browser verified, observable, brand-neutral".

#### PR 2 — Cross-browser hardening + Playwright smoke suite (~4h)

**Goal:** Verified behavior in Chromium, Firefox, WebKit (Safari engine), and mobile viewports 360 / 414 / 768 px. Automated so CI catches regressions.

**Skills to compose** (verify via `node intent.mjs "e2e playwright browser test" --limit 6`):
- `/everything-claude-code:e2e-testing` — Playwright POM patterns
- `/everything-claude-code:browser-qa` — visual testing
- `e2e-runner` subagent — can generate + maintain journeys
- `/critique` — visual hierarchy review
- `/polish` — final pass

**Waves:**
- **∥ Wave A:** Add `@playwright/test` devDep. Create `playwright.config.js` with `chromium`, `firefox`, `webkit` projects + `devices` imports for mobile. Add `playwright` gitignore. Scaffold `tests/e2e/` with `skill-browser.spec.js` that loads `dist/skill-browser.html` via `file://` and asserts catalog loads.
- **∥ Wave B:** Write 5 smoke specs — `tabs.spec.js` (switch Browse/Compose/Recipes), `basket.spec.js` (add/remove/reorder/copy-as-prompt), `theme.spec.js` (toggle persists across reload), `deeplink.spec.js` (`#category=Security` filters correctly; `#item=...` scrolls + selects), `search.spec.js` (query filters + Copy filter URL button appears).
- **∥ Wave C:** `/critique` agent on mobile viewport screenshots (use Playwright's `screenshot` to capture 360 / 414 / 768 × 640). Fix P0 issues same PR: basket drawer stacking, toast position, header wrap, source sidebar collapse on narrow screens.

**Deliverables:**
- `playwright.config.js`
- `tests/e2e/*.spec.js` (5+ files)
- `package.json` devDep + `"e2e": "playwright test"` script
- `.github/workflows/test.yml` Playwright job (separate from unit tests; Linux matrix for webkit)
- CSS fixes for responsive issues found
- CHANGELOG `[Unreleased]` entry

**Grind:** tests green + `bash test.sh` + `node bundle.mjs` + verification-loop + critique sign-off.

**Check-in:** If any P0 bug can't be fixed same-PR, open an entry here with repro and defer. Don't ship a known bug.

---

#### PR 3 — Observability (~3h)

**Goal:** PostHog product analytics + error tracking wired into both `index.html` and `landing.html`. GDPR-respectful: no cookies, no PII, opt-out toggle prominent.

**Skills** (`node intent.mjs "posthog instrument analytics errors" --limit 6`):
- `/posthog:instrument-product-analytics`
- `/posthog:instrument-error-tracking`
- `/posthog:instrument-integration`
- `security-reviewer` subagent after wiring

**Waves:**
- **Wave A:** Settings panel in `index.html` (behind gear icon in header). Sections: Analytics (toggle), Theme (already exists — migrate), Reset (clear localStorage). LocalStorage key `skillbrowser.settings.v1.analyticsOptIn` defaults to `null` (not set) — first visit asks politely.
- **Wave B:** `analytics.js` module (same `new Function(win,mod)` pattern as `hash-router.js`). Lazy-loads PostHog script only when opt-in is true. Events: `app.opened` (referrer, viewport), `filter.changed` (facet, value), `basket.action` (op, count), `tab.switched` (from, to), `deeplink.arrived` (keys), `error.occurred` (message, stack if available).
- **Wave C:** Same for `landing.html` — page-view + CTA clicks.
- **Wave D:** `security-reviewer` agent — no secret PostHog keys committed (use only the public project key; document in CONTRIBUTING that Robin must set it via build flag). CSP `<meta>` tag allowing only `*.posthog.com`.

**Deliverables:**
- `analytics.js` + wiring in both HTML files
- Settings panel UI
- Privacy note + opt-out flow
- `docs/privacy.md` — what's collected, what isn't
- Tests: `tests/analytics.test.mjs` — verifies opt-out blocks all network calls, event shape validated
- CHANGELOG entry

**Grind:** verification-loop + security-review signed off + `/critique` on Settings UX.

**Check-in:** Event names and opt-out UX should be reviewed by Robin before merge. If unavailable, default to "analytics off" and let Robin flip when he returns.

---

#### PR 4 — Catalog freshness + auto-rebuild (~2h)

**Goal:** Users never see stale catalog. Visual indicator of age. Auto-rebuild triggered when plugins newer than data.

**Skills** (`node intent.mjs "mtime file freshness detect" --limit 5`):
- `/everything-claude-code:terminal-ops`
- `/everything-claude-code:content-hash-cache-pattern` (conceptually: data.json is cache)

**Deliverables:**
- `launch.sh`: portable mtime check against `~/.claude/plugins/cache/**/plugin.json`. If any plugin.json newer than `data.json` → `node build.mjs` before opening.
- Footer text in `index.html`: "Catalog built 2h ago" with tooltip showing exact ISO timestamp. Color cue: green <24h, amber 24–72h, red >72h.
- Manual rebuild button in Settings panel (from PR 3).
- Test: `tests/freshness.test.mjs` — build a fixture dir with old+new mtimes, run freshness check, assert correct branch.
- CHANGELOG entry.

**Grind:** tests + verification-loop. No UI grind needed beyond the footer visual.

---

#### PR 5 — Launch surface polish (~3h)

**Goal:** Landing + app look premium. OG/Twitter cards with real preview image. Brand-neutral (not buildr.nu yet — that's Fas 3). CSP + referrer-policy meta tags.

**Skills** (`node intent.mjs "frontend design polish branding meta" --limit 8`):
- `/everything-claude-code:frontend-design`
- `/everything-claude-code:brand-voice`
- `/critique`
- `/polish`
- `/everything-claude-code:seo`

**Waves:**
- **∥ Wave A:** OG + Twitter meta tags in both `landing.html` and `index.html`. Preview image 1200×630 — use `/everything-claude-code:frontend-design` to produce an SVG then export PNG via browser or `sharp` if we add a one-time dev dep (prefer zero-dep). Store as `assets/og-preview.png`.
- **∥ Wave B:** `/everything-claude-code:brand-voice` ingests current landing.html copy + README → produces refined copy v2. Keep same section structure. `/critique` review before commit.
- **∥ Wave C:** `/polish` pass on both landing + app — alignment, spacing, typography, color contrast (WCAG AA minimum). Fix any findings.
- **∥ Wave D:** Security headers via `<meta>`: CSP, referrer-policy `no-referrer-when-downgrade`, X-Frame-Options equivalent. Document in `PUBLISH_CHECKLIST.md`.

**Deliverables:**
- `assets/og-preview.png` (or SVG fallback)
- Updated meta tags in both HTML files
- Landing copy v2
- CSS polish
- `PUBLISH_CHECKLIST.md` updates
- CHANGELOG entry

**Grind:** verification-loop + critique + polish + raise-the-bar on *full* Fas 0 v1 output (not just PR 5).

---

#### Fas 0 v1 release grind (REQUIRES Robin)

1. All PR 1–5 merged and green.
2. Ask Robin to run `/advanced-evaluation` re-score in a fresh session without reading HANDOFF first.
3. Compare score-by-score with the 3.52/5 from HANDOFF — flag any delta ≥1 point.
4. Bump `package.json` to `0.5.0`; move `[Unreleased]` → `## [0.5.0] - YYYY-MM-DD`.
5. Robin creates git tag + pushes + enables GH Pages.
6. Smoke: open `https://robwestz.github.io/SkiLLBuilDr/landing.html` and `.../dist/skill-browser.html` — verify both load, deep-links work, theme persists.
7. Update `HANDOFF.md` "Current state" → v0.5.0.

---

### Fas 1 v1 — LLM in the loop (BYOK Haiku re-rank)

**Goal:** Compose gets Claude Haiku-assisted re-ranking as opt-in. Local ranker stays as fallback. Proves BYOK pattern before Fas 2 inherits it.

---

#### Fas 1 PR 0 — Extract `compose.js` (~1.5h)

Prep work. Compose logic grows non-trivially in PR 2; extracting first keeps the diff reviewable.

**Skills:**
- `/simplify` — for the extraction itself
- Same `(function attach(root){ ... })(…)` IIFE pattern as `hash-router.js`

**Deliverables:**
- `compose.js` with `tokenize`, `scoreIntent`, `STOPWORDS`, `EXAMPLES`, etc.
- `index.html` loads via `<script src="compose.js">` + bundle.mjs inlines it
- Tests already exist for `intent.mjs`; add `tests/compose.test.mjs` that loads `compose.js` via the same `new Function(win,mod)` pattern as router tests.
- No behavior change — unit tests ensure identical output.

**Grind:** tests green on identical ranking output. No user-facing change.

---

#### Fas 1 PR 1 — Settings panel + API-key storage (~2h)

**Skills:**
- `/claude-api` — primary reference for Anthropic SDK patterns
- `/everything-claude-code:claude-api`
- `/everything-claude-code:security-review` (mandatory after this PR)

**Deliverables:**
- Settings panel extension (builds on PR 3 panel): section "Claude API (optional)" with key input (type=password, never logs), opt-in toggle, link to `https://console.anthropic.com/settings/keys`.
- LocalStorage key: `skillbrowser.settings.v1.anthropicKey`.
- Warning copy: "Stored only in your browser. Sent directly to api.anthropic.com. Never leaves your machine via our code."
- Validation: verify key format on save (sk-ant-… prefix).
- Tests: settings persist; key input masked; clear-all-settings option wipes it.

**Grind:** verification-loop + **security-review is mandatory** — key handling, CSP, no logs.

---

#### Fas 1 PR 2 — Haiku re-rank module (~3h)

**Skills:**
- `/claude-api`
- `/everything-claude-code:content-hash-cache-pattern` — SHA-256 cache key
- `/everything-claude-code:cost-aware-llm-pipeline`
- `/everything-claude-code:agent-harness-construction` — prompt engineering
- `/everything-claude-code:eval-harness` — mandatory before merge

**Architecture:** Local ranker still runs first → top-20 local candidates + user query → single Haiku call → reordered list with one-sentence "why this ranks where" per top 5. Local ranker is fallback on any error.

**Prompt design:** System prompt enumerates candidate format (slug, name, category, description). User message is the query. Output JSON: `[{slug, rank, reason}]`. Use prompt caching on the system prompt for cost (cache hit rate should be ≥90% within a session). Claude model: `claude-haiku-4-5-20251001`.

**Deliverables:**
- `haiku-rerank.js` (IIFE pattern, testable)
- UI: spinner during rerank, "Ranked by Claude Haiku" footer tag on Compose results, fallback toast on error
- Cache: last 20 queries (SHA-256 of normalized query) with 15-min TTL
- Cost telemetry: opt-in "show estimated cost" in Settings → shows total tokens + $ estimate
- Eval doc `docs/eval/haiku-rerank.md`: 20 queries, local vs Haiku top-10 overlap + NDCG@10
- Tests: `tests/rerank.test.mjs` (mocked fetch)

**Grind:** verification-loop + **security-review** + **eval-harness** delta doc + cost review. All three mandatory.

**Check-in (MANDATORY):** Robin reviews (1) security-review output, (2) eval delta doc, (3) cost model. Don't merge without sign-off.

---

#### Fas 1 v1 release grind

Same shape as Fas 0 v1 release grind. Bump to `0.6.0`.

---

### Fas 1.5 v1 — Full-text bodies (STOP FOR OPUS ARCH CHECK-IN)

Sonnet should **not start this fas autonomously.** There are real architecture trade-offs:

- Separate `bodies.json` (lazy-fetched on first expand) vs inline in `data.js`?
- Compression strategy (gzip base64 inline, brotli via service worker, or unchanged)?
- Bodies search: separate sök-ruta or merged into existing search with a toggle?
- Cache invalidation on plugin update — integrate with Fas 0 PR 4 freshness?
- Bundle size impact — when to split bundle into main + bodies?

Sonnet: if you reach this fas, **pause and leave a note**. Either:
- Continue to polish Fas 0 / Fas 1 (retests on other browsers, accessibility audit, more recipes),
- Or stop and wait for Opus.

Don't start scanning bodies without the architecture signed off.

---

## Progress tracker (Sonnet: update this file at end of every session)

| PR | Status | Session | Notes |
|---|---|---|---|
| Fas 0 v1 PR 1 — Deep-link routing | ✅ DONE | 2026-04-21 Opus | 58/58 tests; bundle 371.9 KB; `hash-router.js` + 33 router tests |
| Fas 0 v1 PR 2 — Cross-browser + Playwright | ✅ DONE | 2026-04-21 Sonnet | 150 e2e tests (5 projects × 30 specs); responsive CSS fixes; `touch-action: manipulation`; CI Playwright job |
| Fas 0 v1 PR 3 — Observability (PostHog) | ✅ DONE | 2026-04-21 Sonnet | analytics.js opt-in; Settings panel; welcome consent; 13 tests; CSP meta; docs/privacy.md — **Robin: set POSTHOG_KEY before activating** |
| Fas 0 v1 PR 4 — Catalog freshness | | | mtime check + footer indicator |
| Fas 0 v1 PR 5 — Launch polish | | | OG/Twitter + brand-voice + polish |
| Fas 0 v1 RELEASE GRIND | | | v0.5.0 tag, GH Pages live |
| Fas 1 v1 PR 0 — Extract compose.js | | | No behavior change |
| Fas 1 v1 PR 1 — Settings + BYOK | | | security-review mandatory |
| Fas 1 v1 PR 2 — Haiku re-rank | | | eval-harness + cost review mandatory |
| Fas 1 v1 RELEASE GRIND | | | v0.6.0 tag |
| Fas 1.5 v1 — Full-text bodies | 🛑 STOP | | Needs Opus arch check-in |

## When to escalate to Opus

- Any architecture decision with ≥2 viable options (always ask)
- Security-review finding that isn't trivial to fix
- Eval delta (Haiku vs local) shows regression > 10%
- User explicitly asks for strategic input
- Check-in marks in the plan above
- Anything that smells like "this is important but I'm not sure" — ask

---

## Appendix: Quick skill lookup cheat-sheet

| I need to... | Try first |
|---|---|
| Plan a PR | `/writing-plans` |
| Extract patterns from session | `/everything-claude-code:learn-eval` |
| Find a skill by intent | `node intent.mjs "..."` |
| Find a skill by substring | `node query.mjs "..."` |
| Design a UI component | `/everything-claude-code:frontend-design` |
| Critique UX | `/critique` |
| Final polish pass | `/polish` |
| Instrument analytics | `/posthog:instrument-product-analytics` |
| Track errors | `/posthog:instrument-error-tracking` |
| E2E test | `/everything-claude-code:e2e-testing` |
| Browser QA | `/everything-claude-code:browser-qa` |
| Claude API code | `/claude-api` |
| Security review | `/everything-claude-code:security-review` |
| Ship with verification | `/everything-claude-code:verification-loop` |
| Raise quality before release | `/raise-the-bar` |
| Cache expensive results | `/everything-claude-code:content-hash-cache-pattern` |
| Evaluate with rubric | `/advanced-evaluation` |
| Commit properly | `/everything-claude-code:prp-commit` |

Remember: these slugs are verifiable via `node query.mjs <name>` before using.
