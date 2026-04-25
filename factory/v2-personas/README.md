# v2-personas

Configurable N-persona debate substrate for replacing low-risk operator asks with a structured decision artifact.

This package generalizes the Memory Architect `Researcher + Gatekeeper` pattern into any number of weighted personas. It is offline-first, has no runtime dependencies, and can be run directly with Node.

## Run

```powershell
& 'C:\Program Files\heroku\client\bin\node.exe' .\factory\v2-personas\debate.mjs --config .\factory\v2-personas\examples\memory-architect.config.json --proposal .\factory\v2-personas\examples\memory-batch.proposal.json --json
```

## Contract

- `personas[]` defines `id`, `name`, `role`, `systemPrompt`, `weight`, `escalationThreshold`, and weighted `criteria[]`.
- `debate` defines `rounds`, `consensusThreshold`, `minimumMargin`, and whether all personas must clear confidence.
- `proposal.signals` provides criterion states: `pass`, `fail`, `unknown`, `true`, or `false`.
- `runDebate(config, proposal, { responder })` returns a `v2-personas.decision.v1` artifact.

The default responder is deterministic and intended for local gates, tests, and dry-runs. Production LLM use should inject a responder that returns the same persona response shape.

## Examples

- `examples/memory-architect.config.json` models Researcher, Gatekeeper, and Operator personas for strategic memory batches.
- `examples/release-readiness.config.json` models a release council for package handoff.
- `examples/operator-ask.config.json` models the autonomous resolution gate for replacing simple operator asks.

## Test

```powershell
& 'C:\Program Files\heroku\client\bin\node.exe' --test .\factory\v2-personas\debate.test.mjs
```
