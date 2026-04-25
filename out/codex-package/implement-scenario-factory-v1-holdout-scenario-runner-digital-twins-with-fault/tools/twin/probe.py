#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.request
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Probe the digital twin and normalize output")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--seed", required=True)
    parser.add_argument("--timeout", type=float, default=2.0)
    return parser.parse_args()


def classify(status: int) -> str:
    if status == 429:
        return "rate_limit"
    if 500 <= status <= 599:
        return "upstream_5xx"
    if status == 200:
        return "success"
    return "http_error"


def write_result(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    result_path = Path(args.artifact_dir) / "probe_result.json"
    url = f"{args.base_url.rstrip('/')}/v1/chunk-intel?seed={args.seed}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})

    try:
        with urllib.request.urlopen(request, timeout=args.timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
            payload = {
                "ok": True,
                "classification": classify(response.status),
                "http_status": response.status,
                "request_id": body.get("request_id"),
                "body": body,
            }
            write_result(result_path, payload)
            print(json.dumps(payload))
            return 0
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {"raw": raw}
        payload = {
            "ok": False,
            "classification": classify(exc.code),
            "http_status": exc.code,
            "request_id": body.get("request_id"),
            "body": body,
        }
        write_result(result_path, payload)
        print(json.dumps(payload))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
