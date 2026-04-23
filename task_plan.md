# Task Plan: ECC Browser — HTML-UI för everything-claude-code

## Goal
Ge en snabb, sökbar, kategoriserad GUI-entry-point till ECC:s 183 skills + 79 commands utan att behöva scrolla `/`-listan i Claude Code. En lokal HTML-app med live-sök, kategori-filter och klick-för-att-kopiera slug till clipboard.

## Current Phase
Phase 5: Package Assembler - Wave 3 in progress (2026-04-23)

## Wave 2 result (2026-04-21 ~05:00)
- [x] Category overhaul: Misc 69 → 0 (`build.mjs` expanded deriveCategory with prp/multi/context/loop/blueprint/AI Ops/ECC-meta rules)
- [x] 7 new seed recipes (total 15): team-factory, session-start, product-blueprint, debug-loop, posthog-setup, frontend-foundations, ship-commit-pr
- [x] PUBLISH_CHECKLIST.md — code-quality + privacy + files + version-bump + post-release
- [x] CHANGELOG — Unreleased section with wave 2 items + backfilled 0.3.0 with theme/welcome/help/export-import/URL-share/bundle/landing/OSS/tests/CI
- [x] ralphinho-rfc-pipeline added to Agents category
- [x] Tests still 19/19 green after all changes
- [x] Bundle regenerated (360 KB, 536 items, 15 recipes)

## Phase 4 scope (autonom, user sover ~5h)
Mål: paketera tool för sälj/OSS-release. Inte deployment (kräver user-DNS); inte betalflöde (prematurt). Scope:

**Wave 1 (parallell, nu) — COMPLETE:**
- [x] WS-A: `bundle.mjs` → `dist/skill-browser.html` (357KB single-file, 536 items)
- [x] WS-B: `tests/` — 19 tests, 0 fail, ~500ms. `test.sh` runner.
- [x] WS-C: OSS hygiene — LICENSE, CHANGELOG (0.1→0.3), CONTRIBUTING, .gitignore, package.json (name: skill-browser, v0.3.0)
- [x] WS-D: `landing.html` (30KB light-theme marketing page with hero/features/CLI preview/buildr footer)

**Wave 1 (main, sekvensiellt) — COMPLETE:**
- [x] Theme toggle (dark/light, `T` key, localStorage-persisted)
- [x] Export/import recipes som JSON (buttons in Recipes tab)
- [x] URL-share: `#basket=slug1,slug2` loads basket at start + "Copy share link" button
- [x] Welcome-overlay första gången (dismissed → welcomeSeen persisted)
- [x] Help modal (`?` key) with shortcuts + basket tips
- [x] Source aliasing (plugin:everything-claude-code → "ecc", osv., via hover-title för full id)
- [x] Bättre deriveCategory — Compound 54, PostHog 28, Planning 24, Review 10 (tidigare var de i Misc)

**Wave 2 (scheduled wakeup) — planerat:**
- GitHub Actions CI workflow (.github/workflows/test.yml)
- Settings panel (source include/exclude, project path input)
- Favorites/pinned in sidebar
- Better empty states + error boundaries
- Rensa fler Misc-items (återstående 69 st)
- `publish-checklist.md` — manuell pre-release kontroll för OSS
- Screenshots / GIF-demo skiss (user slutmontering)

**Wave 3 (mest värdefullt efter du vaknat, kräver dig):**
- Deploy buildr.nu (DNS + hosting)
- Haiku-integration opt-in (API key management)
- Autonomous executor (push basket → live Claude session)
- Figma-design för landing (du har redan en feel, men skala upp)

## Overnight Scope (autonom, user sover)
Tagen från tool3r-inspirationen: "select → generate → copy"-mönster, nu mappat på vår 537-skill-katalog. Det här är bygget mot buildr.nu-visionen om LLM-assemblerade prompts med skill-referenser.

Mål: tre tabs i browsern — **Browse** (existing), **Compose** (intent → förslag → basket → prompt), **Recipes** (spara/återanvänd kedjor).

Beslut jag tar åt användaren:
- Ingen Haiku-integration ikväll. Lokal ranker räcker för v1 (billigare, snabbare, offline).
- Basket persisterar i localStorage.
- Recipes seedas med ~6 vanliga kedjor, användaren kan spara egna via "Save as recipe".
- Ingen rebrand mot buildr.nu — fokus på funktion. Branding när han vaknat.

## Phases

### Phase 1: Build v1 — statisk HTML med embedded data
**Mål:** Dubbelklick på `index.html` → browser öppnas → sök/filtrera 262 items → klick på rad kopierar `/everything-claude-code:<name>`.

