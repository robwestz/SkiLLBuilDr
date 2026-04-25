# v2-personas Integration

## Purpose

Use `factory/v2-personas/debate.mjs` when an agent would otherwise ask the operator a bounded, low-risk question. The debate returns a decision artifact with weighted persona responses, final consensus, and escalation reasons.

## Minimal Flow

1. Select a config from `examples/` or create a task-specific config with at least two personas.
2. Build a proposal JSON with a title, optional question, and `signals` keyed by criterion id.
3. Run the CLI with the mandated local Node binary.
4. If `status` is `accepted`, use `selectedOption`.
5. If `status` is `no_consensus` or `escalated`, ask the operator and attach the decision artifact.

## Adapter Contract

`runDebate(config, proposal, { responder })` accepts an optional async responder:

```js
async function responder({ config, proposal, persona, round, priorAggregate, options }) {
  return {
    personaId: persona.id,
    recommendation: 'approve',
    optionScores: { approve: 0.8, revise: 0.3, escalate: 0.1 },
    confidence: 0.74,
    rationale: 'Grounded in the configured criteria.',
    risks: [],
    escalate: false
  };
}
```

This keeps LLM, scripted, and deterministic responders behind the same interface. No network or dependency is required by the substrate itself.

## Replacing Operator Asks

Use the `Operator Ask Replacement` example as the default gate:

```powershell
& 'C:\Program Files\heroku\client\bin\node.exe' .\factory\v2-personas\debate.mjs --config .\factory\v2-personas\examples\operator-ask.config.json --proposal .\factory\v2-personas\examples\operator-question.proposal.json --json
```

Escalate immediately instead of debating when the question involves destructive actions, credentials, external spend, publishing, force-pushes, or scope changes outside the worker's ownership.

## Boundaries

This package does not modify `assemble.mjs`, `kickoff-template.mjs`, `.omc`, or `factory/v1`. Wiring the substrate into package assembly should happen in a separate integration package because Worker P2 owns only `factory/v2-personas/`.
