# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`assemble.mjs` CLI** — headless equivalent of `assembler.html`. Takes `--goal "..."` and produces a ZIP package with KICKOFF.md / CLAUDE.md / README.md. Supports `--tier mvp|production|cutting-edge`, `--limit N`, `--auto` (skip interactive review), and `--ai` (Groq/OpenRouter causal rerank when `GROQ_API_KEY`/`OPENROUTER_API_KEY` is set). Registered as `skill-browser-assemble` npm bin.
- **Phase 0 Preflight Contract baked into KICKOFF** — every generated package now embeds a mandatory pre-work block with goal restate, skill-scan, skill-first fallback (only sanctioned route out of "no-fit"), Definition of Done, hard gates, and contract signature. Sources: `frameworks/COMPOUND.md` + `frameworks/QUALITY_GATE.md`.
- **Compound Mechanisms block in KICKOFF** — Gap Scan / Compound Register / Context Refresh visible-output triggers per Robin's COMPOUND-ORIGINAL overlay, attached to every chunk boundary.
- **Quality Gate block in KICKOFF** — cross-model adversarial review with 5 dimensions (correctness / architecture / cost-efficiency / maintainability / originality), tier-aware threshold.
- **Tier system** — `TIERS = ["mvp", "production", "cutting-edge"]` with distinct Quality Gate thresholds. Exposed in `kickoff-template.mjs` and selectable via `assemble.mjs --tier`.
- **`frameworks/` directory** — 7 imported reference frameworks (verbatim copies with provenance comments) + `FRAMEWORKS.md` index. Files: COMPOUND.md, QUALITY_GATE.md, SCENARIO_AUTHORING_STANDARD.md, FACTORY_OPERATING_MANUAL.md, THREAT_MODEL_TEACHING_TO_THE_TEST.md, SUBAGENTS.md, MEMORY_ARCHITECT.md. Grouped: Preflight & Compound · Holdout & Eval · Multi-agent runtime.
- **`FUTURE_WORK.md`** — explicit roadmap for deferred components (token budget tracker, Claude↔Codex handoff bridge, generalized N-persona debate, scenario factory wrappers, MVP-tier Quality Gate, subagent runtime in packages, chunk DAG designer, live eval loop replacing user asks). Each entry: status, why deferred, prerequisites, effort estimate, source-of-truth file.
- **Playground AI Suggest**: `playground.html` now has a `⚗️ AI Suggest` topbar button that accepts a goal description, runs the local IDF ranker for instant feedback, then silently upgrades to Groq/OpenRouter causal ranking when an API key is configured. Ranked skills are appended directly to the canvas.
- **Playground LLM Settings modal**: `⚙` button in playground topbar opens a provider/key editor. Reads/writes the shared `assembler-llm-config-v1` localStorage key — configure once in Assembler, Browser, or Playground and it works everywhere.
- **3 new seed recipes** in `recipes.json` (total 24 entries / 18 ready-made recipes + 6 package templates): `session-handoff`, `repo-strategy-constraints`, and `external-agent-handoff`.

### Changed
- `kickoff-template.mjs` now exports `buildKickoffWithPhase0`, `buildPhase0Block`, `buildCompoundBlock`, `buildQualityGateBlock`, and `TIERS`. Existing exports (`buildKickoff`, `buildClaudeMd`, `buildReadme`, `slugifyLabel`) unchanged — non-breaking.
- `package.json` `files[]` whitelist now ships `assemble.mjs`, `frameworks/`, and `FUTURE_WORK.md` for npm publish.

### Tests
- `tests/zip-builder.test.mjs` expanded from 2 → 7 tests: empty archive, unicode content, unicode filenames, CRC-32 determinism, and large-file (>64 KB) round-trip.
- `tests/e2e/playground.spec.js` expanded from 10 → 13 tests: AI Suggest local fallback, LLM Settings save/load roundtrip, and tier-indicator reflecting configured key. Desktop-only (skipped on mobile viewports where the topbar overflow is a known limitation).

## [0.8.0] - 2026-04-23