- [x] `build.mjs` — Node-script som:
  - Auto-upptäcker senaste ECC plugin-version i `~/.claude/plugins/cache/everything-claude-code/everything-claude-code/`
  - Läser alla `skills/*/SKILL.md` → parsar YAML-frontmatter (`name`, `description`)
  - Läser alla `commands/*.md` → parsar frontmatter (`description`, `argument-hint`)
  - Härleder kategori från namn-prefix (se nedan)
  - Genererar `data.json` med `{ items: [ { type, name, slug, description, category, argumentHint } ] }`
- [x] `index.html` — single-file webapp:
  - Fetchar `data.json` (eller embedded via build)
  - Top-bar: sökfält (filtrerar name + description + category), total-räknare
  - Sidebar: kategori-chips med antal per kategori, "skills-only"/"commands-only"-toggle
  - Huvudyta: lista med items, varje rad visar badge (skill/cmd), namn, beskrivning (trunkerad)
  - Klick på rad: kopiera slug till clipboard (Clipboard API) + toast "Copied!"
  - Hover/utfällbar: full description + argument-hint + skill-path
  - Mörkt tema matchande Claude Code
- [x] `launch.sh` — kör build + öppnar `index.html` i default browser
  - Windows: `start index.html`
  - Macr: `open index.html`
  - Linux: `xdg-open index.html`
- [x] README.md med usage
- [x] Sanity-test: `launch.sh` bygger 262 items (183 skills + 79 commands) från ECC 1.10.0 och öppnar browser (2026-04-21). Klick/klistra verifieras av user.
- **Status:** complete

### Phase 2: Multi-source expansion (2026-04-21)
**Mål:** Skanna alla installerade Claude Code-resurser (alla plugins + user skills/commands + valfritt project) i ett samlat manifest. Scope utökas från ~262 ECC-items till ~700+ totalt.

- [x] `build.mjs` utökas:
  - Walk `~/.claude/plugins/cache/**/.claude-plugin/plugin.json` → läs `name` som namespace
  - För varje (marketplace, plugin) välj senaste version via mtime
  - Scanna `<plugin-root>/{skills,commands}`
  - Inkludera `~/.claude/skills/` + `~/.claude/commands/` (user scope, inget namespace-prefix)
  - Valfritt `--project <path>` för project-level `.claude/{skills,commands}`
  - Items får `source`, `namespace`, `scope`
- [x] `index.html` — sidebar Source-chips, scope-badge per rad, collapsible source-list
- [x] `query.mjs` — `--scope`, `--source`, `--list-sources` flags
- [x] `SKILL.md` — uppdaterad till multi-source scope
- [x] `launch.sh` — skickar `--project "$INVOKE_DIR"` om körd från projekt
- [x] Sanity-test: 537 items (368 skills + 169 commands) från 37 sources, filtrering funkar, project-scope funkar (2026-04-21)
- **Status:** complete

### Phase 3: Overnight build — Compose + basket + recipes (2026-04-21)
- [x] `intent.mjs` CLI — tar fritext, rankar skills via token-overlap + IDF + category-boost
- [x] `recipes.json` — 8 seed-recipes (code-review, PRD-to-implementation, onboard-repo, security-audit, repo-cleanup, e2e-testing-setup, llm-observability, deep-plan-compose)
- [x] `index.html` — tab-bar (Browse | Compose | Recipes), basket (sticky drawer, localStorage)
- [x] Compose-tab: textarea → "Find skills" → ranked lista med "Add to basket", example chips
- [x] Recipes-tab: seed + custom listor, "Load" / "Append" / "Delete"
- [x] Basket: visar valda items, reorder ↑↓, "Copy as prompt" (modal preview), "Copy slugs", "Save as recipe", "Clear"
- [x] `SKILL.md` — dokumenterar alla tre ingångar (launch + query.mjs + intent.mjs) för agenter
- [x] README — rewrite med tabs + basket + CLI-tools
- [x] Sanity test: 537 items, intent-matcher gav rätt toppresult på "review python code" och "set up E2E tests", CLI fungerar
- **Status:** complete

## Morning handoff (för dig när du vaknar)

Det jag byggt i natt:
- **Tre tabs i browsern:** Browse (samma som förut), Compose (natural-language intent → top-10 förslag med score + "why this matched"), Recipes (8 färdiga kedjor + save-your-own)
- **Basket** (sticky drawer, tryck B eller knappen uppe till höger): välj flera skills, reorder, spara som recipe, "Copy as prompt" → modal med paste-ready multi-step prompt
- **intent.mjs** för agenter: `node intent.mjs "describe goal"` ger ranked TSV/JSON med score och match-reason
- **recipes.json** med 8 seed-chains — editerbar, genereras till recipes.js vid build
- **SKILL.md** — uppdaterad med båda CLI-tools (query + intent) så agenter vet när de ska använda vilken

