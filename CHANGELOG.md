# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`launch.mjs`**: cross-platform Node.js launcher replacing bash `launch.sh` as the npm `bin` entry for `skill-browser`. Works on Windows, macOS, Linux without a bash environment.
- **`vercel.json`**: deployment config with clean-URL rewrites (`/assembler`, `/playground`, `/landing`) and security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- **`tests/e2e/assembler.spec.js`**: 10 Playwright specs for the 4-step Package Assembler wizard — load, goal→step2 transition, skill card selection, review, download, reset, and LLM settings modal.
- **`tests/e2e/playground.spec.js`**: 10 Playwright specs for the Skill Playground — catalog search, canvas add, item name display, Prompt/YAML/CLAUDE.md export tabs, save modal, clear canvas (with confirm dialog), empty-save toast.
- **5 additional `intent.mjs` tests** (total 8): stopwords-only query exits 1, `--limit 1` returns one line, `--format json` returns valid array with `_score`/`slug` fields, `--type skill` filter, non-ASCII input safety.
- **`data.public.js` + `recipes.public.js`**: committed sanitized catalog snapshots (744 items, 37 sources, no absolute paths) used by GH Pages CI. Regenerate: `node build.mjs --sanitize && cp data.js data.public.js && cp recipes.js recipes.public.js`.

### Changed
- `index.html`, `playground.html` title and OG meta tags updated to **buildr.nu** brand.
- `package.json` `bin.skill-browser` updated from `./launch.sh` to `./launch.mjs`; `launch.mjs` added to `files` whitelist.
- `bundle.mjs`: `--skip-build` flag skips `build.mjs` child-process; falls back to `data.public.js`/`recipes.public.js` when local files absent — enables CI deployment without plugins installed.
- `.github/workflows/pages.yml`: uses `node bundle.mjs --skip-build` so the deployed site always has real catalog data.
- `.gitignore`: un-ignores `data.public.js` and `recipes.public.js` via `!` negation rules.
- `assembler.html` Step 1: 6 quick-start template cards (SaaS MVP, CLI Tool, REST API, Claude Agent, Data Pipeline, Flutter App) — pre-fill goal, packageName, and pre-select catalog items matching the template's skill slugs.
- `assembler.html`: draft persistence — goal/description/packageName saved to `localStorage` key `assembler-draft-v1` on every `updateDraft()` call; restored on page load; cleared by Reset.
- `build.mjs`: `--workflows <path>` flag — scans `<path>/.archon/workflows/*.yaml` for Archon workflows. `--project` now also auto-detects `<projectPath>/.archon/workflows/`. 2 new tests.

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
