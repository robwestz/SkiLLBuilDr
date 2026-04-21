# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
