<!-- Source: C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\scenario-authoring-standard.md · Imported: 2026-04-25 -->
# Scenario Authoring Standard (Holdout Scenarios)

## Varför
Scenarion är inte "tester".
De är externt uttryckta beteendekrav som ska gå att köra som blindprov.
De måste vara deterministiska, snabba, offline och säkra mot kriterieläckage.

---

## Scenario-format (bash)
Varje scenario är en körbar `.sh`-fil.

### Obligatoriskt
- `#!/usr/bin/env bash`
- `set -euo pipefail`
- `DESC="..."` (kort beskrivning)
- `SCENARIO_ID="S-XXX"` (stabilt id)
- `trap cleanup EXIT` och en `cleanup()` som tar bort temp state

### Rekommenderat
- Använd `mktemp -d` för workspace
- Skriv artifacts till `${ARTIFACT_DIR}` (som runner sätter)
- Skriv *två* artifacts:
  1) `human_debug.txt` (full detalj)
  2) `builder_feedback.json` (redacted symptom-only)

---

## Givet -> ska (hur vi formulerar krav)
Scenarion uttrycker:
- **Givet** initialt tillstånd + input
- **ska** observerbart beteende ske

Observerbart = CLI exit code, stdout/stderr kontrakt, skapade outputs, eller twin call logs.
Undvik intern implementation (t.ex. "ska skapa fil X i mapp Y") om det inte är en del av externt kontrakt.

---

## Determinism
- All randomness måste seedas (`SEED`)
- Tid ska vara kontrollerbar (Time twin eller fryst input)
- Körning ska vara stabil på Windows Git Bash och Linux
- Om scenariot behöver systemverktyg som varierar, gör det explicit och använd SKIP.

---

## Offline och säkerhet
- Inga nätverksanrop till internet
- Inga hemligheter i fixtures
- Scenarion får skapa temp state men måste städa bort det

---

## Prestanda
- Mål: <10s per scenario, <60s per pack
- Om något är långsamt: bygg in timeout och markera tydligt symptom

---

## Exit codes
Standard:
- `0` = PASS
- `1` = FAIL
- `2` = SKIP (endast vid tydlig motivering)

SKIP ska vara ovanligt och motiveras i stdout.

---

## Artifact policy
Artifacts ska göra triage snabb, men får inte bli en läcka.

### Human artifacts (OK att vara detaljerade)
- full logs
- mismatch diffs
- fixtures snapshots
- twin call logs

### Builder feedback (redacted)
- scenario-id
- felklass
- symptom
- high-level repro

---

## Minimal mall (copy/paste)

```bash
#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="S-001"
DESC="Beskriv vad som valideras (beteende, ej implementation)."

cleanup() {
  [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]] && rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

TMP_DIR="$(mktemp -d)"

: "${SUT_ROOT:?SUT_ROOT måste vara satt}"
: "${ARTIFACT_DIR:?ARTIFACT_DIR måste vara satt}"

HUMAN="${ARTIFACT_DIR}/human_debug.txt"
BUILDER="${ARTIFACT_DIR}/builder_feedback.json"

# --- Givet ---
# setup input/state

# --- När ---
# kör SUT-kommandot och fånga output
set +e
OUT="$("${SUT_ROOT}/path/to/tool.sh" 2>&1)"
RC=$?
set -e

# --- Ska ---
if [[ $RC -ne 0 ]]; then
  {
    echo "Scenario: ${SCENARIO_ID}"
    echo "DESC: ${DESC}"
    echo "FAIL: expected success, got rc=${RC}"
    echo "OUT:"
    echo "${OUT}"
  } > "${HUMAN}"

  cat > "${BUILDER}" <<JSON
{"scenario_id":"${SCENARIO_ID}","status":"FAIL","class":"unexpected_exit","symptom":"tool exited non-zero"}
JSON

  echo "FAIL ${SCENARIO_ID}: unexpected_exit"
  exit 1
fi

echo "PASS ${SCENARIO_ID}"
exit 0
```
