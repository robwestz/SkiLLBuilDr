# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `analytics.js` IIFE module (same pattern as `hash-router.js`): GDPR-first opt-in PostHog analytics. Disabled by default — no network calls until explicit consent. Events: `app.opened`, `tab.switched`, `filter.changed`, `basket.action`, `deeplink.arrived`. Set `POSTHOG_KEY` in `index.html` to your PostHog project key to activate.
- Settings panel (⚙ gear icon in header): Appearance (theme toggle), Analytics (opt-in toggle), Data (clear all stored data).
- Welcome modal now includes analytics consent ("Got it · Share data" / "Skip analytics") so first-visit users can choose without hunting for settings.
- `docs/privacy.md`: full accounting of what is and isn't collected, storage mechanism, and opt-out instructions.
- `tests/analytics.test.mjs`: 13 tests covering enabled/disabled state, event shape, `$lib` injection, opt-in/out round-trips, and props immutability.
- CSP `<meta>` tag in `index.html`: restricts external connections to PostHog EU endpoints; blocks object embeds and unlisted sources.
- `bundle.mjs` now inlines `analytics.js`; bundle grows ~9 KB to 382 KB.
- Skill detail panel: clicking any catalog row opens a right slide-in panel with the full `SKILL.md` / command file body rendered as Markdown. Panel has "Copy slug" and "+ Basket" buttons; closes on `Esc` or clicking the overlay. Works from Browse and Compose tabs.
- `build.mjs` now extracts the Markdown body (everything below the YAML frontmatter) from each skill/command file and includes it as a `body` field on every catalog item; bundle grows from 382 KB → ~5 MB (all 574 item bodies inlined).
- Basic Markdown renderer built into `index.html` (no external deps): headings, bold/italic, fenced code blocks, inline code, lists, blockquotes, tables, links, HR.
- Playwright e2e test suite (`tests/e2e/`): 30 smoke specs across 6 files — `catalog`, `tabs`, `basket`, `theme`, `deeplink`, `search` — verified on Chromium, Firefox, mobile Chrome 360 / 414, and tablet 768 px viewports.
- `playwright.config.js`: 5 browser projects locally (chromium, firefox, mobile-chrome-360, mobile-chrome-414, tablet-768); WebKit added automatically in CI (Linux only).
- `tests/e2e/_setup.mjs`: global setup that rebuilds `dist/skill-browser.html` before specs run.
- `tests/e2e/_helpers.mjs`: shared `gotoApp` helper that suppresses the welcome overlay and waits for data to load regardless of which tab is active.
- GitHub Actions `e2e` job in `.github/workflows/test.yml`: runs after unit tests on `ubuntu-latest` with all three Playwright browser engines; uploads report artifact on failure.
- `package.json` script `"e2e": "playwright test"` and `@playwright/test` devDependency.
- Responsive CSS hardening: `touch-action: manipulation` on all interactive elements eliminates the 300 ms double-tap-zoom delay; keyboard-shortcut hints hidden on screens ≤ 480 px; browse sidebar collapsed at ≤ 480 px; basket buttons enlarged to meet 44 px minimum touch target on mobile.
- Deep-link hash router (`hash-router.js`): 8 combinable URL-hash keys — `basket`, `q`, `type`, `scope`, `source`, `category`, `item`, `tab` — so agents and humans can share or link to a specific view. Unknown keys are preserved on round-trip for forward compatibility.
- `🔗 Copy filter URL` button in the search bar (appears when any filter or non-default tab is active); copies the current view without the basket.
- `Copy share link` in the basket drawer now includes the current filter state as well as the basket, so shared links reproduce both view and selection.
- Browser back/forward navigates between filter states via `history.pushState` + `popstate`.
- 33 router unit tests (`tests/router.test.mjs`) covering all 8 keys, combinations, URL-encoding round-trips, unknown-key preservation, and backward-compat with the old `#basket=` format.
- `tests/bundle.test.mjs` asserts the single-file bundle inlines the hash-router.

### Changed
- `bundle.mjs` now inlines `hash-router.js` alongside `data.js` and `recipes.js`; the bundle is still self-contained (no external `<script src=>` references) and grows from ~360 KB → ~372 KB.
- `package.json` `files` whitelist includes `hash-router.js`.
- `index.html` `loadBasket()` no longer parses the URL hash; all hash handling is centralized in `applyHashStateFromUrl()`.

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
