# Digital Twin Scaffolding

The twin layer is intentionally offline and deterministic. It exists to let the scenario pack exercise external-system behavior without hitting real APIs or parent ECC data.

## Components

- `server.py`: deterministic HTTP twin with modes `healthy`, `rate_limit`, `5xx`, and `latency`
- `probe.py`: tiny stdlib-only client that normalizes twin responses into a stable JSON contract

## Fault modes

- `rate_limit`: returns HTTP `429` with a stable `retry_after`
- `5xx`: returns HTTP `503` with a stable upstream error payload
- `latency`: sleeps for a deterministic delay before returning success

## Artifacts

- `twin_call_log.jsonl`: full operator-facing request log
- `probe_result.json`: normalized client-facing result used by scenarios

## Example

```bash
python tools/twin/server.py --port 8123 --mode healthy --seed 10101 --artifact-dir artifacts/dev-twin &
python tools/twin/probe.py --base-url http://127.0.0.1:8123 --artifact-dir artifacts/dev-probe --seed 10101
```
