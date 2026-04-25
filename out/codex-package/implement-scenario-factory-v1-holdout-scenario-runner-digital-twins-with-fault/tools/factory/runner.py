#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


STATUS_BY_RC = {
    0: "PASS",
    2: "SKIP",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scenario Factory runner")
    parser.add_argument("--json", action="store_true", help="Emit JSON output")
    parser.add_argument("--timeout", type=int, default=15, help="Per-scenario timeout in seconds")
    parser.add_argument(
        "--scenario",
        action="append",
        default=[],
        help="Run only matching scenario filename(s) or ids; may be repeated",
    )
    return parser.parse_args()


def workspace_root() -> Path:
    return Path(__file__).resolve().parents[2]


def discover_scenarios(root: Path, selectors: list[str]) -> list[Path]:
    all_scenarios = sorted(root.glob("scenarios/S-*.sh"))
    if not selectors:
        return all_scenarios
    lowered = {item.lower() for item in selectors}
    filtered: list[Path] = []
    for path in all_scenarios:
        scenario_id = parse_scenario_id(path)
        if path.name.lower() in lowered or scenario_id.lower() in lowered:
            filtered.append(path)
    return filtered


def parse_scenario_id(path: Path) -> str:
    match = re.search(r'^SCENARIO_ID="([^"]+)"', path.read_text(encoding="utf-8"), flags=re.MULTILINE)
    if not match:
        raise RuntimeError(f"Could not find SCENARIO_ID in {path}")
    return match.group(1)


def ensure_artifacts(path: Path, scenario_id: str, status: str, summary: str) -> None:
    path.mkdir(parents=True, exist_ok=True)
    human = path / "human_debug.txt"
    if not human.exists():
        human.write_text(
            f"Scenario: {scenario_id}\nSTATUS: {status}\nSUMMARY: {summary}\n",
            encoding="utf-8",
        )
    builder = path / "builder_feedback.json"
    if not builder.exists():
        builder.write_text(
            json.dumps(
                {
                    "scenario_id": scenario_id,
                    "status": status,
                    "class": "runner_synthesized",
                    "symptom": summary,
                    "high_level_repro": "rerun via bash scenarios/runner.sh",
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )


def run_scenario(
    scenario_path: Path,
    artifact_dir: Path,
    timeout: int,
    bash_binary: str,
    python_binary: str,
    workspace: Path,
    sut_root: Path,
) -> dict[str, object]:
    scenario_id = parse_scenario_id(scenario_path)
    env = os.environ.copy()
    env.update(
        {
            "ARTIFACT_DIR": str(artifact_dir),
            "SUT_ROOT": str(sut_root),
            "WORKSPACE_ROOT": str(workspace),
            "FACTORY_PYTHON": python_binary,
            "FACTORY_BASH": bash_binary,
            "RUN_TIMEOUT": str(timeout),
        }
    )

    started = time.perf_counter()
    try:
        completed = subprocess.run(
            [bash_binary, str(scenario_path)],
            cwd=workspace,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        duration = round(time.perf_counter() - started, 3)
        status = STATUS_BY_RC.get(completed.returncode, "FAIL")
        summary = completed.stdout.strip() or completed.stderr.strip() or "scenario returned without output"
        ensure_artifacts(artifact_dir, scenario_id, status, summary)
        return {
            "id": scenario_id,
            "status": status,
            "duration": duration,
            "artifact_path": str(artifact_dir),
            "exit_code": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
        }
    except subprocess.TimeoutExpired as exc:
        duration = round(time.perf_counter() - started, 3)
        summary = f"scenario timed out after {timeout}s"
        ensure_artifacts(artifact_dir, scenario_id, "TIMEOUT", summary)
        return {
            "id": scenario_id,
            "status": "TIMEOUT",
            "duration": duration,
            "artifact_path": str(artifact_dir),
            "exit_code": 124,
            "stdout": exc.stdout or "",
            "stderr": exc.stderr or "",
        }


def print_human(results: list[dict[str, object]], run_dir: Path) -> None:
    print(f"Scenario run: {run_dir}")
    for result in results:
        print(
            f"{result['status']:>7}  {result['id']}  {result['duration']:.3f}s  {result['artifact_path']}"
        )


def main() -> int:
    args = parse_args()
    root = workspace_root()
    sut_root = Path(os.environ.get("SUT_ROOT", str(root))).resolve()
    scenarios = discover_scenarios(root, args.scenario)
    if not scenarios:
        print("No scenarios found for selection.", file=sys.stderr)
        return 1

    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = root / "artifacts" / "runs" / run_stamp
    run_dir.mkdir(parents=True, exist_ok=True)

    bash_binary = os.environ.get("FACTORY_BASH", "bash")
    python_binary = os.environ.get("FACTORY_PYTHON", sys.executable)

    results = []
    for scenario in scenarios:
        scenario_id = parse_scenario_id(scenario)
        artifact_dir = run_dir / scenario_id
        results.append(run_scenario(scenario, artifact_dir, args.timeout, bash_binary, python_binary, root, sut_root))

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "run_dir": str(run_dir),
        "results": [
            {
                "id": item["id"],
                "status": item["status"],
                "duration": item["duration"],
                "artifact_path": item["artifact_path"],
            }
            for item in results
        ],
    }

    if args.json:
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print_human(results, run_dir)

    return 0 if all(item["status"] in {"PASS", "SKIP"} for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
