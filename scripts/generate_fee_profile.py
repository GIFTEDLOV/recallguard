"""Run representative gltest cases and write the measured v0.6 fee profile."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("tests", nargs="*", help="pytest paths/selectors used for profiling")
    parser.add_argument("--output", default="frontend/public/fee-profile.json")
    parser.add_argument("--headroom", default="1.25")
    args = parser.parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    gltest = shutil.which("gltest") or shutil.which("gltest.exe")
    if gltest is None:
        sibling = Path(sys.executable).parent / "Scripts" / "gltest.exe"
        if sibling.exists():
            gltest = str(sibling)
    if gltest is None:
        raise SystemExit("gltest executable not found; install the pinned genlayer-test release")
    command = [
        gltest,
        "--fee-profile",
        str(output),
        "--fee-profile-headroom",
        str(args.headroom),
        *(args.tests or ["tests/integration"]),
    ]
    completed = subprocess.run(command, check=False)
    if completed.returncode != 0:
        return completed.returncode
    if not output.exists():
        raise SystemExit(f"Fee profiler completed without writing {output}")
    profile = json.loads(output.read_text(encoding="utf-8"))
    required_fields = (
        "leaderTimeunitsAllocation",
        "validatorTimeunitsAllocation",
        "executionBudgetPerRound",
        "totalMessageFees",
        "rotationsPerRound",
    )
    missing = [
        name
        for name in ("deploy", "register_listing", "request_assessment")
        if (name == "deploy" and not profile.get("deploy"))
        or (name != "deploy" and not profile.get("methods", {}).get(name))
    ]
    if missing:
        raise SystemExit(
            "Fee profiler produced no measured entries for: " + ", ".join(missing)
        )
    malformed = []
    entries = [profile["deploy"], profile["methods"]["register_listing"], profile["methods"]["request_assessment"]]
    for label, entry in zip(("deploy", "register_listing", "request_assessment"), entries):
        if any(field not in entry for field in required_fields):
            malformed.append(label)
    if malformed:
        raise SystemExit(
            "Fee profiler produced incomplete measured entries for: " + ", ".join(malformed)
        )
    print(f"Measured fee profile written to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
