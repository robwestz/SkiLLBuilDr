// Orphan helper: present on disk but intentionally absent from manifest.yaml
// and from artifact_intent_cards.yaml. Exists so the validator can report both
// an orphan-file (G4) and a file-without-AIC (G2) failure.
export function noop() {
  return null;
}