### Added
- **Assembler ranking tier 3 — AI causal ranking**: `rerankSelections()` is now async; after IDF + semantic tiers, upgrades to Groq/OpenRouter LLM ranking if API key configured. Shows local results immediately, then replaces with AI results. Confidence badges (high/medium/low) and italic causal-reason text on result cards.
- **Assembler Step 3 — AI Package Insights**: entering Step 3 with an API key configured triggers `buildPackageContextWithGroq()` (llama-3.3-70b-versatile). Renders: 2–3 sentence summary, risk list, first-moves checklist, estimated hours — in the summary sidebar. "↻ Re-analyze" button to regenerate after changing selections. Falls back silently offline.
- **Compose mode AI ranking** (`index.html`): `runIntent()` now async — shows local IDF results immediately, then upgrades to Groq ranking when API key is configured. Tier indicator strip (🏎 Local / ✨ AI) shows current ranking source.
- **Settings modal AI Ranking section** (`index.html`): provider select (Groq / OpenRouter), password-input for API key, save/clear buttons, active status indicator. Shared `assembler-llm-config-v1` key — one entry works in Compose mode and the Assembler.
- **`cli.mjs --ai` flag**: reads `GROQ_API_KEY` (or `OPENROUTER_API_KEY`) env var, uses `LLMClient.rankSkills()` for causal ranking. Prints AI reason in dim text below each result. `printTable()` gains `showWhy` option.
- **`intent.mjs --ai` flag**: same Groq upgrade for the intent CLI. Text output shows `[high/medium/low]` confidence and "reason:" label; TSV/JSON formats include `_confidence` field.
- **MCP server LLM upgrade**: `rank_skills_for_goal` checks `GROQ_API_KEY` env var; uses `LLMClient.rankSkills()` when set and falls back to local IDF on failure. `handleToolCall()` export unchanged.
- **`landing.html`**: Playground nav link; Workflow Playground feature bullet; CTA row with Assembler + Playground buttons.
- **`launch.mjs`**: cross-platform Node.js launcher replacing bash `launch.sh` as the npm `bin` entry for `skill-browser`.
- **`vercel.json`**: deployment config with clean-URL rewrites and security headers.
- **`tests/e2e/assembler.spec.js`** (10 Playwright specs) and **`tests/e2e/playground.spec.js`** (10 Playwright specs).
- **`data.public.js` + `recipes.public.js`**: committed sanitized catalog snapshots for GH Pages CI.

### Changed
- `index.html`, `playground.html` title and OG meta tags updated to **buildr.nu** brand.
- `package.json` `bin.skill-browser` updated from `./launch.sh` to `./launch.mjs`.
- `bundle.mjs`: `--skip-build` flag; falls back to `data.public.js`/`recipes.public.js` when local files absent.
- `.github/workflows/pages.yml`: uses `node bundle.mjs --skip-build`.
- `.gitignore`: un-ignores `data.public.js` and `recipes.public.js`.
- `assembler.html` Step 1: 6 quick-start template cards (SaaS MVP, CLI Tool, REST API, Claude Agent, Data Pipeline, Flutter App).
- `assembler.html`: draft persistence (`assembler-draft-v1` localStorage).
- `build.mjs`: `--workflows <path>` flag for Archon workflow scanning.
- `tests/bundle.test.mjs`: uses `--skip-build` to avoid duplicate build runs.

## [0.7.0] - 2026-04-23