Öppen för beslut / nästa steg:
- **Haiku-integration** — inte byggd, local-only ikväll. Billigt och snabbt, men kan missa abstrakt intent. Lätt att lägga till som opt-in: skicka query + top-20 lokala förslag till Haiku för re-ranking + motivering.
- **Buildr-branding** — inte applicerad. Hela strukturen är redo att rebranda; "Skill Browser" → "Buildr Prism" eller vad du väljer. Theme är dark; kan duala till light (som tool3r) på en toggle.
- **Autonomous executor** — basket genererar en prompt, men exekverar inte. Nästa stora steg: "Run basket" som faktiskt invokerar slugs i sekvens via Claude Code session (kräver att vi driver externa Claude-sessions — ej trivialt).
- **Export/share recipes** — idag localStorage only. JSON-export + import är 30-rader-kod bort.
- **Packaging för sälj** — behöver licens, branded landing, opt-in telemetry, docs. Avsiktligt deferred.

Filer: se `README.md`. Öppna med `bash ~/.claude/ecc-browser/launch.sh`. Keyboard: `/` sök, `B` basket, `C` compose, `R` recipes.

## Key Questions
1. ✅ **Form:** HTML-UI (valde "mer avancerade alternativet" av user).
2. ✅ **Scope v1:** endast ECC skills + commands.
3. ✅ **Output:** clipboard-copy. User klistrar själv in slug i Claude Code.

## Decisions Made
| Decision | Rationale |
|---|---|
| Statisk HTML + separat `data.json` | Cache-vänligt, lätt att debugga, fungerar utan server |
| Inbyggd YAML-parser i Node | Inga npm-deps; frontmatter är trivialt att parsa manuellt |
| Kategori härledd från namn-prefix | `kotlin-*` → kotlin, `android-*` → android, `flutter-*` → flutter, `python-*` → python, `rust-*` → rust, `go-*` → go, `cpp-*` → cpp, `security-*` → security, `*-ops` → operations, `*-patterns` → patterns, `*-testing`/`*-test`/`tdd-*` → testing; fall-back "misc" |
| Clipboard API via navigator.clipboard | Funkar i modern browser över file://; fallback till textarea-selection |
| Vanilla JS, ingen framework | Snabbt, lätt att underhålla, zero-dep |
| Mörkt tema | Matchar Claude Codes terminal-look |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|

## Acceptance Criteria (v1)
- `./launch.sh` eller dubbelklick `index.html` → browser öppnas
- Lista visar 262+ items (183 skills + 79 commands)
- Sökfält filtrerar live (match på name/description/category)
- Kategori-chips filtrerar per domän
- Klick på rad: toast visar "Copied!", clipboard innehåller `/everything-claude-code:<name>`
- Växla skill/command-filter fungerar

## Notes
- Plugin-path: `~/.claude/plugins/cache/everything-claude-code/everything-claude-code/<latest-version>/`
- Skill-slug: `/everything-claude-code:<skill-name>`
- Command-slug: `/everything-claude-code:<command-basename>`
- Inte förväxla med ECC:s egna: `ecc_dashboard.py` (install-GUI), `scripts/ecc.js` (install-CLI)

## Current Execution Track (2026-04-22)
- Phase 5 „r aktiv. Tidigare faser och deras checkrutor ovan g„ller fortfarande som historik.
- P0 i roadmapen „r go-live-triggern: Package Assembler m†ste fungera innan deployment av buildr.nu.
- Wave 1 levererad: `assembler.html` + `kickoff-template.mjs` + individuella paketfiler i Download-steget.

### Phase 5: Package Assembler (2026-04-22)
**M†l:** buildr.nu ska kunna ladda ner ett komplett arbets-paket som en kall agent kan k”ra direkt, med offline-first assemblerfl”de och ZIP-export.

**Wave 1 - assembler-skelett + kickoff-template:**
- [x] `assembler.html` - 4-stegs wizard med Describe / Select / Review / Download
- [x] Browser-port av intent-rankning f”r auto-selektion i steg 2
- [x] `kickoff-template.mjs` - generator f”r sj„lvbeskrivande `KICKOFF.md`
- [x] Enhetstester f”r kickoff-template-scenarier

**Wave 2 - paketbygge + ZIP (verified via fallback runtime):**
- [x] Client-side ZIP-generering i browser
- [x] Paketfiler: `KICKOFF.md`, `CLAUDE.md`, `README.md`, `workflows/<name>.yaml`
- [x] †teranv„nd befintliga exportfunktioner d„r det „r rimligt
- [x] Verifiering att ZIP-inneh†llet g†r att anv„nda utan extern dependency

**Wave 2 note:**
- System-Node `v24.13.1` pa denna host kraschar fortfarande pa CSPRNG-init, men verifieringen kunde fullfoljas med lokal fallback-runtime `C:\Program Files\heroku\client\bin\node.exe` (`v20.17.0`).

**Wave 3 - integration + polish:**
- [x] Navintegration i browser/playground/landing
- [x] README + handoff uppdaterade f”r assemblerfl”det
- [x] Regressionsskydd i testsvit
- [x] `node --test tests` fortsatt gr”nt i fungerande lokal runtime (`83/83`)
