# Skill Browser

A local, offline browser for Claude Code skills and slash-commands — across every installed plugin, global user skills, and the current project's `.claude/`. Four modes (Browse / Compose / Recipes / Assembler), a basket drawer that turns selected skills into a paste-ready prompt, a Package Assembler that emits downloadable workspaces, and an agent-facing CLI.

**Scope:** ~500 items from ~35 sources (ECC, PostHog, data/astronomer, compound-engineering, superpowers, figma, supabase, pinecone, vercel, github, …) plus your own `~/.claude/skills` and `~/.claude/commands`.

[![Live demo](https://img.shields.io/badge/live%20demo-GitHub%20Pages-orange)](https://robwestz.github.io/SkiLLBuilDr/)

## Four modes

- **Browse** — filter by type/scope/source/category + live search. Click to copy slug.
- **Compose** — describe a goal in plain language, get ranked skill suggestions with "why this matched" hints. Pure local IDF + category inference, no API calls.
- **Recipes** — 15 ready-made chains (code review, PRD→plan→implement, onboard repo, security audit, E2E setup, team-factory, session-start, product-blueprint, debug-loop, posthog-setup, frontend-foundations, ship-commit-pr, …). Save your own baskets as custom recipes. Export/import as JSON.
- **Assembler** — describe a build, review the selected skills, and generate a local package with `KICKOFF.md`, `CLAUDE.md`, `README.md`, workflow YAML, and ZIP export.

The **basket** (bottom drawer, toggle with `B`) lets you select multiple skills, reorder them, and generate a numbered multi-step prompt ready to paste into Claude Code. Share a basket via URL: `#basket=/slug1,/slug2`.

## Launch

```bash
bash ~/.claude/ecc-browser/launch.sh
```

Rebuilds the manifest from installed plugins (includes project-level `.claude/` if invoked from a project dir) and opens in the default browser. First launch shows a welcome overlay; dismiss with *Got it*.

Suggested alias:

```bash
alias ecc='bash ~/.claude/ecc-browser/launch.sh'
```

## Keyboard

- `/` focus search  ·  `B` toggle basket  ·  `C` Compose  ·  `R` Recipes
- `T` toggle theme (dark ↔ light)  ·  `?` help  ·  `Esc` clear/close
- `Ctrl/⌘+Enter` run Compose  ·  `↑`/`↓` navigate

## Deep-linking — share a view or point an agent at it

Every filter, tab, and item is addressable via URL hash. Combinable (AND semantics). Safe to share, safe to paste into an agent prompt.

| Key | Values | Example |
|---|---|---|
| `basket` | comma-separated URL-encoded slugs | `#basket=%2Fa%2C%2Fb` |
| `q` | URL-encoded search string | `#q=review%20python` |
| `type` | `skill`, `command`, `all` | `#type=skill` |
| `scope` | `plugin`, `user`, `project` | `#scope=plugin` |
| `source` | URL-encoded source id | `#source=plugin%3Aposthog` |
| `category` | URL-encoded category name | `#category=Security` |
| `item` | URL-encoded slug (scrolls to + selects the row) | `#item=%2Fplugin%3Aposthog%3Adashboards` |
| `tab` | `browse`, `compose`, `recipes` | `#tab=recipes` |

Combine freely: `…/index.html#category=Security&type=skill&scope=plugin` lands an agent straight on the skills under Security. Browser back/forward reverts earlier filter states; **🔗 Copy filter URL** in the search bar copies the current view (without basket); **Copy share link** in the basket drawer copies view + basket together. Unknown keys are preserved on round-trip for forward compatibility.

## CLI — for agents and humans

Three CLI tools. `query.mjs` for substring filter; `intent.mjs` for natural-language ranking; `cli.mjs` for goal-based assembly with formatted table or JSON output.

```bash
# Substring filter
node ~/.claude/ecc-browser/query.mjs kotlin testing
node ~/.claude/ecc-browser/query.mjs --type command --source plugin:posthog
node ~/.claude/ecc-browser/query.mjs --category Security --format json
node ~/.claude/ecc-browser/query.mjs --list-sources

# Natural-language intent matcher
node ~/.claude/ecc-browser/intent.mjs "review my Python code for security"
node ~/.claude/ecc-browser/intent.mjs "review Python code" --ai        # GROQ_API_KEY required
node ~/.claude/ecc-browser/intent.mjs "onboard an unfamiliar repo" --limit 5
node ~/.claude/ecc-browser/intent.mjs "set up analytics" --format json

# skill-browser-cli (registered npm bin)
node ~/.claude/ecc-browser/cli.mjs --goal "build a SaaS with auth and billing" --limit 15
node ~/.claude/ecc-browser/cli.mjs --goal "review Python for security" --ai    # GROQ_API_KEY required
node ~/.claude/ecc-browser/cli.mjs --search "python review" --type skill
node ~/.claude/ecc-browser/cli.mjs --get /everything-claude-code:python-reviewer
node ~/.claude/ecc-browser/cli.mjs --sources --json
```

`query.mjs` outputs TSV. `intent.mjs` outputs ranked results with scores and match reasons; supports `--format json|tsv`. `cli.mjs` wraps the MCP server handlers and supports `--json` for machine-readable output. The `--ai` flag on `--goal` uses Groq AI causal ranking (reads `GROQ_API_KEY` or `OPENROUTER_API_KEY` env var).

See `~/.claude/skills/ecc-menu/SKILL.md` for agent-facing docs on when to use which tool.

## MCP server

Install in `~/.claude/mcp.json` to expose the catalog to any MCP-compatible client (including Claude Code):

```json
{
  "mcpServers": {
    "skill-browser": {
      "command": "node",
      "args": ["/absolute/path/to/.claude/ecc-browser/mcp-server.mjs"]
    }
  }
}
```

Five tools: `search_skills`, `rank_skills_for_goal`, `get_skill`, `assemble_package`, `list_sources`. Zero npm deps — pure Node.js stdio JSON-RPC 2.0.

## Files

- `build.mjs` — scanner; walks `~/.claude/plugins/cache/**` + user/project `.claude/`; flags: `--project`, `--workflows`, `--sanitize`, `--embeddings`
- `bundle.mjs` — produces `dist/{skill-browser,assembler,playground}.html` (self-contained, double-clickable); flag: `--skip-build`
- `index.html` — single-page UI (Browse / Compose / Recipes + basket)
- `assembler.html` — Package Assembler wizard: 6 quick-start template cards, three ranking tiers, draft persistence, ZIP download
- `playground.html` — 3-panel workflow builder with YAML/Prompt/CLAUDE.md export
- `mcp-server.mjs` — stdio JSON-RPC 2.0 MCP server (5 tools); installable via `~/.claude/mcp.json`
- `cli.mjs` — `skill-browser-cli` npm bin; `--goal`, `--search`, `--get`, `--sources`, `--json`; `--ai` uses Groq causal ranking (`GROQ_API_KEY`)
- `llm-client.mjs` — provider-agnostic LLM wrapper (`OfflineProvider` IDF fallback + `GroqProvider`)
- `query.mjs` — substring filter CLI
- `intent.mjs` — natural-language intent ranker (IDF + category-boost)
- `kickoff-template.mjs` — generates `KICKOFF.md`, `CLAUDE.md`, `README.md` per package profile
- `zip-builder.mjs` — pure-JS STORE-mode ZIP encoder (used by assembler + MCP server)
- `hash-router.js` — deep-link hash parsing/building module
- `launch.mjs` — cross-platform Node.js opener (npm bin entry for `skill-browser`)
- `launch.sh` — bash launcher (kept for direct shell use)
- `analytics.js` — GDPR-first opt-in PostHog analytics IIFE
- `recipes.json` — 21 entries (15 recipes + 6 package templates with `packageTemplate: true`)
- `data.public.js` / `recipes.public.js` — committed sanitized snapshots for GH Pages CI
- `landing.html` — public-facing marketing page
- `vercel.json` — clean-URL rewrites + security headers for buildr.nu / Vercel deploy
- `tests/` — 141 `node:test` unit tests + 30 Playwright E2E specs (catalog/tabs/basket/theme/deeplink/search/assembler/playground)
- `package.json`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.gitignore` — OSS hygiene

## Distribute

```bash
node bundle.mjs
# → dist/skill-browser.html  (single file, ~360KB, no deps, double-clickable)
```

Send this file to anyone with a browser. All state persists in localStorage.

### Host on GitHub Pages

```bash
# Push `main`.
# In GitHub repo settings: Pages → Build and deployment → Source = GitHub Actions.
# The included `.github/workflows/pages.yml` deploys:
#   /              -> bundled app (`dist/skill-browser.html` copied to site root)
#   /landing.html  -> marketing/intro page
#   /assembler.html and /playground.html -> bundled companion tools
```

For this repo, the live URLs are:

- App: `https://robwestz.github.io/SkiLLBuilDr/`
- Landing: `https://robwestz.github.io/SkiLLBuilDr/landing.html`
- Assembler: `https://robwestz.github.io/SkiLLBuilDr/assembler.html`

## Rebuilding

`launch.sh` rebuilds on every open. Manual:

```bash
node build.mjs                # global sources (plugins + ~/.claude/{skills,commands})
node build.mjs --verbose      # log all discovered sources
node build.mjs --project /p   # include project's .claude/{skills,commands}
node bundle.mjs               # rebuild + produce dist/ single-file
bash test.sh                  # run the test suite
```

## Architecture notes

- Zero runtime deps. Pure Node + vanilla JS. No bundler needed.
- File-based, offline. No server required. Clipboard via Web Clipboard API (fallback to `execCommand`).
- Basket, custom recipes, and settings (theme, welcome-seen) persist in `localStorage` under `skillbrowser.*.v1`.
- Plugin discovery via `.claude-plugin/plugin.json` → `name` field (matches the actual slash-command namespace).
- Latest version per plugin picked by mtime.
- Compose-mode ranking mirrors `intent.mjs` exactly (both use the same IDF + category-boost algorithm).

## Vision (not built yet)

- LLM-assisted intent matching (Haiku opt-in) for abstract goals
- Autonomous executor — push a basket into a live Claude session and run it in sequence
- Export packaged recipes to team shares (today: localStorage + JSON export/import)
- buildr.nu marketing + hosted landing

## License

MIT — see `LICENSE`. Author: Robin Westerlund `<analys@camjo.se>`.