### Added
- **MCP server** (`mcp-server.mjs`): zero-dep stdio JSON-RPC 2.0 server with 5 tools — `search_skills`, `rank_skills_for_goal`, `get_skill`, `assemble_package`, `list_sources`. Installable via `~/.claude/mcp.json`. Exports `handleToolCall` + `listTools` for unit testing.
- **CLI** (`cli.mjs`): terminal interface — `--goal`, `--search`, `--get`, `--sources`, `--type`, `--limit`, `--json`, `--data` flags; formatted table + JSON output. Registered as `skill-browser-cli` bin.
- **`llm-client.mjs`**: provider-agnostic LLM wrapper with `OfflineProvider` (IDF fallback) and `GroqProvider` (llama3-8b for ranking, llama-3.3-70b for context). Causal rank-skills system prompt; typed 401/429/network errors. API key never in error messages.
- **Assembler LLM settings modal**: `⚙ AI` button in assembler topbar; provider select (Groq/OpenRouter), password input, test/clear/save. Stored in `localStorage` key `assembler-llm-config-v1`.
- **Three ranking tiers in assembler Step 2**: `🏎 Local` (IDF, always active), `🧠 Semantic` (cosine centroid when embeddings present), `✨ AI` (Groq, opt-in).
- **Semantic embeddings** (`build.mjs --embeddings`): runs `@xenova/transformers` all-MiniLM-L6-v2 at build time, writes `data.embeddings.json` + appends `window.SKILL_EMBEDDINGS` to `data.js`. Browser uses centroid of IDF top-5 to re-rank semantically. Graceful degradation if package not installed.
- **`build.mjs --sanitize`**: strips absolute paths, normalises sources to `plugin:X` / `user` / `project`, removes `filePath` field. Enables hosted deployment.
- **6 package templates** in `recipes.json` with `packageTemplate: true` and `estimatedHours`: `pkg-saas-mvp` (40h), `pkg-cli-tool` (16h), `pkg-api-service` (24h), `pkg-ai-agent` (20h), `pkg-data-pipeline` (28h), `pkg-mobile-app` (48h). Each has `steps[]`.
- **`zip-builder.mjs`**: standalone STORE-mode ZIP encoder extracted from assembler; used by MCP server for `assemble_package`.
- **GitHub Pages CI** (`.github/workflows/pages.yml`): push to `main` → `node bundle.mjs` → deploy to `robwestz.github.io/SkiLLBuilDr/`.
- `tests/llm-client.test.mjs`: 18 tests (mock fetch, edge cases, security invariant).
- `tests/mcp-server.test.mjs`: 10 tests with synthetic catalog — no `data.json` required.
- `tests/zip-builder.test.mjs`: 2 tests for ZIP encode/decode round-trip.
- `tests/build.test.mjs`: 4 new `--sanitize` tests + 1 `--embeddings` graceful-error test.

### Changed
- `package.json` `0.6.0` → `0.7.0`; `files` and `bin` updated; `devDependencies` adds `@xenova/transformers ^2.17.2`.
- `bundle.mjs` inlines `data.embeddings.json` as `window.SKILL_EMBEDDINGS` in assembler bundle when file exists.
- `landing.html` updated: eight feature cards including three ranking tiers and MCP/CLI.
- `recipes.json` grows from 15 → 21 entries (6 new package templates).

## [0.6.0] - 2026-04-23

### Added
- **Package Assembler** (`assembler.html`): 4-step wizard — Describe → Select → Review → Download. Local IDF skill scoring, profile detection (cli/saas/data/general), generates `KICKOFF.md`, `CLAUDE.md`, `README.md`, and `workflows/<name>.yaml`. ZIP download packages all 4 files in one click (pure-JS STORE-mode, zero npm deps).
- **Playground** (`playground.html`): 3-panel workflow builder — catalog search, drag-reorder canvas, live preview with Prompt/YAML/Recipe/CLAUDE.md export tabs. Saves to localStorage; exports Archon-compatible YAML with `depends_on` chains.
- **Workflow item type**: 5th catalog type (alongside skill/command/agent/rule). Scanned from `.archon/workflows/*.yaml`. Orange badge `#ff8c69`, toggle in Browse, visible in bundle cards.
- Assembler 📦 nav link in Browse tab row next to Playground ⚗️; full cross-navigation triangle: Browser ↔ Playground ↔ Assembler.
- `bundle.mjs` now produces `dist/assembler.html` (data.js inlined) alongside the existing skill-browser and playground bundles.
- `kickoff-template.mjs`: profile-aware `buildKickoff`, `buildClaudeMd`, `buildReadme` — deliverables, success criteria, first moves, execution plan per package type.
- `analytics.js` IIFE: GDPR-first opt-in PostHog analytics. No network calls until explicit consent. Events: `app.opened`, `tab.switched`, `filter.changed`, `basket.action`, `deeplink.arrived`.
- Settings panel (⚙ header icon): Appearance / Analytics opt-in / Data. Welcome modal now prompts for analytics consent on first visit (`docs/privacy.md` documents the full data contract).
- `tests/analytics.test.mjs`: 13 tests covering enabled/disabled state, event shapes, opt-in/out round-trips.
- CSP `<meta>` in `index.html`: external connections restricted to PostHog EU endpoints.
- Skill detail panel: click any catalog row → right slide-in with full `SKILL.md` body rendered as Markdown. "Copy slug" + "+ Basket" buttons; closes on `Esc` or overlay click.
- `build.mjs` extracts `body` field (full Markdown below frontmatter) for every skill/command; bundle grows to ~5 MB with all bodies inlined.
- Built-in Markdown renderer (zero external deps): headings, bold/italic, fenced code, inline code, lists, blockquotes, tables, links, HR.
- Playwright e2e suite (`tests/e2e/`): 30 smoke specs across `catalog`, `tabs`, `basket`, `theme`, `deeplink`, `search` — Chromium, Firefox, mobile Chrome 360/414, tablet 768 px.
- GitHub Actions `e2e` job in `test.yml`; uploads report artifact on failure.
- Responsive CSS hardening: `touch-action: manipulation` eliminates 300 ms tap delay; sidebar collapsed ≤ 480 px; basket touch targets ≥ 44 px.
- Deep-link hash router (`hash-router.js`): 8 combinable URL-hash keys — `basket`, `q`, `type`, `scope`, `source`, `category`, `item`, `tab`. Unknown keys preserved on round-trip.
- `🔗 Copy filter URL` in search bar; "Copy share link" in basket drawer includes filter state. Browser back/forward navigates filter states.
- 33 router unit tests (`tests/router.test.mjs`); `tests/bundle.test.mjs` asserts hash-router is inlined.
- Professional GitHub setup: `CODEOWNERS` (`@robwestz` required on all PRs), PR checklist template, `lint-commits.yml` (Conventional Commits enforced on PRs), `commitlint.config.cjs`.
- **GitHub Pages** (`pages.yml`): push to `main` → `node bundle.mjs` → deploy to `https://robwestz.github.io/SkiLLBuilDr/` via `actions/deploy-pages@v4`.

