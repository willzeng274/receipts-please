#!/usr/bin/env python3
"""Validate the provenance and transform metadata for game model assets."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REQUIRED = {
    "id": str,
    "file": str,
    "kind": str,
    "status": str,
    "dimensions_m": list,
    "scale": (int, float),
    "rotation": list,
    "position": list,
    "source": str,
    "author": str,
    "license": str,
    "modifications": str,
    "animations": list,
}

KINDS = {"procedural-r3f", "glb"}
STATUSES = {"blocked", "wip", "review", "approved"}


def issue(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)


def load_entries(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "assets" in data:
        data = data["assets"]
    if not isinstance(data, list):
        raise ValueError("manifest must be an array or an object with an 'assets' array")
    if not all(isinstance(item, dict) for item in data):
        raise ValueError("every manifest entry must be an object")
    return data


def validate_vector(asset_id: str, name: str, value: Any) -> bool:
    if not isinstance(value, list) or len(value) != 3:
        issue(f"{asset_id}: {name} must contain exactly three numbers")
        return False
    if any(not isinstance(part, (int, float)) for part in value):
        issue(f"{asset_id}: {name} contains a non-number")
        return False
    return True


def validate(path: Path) -> int:
    try:
        entries = load_entries(path)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        issue(str(error))
        return 1

    failures = 0
    seen: set[str] = set()
    for index, entry in enumerate(entries):
        asset_id = entry.get("id", f"entry[{index}]")
        for field, expected in REQUIRED.items():
            if field not in entry:
                issue(f"{asset_id}: missing {field}")
                failures += 1
            elif not isinstance(entry[field], expected):
                issue(f"{asset_id}: {field} has the wrong type")
                failures += 1

        if not isinstance(asset_id, str) or not asset_id.strip():
            issue(f"entry[{index}]: id must be a non-empty string")
            failures += 1
            continue
        if asset_id in seen:
            issue(f"{asset_id}: duplicate id")
            failures += 1
        seen.add(asset_id)

        if entry.get("kind") not in KINDS:
            issue(f"{asset_id}: kind must be one of {sorted(KINDS)}")
            failures += 1
        if entry.get("status") not in STATUSES:
            issue(f"{asset_id}: status must be one of {sorted(STATUSES)}")
            failures += 1

        for vector in ("dimensions_m", "rotation", "position"):
            if vector in entry and not validate_vector(asset_id, vector, entry[vector]):
                failures += 1

        for text_field in ("file", "source", "author", "license", "modifications"):
            value = entry.get(text_field)
            if isinstance(value, str) and not value.strip():
                issue(f"{asset_id}: {text_field} must not be blank")
                failures += 1

    if failures:
        print(f"Manifest failed with {failures} issue(s).", file=sys.stderr)
        return 1

    print(f"Manifest OK: {len(entries)} asset(s) validated.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    return validate(args.manifest)


if __name__ == "__main__":
    raise SystemExit(main())
