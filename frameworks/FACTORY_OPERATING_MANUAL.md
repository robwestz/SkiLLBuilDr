<!-- Source: C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\factory-operating-manual.md · Imported: 2026-04-25 -->
# Factory Operating Manual (Ultima Scenario-Driven Factory)

## Syfte
Det här dokumentet beskriver hur vi bygger autonom mjukvara med AI-agenter utan att hamna i "teaching to the test".
Målet är compound returns: varje förbättring ska göra nästa förbättring billigare, snabbare och säkrare.

## Tre pelare (icke-förhandlingsbara)
1) **Holdout Scenarios (inte tests)**
   - Scenarion ligger utanför builder-agentens åtkomst under byggfas.
   - Builder får aldrig läsa eval-kriterier.
   - Scenarion uttrycker beteende ur extern synvinkel.

2) **Digital Twins**
   - Vi utvecklar mot deterministiska simuleringar (twins), inte riktiga API:er/data.
   - Twins är offline, snabba, kontrollerbara (fault modes) och loggbara.

3) **Specs som input**
   - Agenten läser Markdown-spec (vad), inte tidigare output (hur).
   - Specen är kontraktet. Implementation är agentens val.

## Grundregeln (den viktigaste)
**Build-fasen och Eval-fasen är två olika världar.**
- Build: agenten får se spec + SUT (koden som ska ändras), men inte scenarion.
- Eval: scenariorunnern kör holdout-scenarion mot artefakten från build.

Om denna separation komprometteras är hela fabriken ogiltig.

---

## Terminologi
- **SUT**: System Under Test. Det vi evaluerar (t.ex. `.ultima/tools/...`).
- **Scenario**: externt beteendekrav som körs som blindprov (PASS/FAIL/SKIP).
- **Twin**: deterministisk simulering av ett externt system (inkl. fault injection).
- **Artifact**: debugging-output från eval (loggar, snapshots, call logs).
- **Builder**: modellen/agenten som skriver kod (oftast billigare modell).
- **Operator**: du (Robin) som orkestrerar, granskar artifacts, väljer nästa steg.

---

## Standard-workflow (lokalt och i CI)

### A) Build (agentens loop)
Input:
- Markdown-spec (krav, constraints, interface)
- SUT repo (utan scenarion)

Output:
- Kodändringar
- (valfritt) synliga checks i SUT (lint/unit) -- OK att agenten ser dessa

Policy:
- Agenten får INTE ha tillgång till holdout-scenarion.
- Agenten får INTE ha tillgång till scenario-artifacts från eval (om de innehåller kriterier).
- Agenten får jobba mot twins, men twins får inte innehålla eval-kriterier.

### B) Eval (scenariorunnern)
Input:
- SUT (från build)
- Scenario-repo (holdout)
- Twins (kontrollerade)

Output:
- PASS/FAIL/SKIP per scenario
- Maskinläsbar rapport (minst text, helst JSON/JUnit)
- Artifact bundle per scenario (för operator, inte för builder)

### C) Triage (operatorn)
- Läs rapport, öppna artifacts
- Klassificera fail:
  - Regression (tidigare passade)
  - Nya edge case (nytt scenario)
  - Flake (nondeterminism)
  - Leak risk (kriterier kan ha läckt)
- Välj nästa åtgärd:
  - fixa kod (ny build)
  - förstärk twin
  - förbättra scenario-standard/runner
  - lägg till scenario (endast via human approve)

---

## Feedback discipline (så vi inte "läcker provet")
När en scenario-fail skickas tillbaka till builder-agenten ska feedback vara **redacted**.

### Builder får se (OK)
- Scenario-ID
- Felklass: timeout / fel exit code / saknad side effect / fel format
- Grov symptom: "fick 500" eller "saknar expected field"
- Repro-kommando på hög nivå (utan asserts)

### Builder får inte se (inte OK)
- Exakt assertion-text med expected value
- Fulla fixtures eller specifika testdata som gör att agenten kan hårdkoda
- Scenario-skriptets innehåll
- Detaljerade mismatch-diffs som i praktiken avslöjar kriterier

Operatorn får se allt via artifacts.

---

## Cost policy (modellstrategi)
Vi använder billigaste modell som kan göra progress.

### Tumregler
- **Flash / ultrabillig**: research, generera fixtures, idéförslag, "breaker"-brainstorm.
- **Sonnet / Cursor model**: implementera bash/python-kod, skriva scenarion/twins enligt spec.
- **Opus / dyr**: endast för arkitektur, policy, hotmodell, design av gates. Inte för rutin-kod.

### Stop-regel
Om en billig modell fastnar >N iterationer:
- pausa
- operator gör kort triage
- skärp spec eller minska scope
- först därefter eskalera modell

---

## Quality Gates (definition of done)
Det här är vår miniminivå innan vi "litar" på en ändring.

### Gate 0 -- Hygien
- Inga hemligheter i repo
- Inga nya externa dependencies utan godkännande
- Scripts fungerar i Git Bash + Linux

### Gate 1 -- Scenarios
- Alla relevanta scenario-packs PASS (tillåtet: explicit SKIP med motivering)
- Inga flakes: kör samma pack 2 gånger -> samma resultat (inom rimlig tolerans)

### Gate 2 -- Twins
- Twins är deterministiska (seedade)
- Fault modes fungerar (minst: latency + 429 + 5xx)
- Call logs skrivs till artifacts

### Gate 3 -- Leak Safety
- Builder saknar åtkomst till scenario-repo under build
- Leak scan: inga scenario-identifierare eller fixture-fingerprints hårdkodade i SUT

---

## Incident: misstänkt läcka / "teaching to the test"
Symptom:
- Agent börjar "mystiskt" nämna scenario-namn eller exakta expected values
- Kod innehåller konstiga specialfall som matchar scenario-data

Åtgärd:
1) Stoppa auto-iteration
2) Rotera scenario-data / seeds
3) Kör leak scan + diff-review
4) Förstärk redaction och separation
5) Återuppta med skärpta gates

---

## Operator-checklista (snabb)
Varje gång du kör eval:
- [ ] Scenarion körs i eval-fasen, inte i build-fasen
- [ ] Artifacts samlas och är läsbara
- [ ] Builder får endast redacted feedback
- [ ] Fail klassificeras (regression/edge/flake/leak)
- [ ] Nästa iteration har ett tydligt mål (en sak)