### Changed
- `bundle.mjs` inlines `analytics.js` + `hash-router.js` alongside `data.js` / `recipes.js`; all three dist outputs are fully self-contained.
- `package.json` version 0.5.0 → 0.6.0; `files` whitelist updated to include all new modules.
- `index.html` basket URL parsing centralised in `applyHashStateFromUrl()` (removed ad-hoc `loadBasket` hash parsing).

## [0.4.0] - 2026-04-21

### Added
- Additional category rules in `build.mjs` (Misc reduced from 69 → 0 items; added Context and Debug categories; finer-grained Agents/Planning/DevOps/AI Ops buckets).
- 7 new seed recipes in `recipes.json` (total 15): team-factory, session-start, product-blueprint, debug-loop, posthog-setup, frontend-foundations, ship-commit-pr.
- `PUBLISH_CHECKLIST.md` — manual pre-release verification steps.
- `.nojekyll` file for serving landing + dist from GitHub Pages without Jekyll interference.
- Source-alias display shortening in UI (e.g. `plugin:everything-claude-code` → `ecc`) with full id on hover.
- Smarter empty states: "Clear all filters" button appears when filters hide all results.
- README section for GitHub Pages hosting.

## [0.3.0] - 2026-04-21

### Added
- Compose mode powered by the intent-matcher for turning free-text goals into skill picks.
- Recipes tab seeded with 8 curated skill chains.
- Basket with prompt generation for exporting a composed selection.
- localStorage persistence for basket and UI state across reloads.
- Theme toggle (dark/light) with `T` shortcut and persisted setting.
- Welcome overlay on first open.
- Help modal (`?`) showing keyboard shortcuts.
- Export/import of custom recipes as JSON.
- Share-via-URL: `#basket=slug1,slug2` loads a basket on page load; "Copy share link" button in basket.
- Single-file distribution: `node bundle.mjs` produces `dist/skill-browser.html` (~360KB, double-clickable, no server).
- Landing page (`landing.html`) for public-facing intro.
- OSS hygiene: `LICENSE` (MIT), `CHANGELOG.md`, `CONTRIBUTING.md`, `.gitignore`, `package.json`.
- Test suite: 19 tests in `tests/` + `test.sh` runner, covering build, query, intent, and recipes.
- GitHub Actions CI workflow at `.github/workflows/test.yml`.

## [0.2.0] - 2026-04-21

### Changed
- Expanded scope from ECC-only to all installed plugins plus user-level skills (30+ sources).

### Added
- `scope` and `source` facets for filtering the unified catalog.

## [0.1.0] - 2026-04-21

### Added
- Initial HTML UI with filter and clipboard copy for ECC skills.
