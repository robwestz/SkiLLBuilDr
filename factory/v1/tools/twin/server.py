#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deterministic offline digital twin")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--mode", choices=["healthy", "rate_limit", "5xx", "latency"], default="healthy")
    parser.add_argument("--seed", required=True)
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--latency-ms", type=int, default=175)
    return parser.parse_args()


def build_handler(config: argparse.Namespace):
    artifact_dir = Path(config.artifact_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    call_log = artifact_dir / "twin_call_log.jsonl"

    class Handler(BaseHTTPRequestHandler):
        request_count = 0

        def log_message(self, format: str, *args) -> None:  # noqa: A003
            return

        def _write_json(self, status: int, payload: dict[str, object]) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _log_call(self, status: int, payload: dict[str, object]) -> None:
            entry = {
                "timestamp": time.time(),
                "mode": config.mode,
                "seed": config.seed,
                "path": self.path,
                "status": status,
                "payload": payload,
            }
            with call_log.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry) + "\n")

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path == "/healthz":
                self._write_json(200, {"ok": True, "mode": config.mode})
                return

            if parsed.path != "/v1/chunk-intel":
                payload = {"error": "not_found", "path": parsed.path}
                self._log_call(404, payload)
                self._write_json(404, payload)
                return

            Handler.request_count += 1
            request_index = Handler.request_count
            query = parse_qs(parsed.query)
            request_seed = query.get("seed", [config.seed])[0]
            request_id = f"req-{config.seed}-{request_index:03d}"

            if config.mode == "latency":
                time.sleep(config.latency_ms / 1000.0)

            if config.mode == "rate_limit":
                payload = {
                    "request_id": request_id,
                    "error": "rate_limited",
                    "retry_after": 2,
                    "seed": request_seed,
                }
                status = 429
            elif config.mode == "5xx":
                payload = {
                    "request_id": request_id,
                    "error": "upstream_unavailable",
                    "seed": request_seed,
                }
                status = 503
            else:
                payload = {
                    "request_id": request_id,
                    "seed": request_seed,
                    "recommendation": "continue",
                    "score": 0.87,
                    "mode": config.mode,
                }
                status = 200

            self._log_call(status, payload)
            self._write_json(status, payload)

    return Handler


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), build_handler(args))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
