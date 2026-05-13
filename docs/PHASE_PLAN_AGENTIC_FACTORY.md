# Fas-plan — Skill Browser ↔ CLI ↔ MCP ↔ «Agentic OS» (fabrik)

> Syfte: ge Claude Code en **prioriterad**, **en sak i taget**-väg till sömlös korsanvändning mellan web UI, terminal och LLM-verktyg (MCP), i linje med diagrammet *AGENTIC OS* (dirigent = Claude Code; MANUAL / SKILL / ROUTINE / AGENT; OPS med Cron Manager).
>
> Referensbild (Robin): Cursor workspace assets — konceptpanel med kolumner (Productivity … OPS), cadence (finger / alarm / moln), **Cron Manager**, **Skill Creator**.

---

## Nuläge (kort granskning — vad som redan finns)

| Yta | Vad som fungerar | Luckor vs «sömlöst» |
|-----|-------------------|---------------------|
| **`assemble.mjs`** | Headless assembler: `--goal`, `--tier`, `--limit`, `--ai`, `--auto`, `--handoff` / `--resume`, zip till `--out`. **KICKOFF** via **`buildKickoffWithPhase0`** (Preflight / Compound-läge). | Ingen gemensam «policy manifest» som UI och MCP måste läsa; ingen inbyggd «routine runner». |
| **`assembler.html`** | Samma intentionella flöde som CLI för människa (välj mål, skills, exportera). | Måste hålla **schema-/kontrakts-paritet** med CLI/MCP explicit (test + checklist). |
| **`mcp-server.mjs`** | `search_skills`, `rank_skills_for_goal`, `get_skill`, **`assemble_package`** (ZIP base64 från **explicita slugs**), `list_sources`. | **`assemble_package` använder `buildKickoff` — inte `buildKickoffWithPhase0`.** LLM via MCP får **svagare kontrakt** än CLI. Ingen MCP-operation som speglar hela `assemble.mjs --goal … --auto` (rank → välj → paketera i ett steg). |
| **`handoff-bridge.mjs`** | v1 ledger + checkpoint/resume; `assemble.mjs` importerar `buildResumePrompt`, `loadHandoff`. | `FUTURE_WORK.md` #1–#2 (token budget → stabil Codex-handoff) fortfarande roadmap. |
| **Recipes (`recipes.json` + UI)** | Sparade kedjor / prompts / mallar — bra «ROUTINE»-råmaterial. | Saknar **maskinläsbart rutinformat** (steg, triggers, verifieringskommandon, escalation). |
| **`cli.mjs` / `intent.mjs`** | Katalogfrågor och ranking utan UI. | Inte enhetlig ingång för «kör denna routine`. |

**Slutsats:** Bryggan är **reell och användbar** för *sök + hämta + paketera med givna slugs*, men **inte parity** med «fabrik»-kontraktet tills MCP-assembler och CLI delar **samma KICKOFF-generator** och tills recept har ett **routine-lager**.

---

## Designprinciper (håll fast)

1. **En sanning för kontrakt:** `buildKickoffWithPhase0` (eller wrapper) för **alla** paket som ska in i autonoma körningar — CLI, MCP, ev. exporter från UI.
2. **UI = människa; CLI/MCP = automation.** Samma metadata (versionsrad i ZIP, manifestrad i JSON).
3. **Routine före Cron:** ingen OS-scheduler förrän en rutin kan köras deterministiskt med `node …` och exit codes.
4. **Portable-kit / KB-skills** (`knowledge-base`, `skill-engine`, `skill-kb-*`): **adapter sist** — koppla först **enda** ingest (`skill-kb-query` **eller** `skill-kb-context`), dokumentera kontrakt mot repo-root.

---

## Fas 0 — Paritet «Kontrakt först» (högsta ROI, liten risk) ✅ SHIPPED 2026-05-13

**Mål:** MCP och CLI producerar **identisk semantik** för KICKOFF.

- [x] Byt `assemble_package` i `mcp-server.mjs` till **`buildKickoffWithPhase0`** med samma parameterändring som CLI där det är rimligt (minst Phase 0-block; scenario gate valfritt via args).
- [ ] Lägg **ett** regressionstest: MCP-handler eller delad funktion jämför fingerprint/hash av KICKOFF-header mot kända fixtures för samma `goal` + `nodes`. *(Deferred — `assembleFromNodes` helper enforces parity by construction; byte-fingerprint test in FUTURE_WORK #12.)*
- [x] Dokumentera i README: «Headless parity: assemble.mjs vs MCP».

**DoD:** `skill-browser-mcp` ZIP och `assemble.mjs`-ZIP för samma slug-set skiljer sig inte i **Phase 0-sektion** (minus tidsstämplar om ni väljer att normalisera).

---

## Fas 1 — En MCP eller CLI-operation «assemble_from_goal» ✅ SHIPPED 2026-05-13

**Mål:** LLM slipper manuellt kedja `rank` → välja slugs → `assemble_package`.

- [x] Ny MCP-tool **eller** documented subprocess: input `{ goal, tier?, limit?, ai? }`, intern pipeline = befintlig ranking från `data.json` + samma urvalslogik som `assemble.mjs --auto` (återanvänd moduler; duplicera inte IDF).
- [x] Strikt flagga **utan API-nyckel**: `--ai false` default; dokumentera i tool description. *(AI rerank intentionally not in schema; documented in tool description as future work.)*

**DoD:** ✅ Ett enda tool-anrop från Claude Code kan generera ZIP bytes eller skriva till `--out` via wrapper-script.

---

## Fas 2 — Routine manifest (Recipes → automation-ready) ✅ SHIPPED 2026-05-13

**Mål:** Mappa diagrammets **ROUTINE** till versionerbar JSON/YAML.

- [x] Schema `routine.v1`: `{ id, title, cadence: manual|cron|trigger, steps:[ { kind: skill|command|shell|handoff|assemble|kb_query, ref, args?, verify? } ], compound_hooks?: [...] }` — see `schemas/routine.v1.json` + `lib/routine.mjs`.
- [ ] UI: «Exportera recept som routine» → nedladdning `routine.json`. *(Deferred — UI work; pure transformation already available via `recipeToRoutine`.)*
- [x] CLI: `node routine-run.mjs routine.json` (dry-run default; `--execute` for side-effects).

**DoD:** ✅ All 18 entries in `recipes.json` transform cleanly via `recipeToRoutine` and pass validation — see `tests/routine.test.mjs` "every entry in recipes.json can be expressed as a valid routine".

---

## Fas 3 — Routine runner (lokal fabrik v1) ✅ SHIPPED 2026-05-13

**Mål:** Kör steg sekventiellt med logging + exit codes (ingen cron än).

- [x] `routine-run.mjs` kör `shell`-steg via `spawnSync`, `skill`-steg som «skriv promptfil» (Claude-subprocess intentionally **never** auto-invoked); 3-layer safety grind for shell (`--execute` AND `step.args.runtime_authorized`).
- [x] JSONL-log under `.agents/routine-runs/<ts>/<routine-id>.jsonl` med events `start | step | halt | end`.

**DoD:** ✅ Demo-routine körs via `node --test tests/routine-runner.test.mjs` (13 tester, covers all step kinds + escalate-vs-continue + safety grind).

---

## Fas 4 — Cron Manager (lokal först) ✅ SHIPPED 2026-05-13

**Mål:** Motsvara OPS-kolumnens alarm-symbol utan molnmagi.

- [x] Dokumentera **Windows Task Scheduler** + **cron** mall som anropar `routine-run.mjs` — see `cron/README.md`.
- [x] `cron/install-example.ps1` (Windows, current-user not SYSTEM) + `cron/install-example.sh` (Unix crontab) — both ask for confirmation before mutating system state.

**DoD:** ✅ Operator can paste either installer with their chosen routine + cron expression to wire a daily trigger.

---

## Fas 5 — Portable-kit / KB-integration (spike → adapter) ✅ CONTRACT SHIPPED 2026-05-13

**Mål:** Koppla extern kunskapsmotor utan att tömma ecc-browser på zero-deps policy.

- [x] Pluggable provider contract via new step kind `kb_query`: `args.provider ∈ {file, portable-kit, http}` (v1 implements `file` only — `portable-kit`/`http` are reserved contract slots returning `kb-not-implemented` with explicit operator-instruction note).
- [ ] Hard wiring of `~/Downloads/portable-kit` paths. *(Deferred — operator-owned per CLAUDE.md; portable-kit lives outside this repo.)*

**DoD:** ✅ Routines kan nu chaina `kb_query (file)` → assemble → skill steps utan dubbel sanning; `tests/factory-e2e.test.mjs` E2E-roundtrip beviser flödet.

---

## Fas 6 — Fabrik-dashboard ✅ MINIMAL SHIPPED 2026-05-13

**Mål:** Närma diagrammets statusrad («54 SKILLS, 18 ROUTINES …»).

- [x] `factory-status.mjs` (Node CLI, text + `--json`) — testable via `collectStatus(repoRoot)`.
- [x] `factory-status.html` — statisk vanilla-JS-vy som fetch():ar data.json/data.public.js + routines/ + .agents/TASKS.json.

**DoD:** ✅ `node factory-status.mjs` ger operatören "X skills · Y routines · Z tasks" på en rad utan att kräva browser. HTML-vyn ger samma data när serverad över HTTP.

---

## Ordning för Claude Code — vad du gör först

1. **Fas 0** (måste göras innan «fabrik» marknadsförs).
2. **Fas 1** om MCP-first automation är viktigare än recept-export.
3. **Fas 2 → 3** om recept → automation är viktigare än MCP one-shot.

Portable-kit (**Fas 5**) först när Fas 0–2 är gröna — annars multipliceras felaktiga KICKOFF:ar i KB-flödet.

---

## Koppling till befintlig roadmap

- `FUTURE_WORK.md` **#2 Handoff Bridge** förstärker **ROUTINE** med `stop-mid-task` / Codex byte — integrera handoff-path i routine-schema när Fas 3 är stabil.
- **Token budget (#1)** innan osupervised multi-step cron (**Fas 4**).

---

*Senast uppdaterad: i samband med Agentic OS-diagram och ecc-browser MCP/CLI-granskning.*

---

## Bilaga A — Autonom körning för Claude Code (självständighet)

Utan denna bilaga är dokumentet **vägledning**, inte **utförande**. Med bilagan ska en agent kunna **genomföra Fas 0** utan att gissa repo-struktur.

### A.1 Obligatorisk för-session (repo-kontrakt)

1. Arbeta från **repots rot** (`ecc-browser` — katalog som innehåller `assemble.mjs`, `mcp-server.mjs`, `CLAUDE.md`).
2. Läs **`CLAUDE.md`** (och vid commit/push även **`AGENT_ONBOARDING.md`** / Gate 8 enligt repo-regler).
3. **Lägg inte till runtime `dependencies`** i `package.json` utan uttrycklig operatörs-genomgång (projektregel: zero runtime deps).
4. **Push till `origin/main`** endast om operatören godkänt.

### A.2 Verifiering efter varje meningsfull ändring

Kör från repots rot (PowerShell eller bash):

```bash
node --version
node --test tests/mcp-server.test.mjs
node --test tests/kickoff-template.test.mjs
node --test tests/*.test.mjs
```

Minimikrav innan «klart»: **`tests/mcp-server.test.mjs` fail 0** om MCP ändrats; full suite om du rört delad logik.

### A.3 Fas 0 — Exekverings-checklista (kopiera till uppgift)

**Syfte:** `assemble_package` ska generera **samma klass av KICKOFF** som CLI (`Phase 0 / Preflight`-semantik via `buildKickoffWithPhase0`).

| Steg | Åtgärd |
|------|--------|
| 1 | Öppna `mcp-server.mjs`: importera **`buildKickoffWithPhase0`** från `./kickoff-template.mjs` (ersätt eller komplettera `buildKickoff` för assembler-path). |
| 2 | I `assemble_package`-handlern: bygg KICKOFF med **`buildKickoffWithPhase0({ goal, description, packageName, nodes, tier, chunkPlan?, gatePath?, prefill?, autoOnboard?, debateTopic? })`** — spegla **minst** de fält som `assemble.mjs` skickar vid zip-bygg (se nedan); för MCP **rimliga defaults**: `tier: "production"`, övriga optional som `null` / `false` / `""` om inte tool-args exponeras ännu. |
| 3 | Referens för CLI-anrop (läs `assemble.mjs` runt rad ~383): `goal`, `description`, `packageName`, `nodes`, `tier`, `chunkPlan`, `gatePath: args.scenarioGate`, `prefill`, `autoOnboard`, `debateTopic`. |
| 4 | Utöka MCP `assemble_package` **inputSchema** valfritt med `tier`, `scenarioGate`, `debate` om du vill ha parity utan fler rundor — annars dokumentera defaults i tool description. |
| 5 | Lägg test i **`tests/mcp-server.test.mjs`**: verifiera Phase 0 i MCP-path. **Rekommenderat (enklast):** refaktorera så att `assemble_package` anropar en **delad funktion** som returnerar `{ kickoffMarkdown, zipBase64 }` (eller liknande); testa då `kickoffMarkdown` med samma regex som `tests/assemble.test.mjs`: `/Phase 0 — Preflight Contract/` och `/### 0\\.1 Goal restate/`. **Alternativ:** dekoda ZIP och läs `KICKOFF.md` utan nya npm-dependencies (återanvänd minimal befintlig ZIP-läsning om repo tillhandahåller den). |
| 6 | Uppdatera **`README.md`** med en rad: MCP `assemble_package` använder samma Phase 0-KICKOFF som `assemble.mjs`. |

**DoD (maskinellt):** alla tester gröna; nytt eller uppdaterat MCP-test visar Phase 0-innehåll i `KICKOFF.md` från `assemble_package`.

### A.4 Vad detta dokument **inte** ger (kräver människa eller ny kontext)

- Full Implementering av **Fas 1–6** med alla kodstigar — endast **Fas 0** är ruttnätad ovan.
- Innehåll i **`Downloads/portable-kit`** — paths finns inte i denna repo; agent måste läsa lokala kopior om Fas 5 ska göras.
- **GitHub Actions / secrets** för cron i molnet — Fas 4 avser **lokal** cron/Task Scheduler först.

### A.5 Rekommenderad första prompt till Claude Code

> «Läser `docs/PHASE_PLAN_AGENTIC_FACTORY.md` Bilaga A. Genomför endast **Fas 0**: uppdatera `mcp-server.mjs` och tester enligt checklistan; inga andra faser; ingen push; kör full test-suite och rapportera diff + kommando-output.»

---

## Bilaga B — Uttömmandehet (självbedömning)

| Dimension | Status utan bilaga | Status med bilaga A |
|-----------|---------------------|---------------------|
| Strategisk riktning | Ja | Ja |
| Fas-prioritet | Ja | Ja |
| **Exakta filer + tester för Fas 0** | Nej | Ja |
| Fas 1–6 steg-för-steg kodinstruktioner | Nej (medvetet kortfattat) | Nej — gör nästa bilaga vid behov |

**Slutsats:** För **autonom genomföring av hela fabriken** från en fil räcker det inte ännu; för **autonom genomföring av kontrakts-paritet (Fas 0)** ska Bilaga A räcka. Utöka med «Bilaga C — Fas 1» när Fas 0 är merged.
