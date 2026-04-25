<!-- Source: C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\threat-model-teaching-to-the-test.md · Imported: 2026-04-25 -->
# Threat Model: Teaching to the Test (Scenario-Driven Factory)

## Mål
Identifiera hur en AI-builder kan (avsiktligt eller oavsiktligt) överanpassa till eval-kriterier,
och definiera motåtgärder som gör scenarion till en äkta holdout.

Den här hotmodellen gäller både:
- adversarialt beteende (agent "försöker vinna")
- emergent beteende (agent råkar optimera mot mätpunkter)

---

## Tillgångar vi skyddar
1) **Scenario-kriterier** (asserts, expected values, edge-case-data)
2) **Scenario-skript** (hela scenariotexten)
3) **Holdout-fixtures** (data som gör kriterier lätta att gissa)
4) **Eval-artifacts** (kan innehålla kriterier)
5) **Separationen** (build vs eval)

---

## Hotyta (attackytor)

### 1) Direkt åtkomst
- Builder kan läsa `.scenarios/` eller scenario-repo.
- Builder kan lista filer/paths som avslöjar scenarion.

**Mitigation**
- Två separata checkouts (build utan scenarion, eval med scenarion)
- Builder kör i workspace där scenarion inte existerar
- Blockera env som pekar på scenarion under build

### 2) Indirekt läcka via namn/strings
- Scenario-ID eller scenario-slug hamnar i kod, loggar, commit messages.
- Fixtures innehåller tydliga "fingerprints".

**Mitigation**
- Leak scan på SUT: förbjudna substrings (scenario-, holdout-, pack-namn)
- Scenario naming: neutrala IDs (S-014), undvik semantiska filnamn
- Fixture rotation / seeds (minst i holdout)

### 3) Feedbackkanal = oracle
- Builder får detaljerade mismatch-diffs eller expected values.
- Builder får artifacts med fulla asserts.

**Mitigation**
- Redacted feedback policy (se manual)
- Artifacts delas bara med operator
- En separat "builder_feedback.json" per scenario (symptom-only)

### 4) Adaptiv probing (överdriven iterering)
- Builder kan köra eval många gånger och inferera kriterier via små kodändringar.

**Mitigation**
- Rate limit eval per PR/iteration (t.ex. max 3 innan human review)
- Batch-eval: kör hela pack, inte enskilda "snabba" efter varje tweak
- "Holdout rotation": variera seeds/data mellan eval-runs

### 5) Twin leakage
- Twins råkar avslöja scenario-kriterier (t.ex. exakt data som scenariot letar efter).
- Twins loggar för mycket i "builder-readable" kanaler.

**Mitigation**
- Twins är "public contract", men scenario-data (holdout fixtures) hålls separat
- Twin logs går till artifacts, inte till builder
- Twin control-plane styrs av scenarion, men builder ser inte control scripts

### 6) Side-channels
- Timing: scenario tar längre tid när den "nästan" klarar kriteriet.
- Error messages: avslöjar struktur på asserts.

**Mitigation**
- Normalisera error outputs (felklass, inte full diff)
- Timeout-hantering: samma policy över scenarion
- Begränsa detaljnivå i stdout/stderr som builder får

---

## Residual risk (accepterad i v1)
- Builder kan fortfarande överanpassa till *synliga* unit/lint checks (det är okej).
- Operator kan omedvetet läcka kriterier i handskriven feedback.

Åtgärd: använd redaction-mallar och håll feedback konsekvent.

---

## Checklist: innan ett nytt scenario blir holdout
- [ ] Scenario uttrycker beteende (observerbart), inte implementation
- [ ] Scenario använder deterministiska inputs (seedad data)
- [ ] Scenario kan köras offline och <10s
- [ ] Scenario skriver artifacts (operator) + builder_feedback (redacted)
- [ ] Scenario-data innehåller inga "fingerprints" som kan hårdkodas
- [ ] Scenario-namn/ID riskerar inte att läcka semantik

## Checklist: innan ett nytt twin-slut byggs in
- [ ] Twin har determinism + seed
- [ ] Twin har minst två fault modes
- [ ] Twin loggar calls till artifacts
- [ ] Twin avslöjar inte holdout-kriterier via fixtures
