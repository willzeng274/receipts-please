#!/usr/bin/env python3
"""Validate an audio audit manifest and emit a deterministic runtime catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse


ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
MIME_BY_SUFFIX = {
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _get(mapping: Any, key: str, location: str, errors: list[str]) -> Any:
    if not isinstance(mapping, dict):
        errors.append(f"{location}: expected an object")
        return None
    if key not in mapping:
        errors.append(f"{location}.{key}: missing required field")
        return None
    return mapping[key]


def _text(mapping: Any, key: str, location: str, errors: list[str]) -> str:
    value = _get(mapping, key, location, errors)
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{location}.{key}: expected a non-empty string")
        return ""
    return value.strip()


def _number(mapping: Any, key: str, location: str, errors: list[str]) -> float | None:
    value = _get(mapping, key, location, errors)
    if not _is_number(value):
        errors.append(f"{location}.{key}: expected a finite number")
        return None
    return float(value)


def _boolean(mapping: Any, key: str, location: str, errors: list[str]) -> bool | None:
    value = _get(mapping, key, location, errors)
    if not isinstance(value, bool):
        errors.append(f"{location}.{key}: expected true or false")
        return None
    return value


def _url(mapping: Any, key: str, location: str, errors: list[str]) -> str:
    value = _text(mapping, key, location, errors)
    parsed = urlparse(value)
    if value and (parsed.scheme not in {"http", "https"} or not parsed.netloc):
        errors.append(f"{location}.{key}: expected an absolute http(s) URL")
    return value


def _sha256(mapping: Any, key: str, location: str, errors: list[str]) -> str:
    value = _text(mapping, key, location, errors)
    if value and not SHA256_RE.fullmatch(value):
        errors.append(f"{location}.{key}: expected 64 lowercase hexadecimal characters")
    return value


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _runtime_asset(
    asset: Any,
    index: int,
    asset_root: Path,
    seen_ids: set[str],
    seen_paths: set[str],
    errors: list[str],
) -> dict[str, Any]:
    location = f"assets[{index}]"
    asset_id = _text(asset, "id", location, errors)
    if asset_id and not ID_RE.fullmatch(asset_id):
        errors.append(f"{location}.id: use lowercase letters, digits, and single hyphens")
    if asset_id in seen_ids:
        errors.append(f"{location}.id: duplicate id {asset_id!r}")
    seen_ids.add(asset_id)

    kind = _text(asset, "kind", location, errors)
    if kind not in {"music", "sfx"}:
        errors.append(f"{location}.kind: expected 'music' or 'sfx'")
    title = _text(asset, "title", location, errors)
    description = _text(asset, "description", location, errors)
    role = _text(asset, "role", location, errors)

    tags = _get(asset, "tags", location, errors)
    clean_tags: list[str] = []
    if not isinstance(tags, list) or not tags:
        errors.append(f"{location}.tags: expected a non-empty array")
    else:
        for tag_index, tag in enumerate(tags):
            if not isinstance(tag, str) or not ID_RE.fullmatch(tag):
                errors.append(f"{location}.tags[{tag_index}]: expected a lowercase hyphenated tag")
            else:
                clean_tags.append(tag)
        if len(clean_tags) != len(set(clean_tags)):
            errors.append(f"{location}.tags: duplicate tags are not allowed")

    creator = _get(asset, "creator", location, errors)
    creator_name = _text(creator, "name", f"{location}.creator", errors)
    creator_url = _url(creator, "url", f"{location}.creator", errors)

    source = _get(asset, "source", location, errors)
    source_page_url = _url(source, "page_url", f"{location}.source", errors)
    _url(source, "download_url", f"{location}.source", errors)
    _text(source, "original_filename", f"{location}.source", errors)
    _sha256(source, "sha256", f"{location}.source", errors)

    license_data = _get(asset, "license", location, errors)
    license_name = _text(license_data, "name", f"{location}.license", errors)
    license_url = _url(license_data, "url", f"{location}.license", errors)
    checked_on = _text(license_data, "checked_on", f"{location}.license", errors)
    try:
        date.fromisoformat(checked_on)
    except ValueError:
        if checked_on:
            errors.append(f"{location}.license.checked_on: expected an ISO date (YYYY-MM-DD)")

    attribution = _get(asset, "attribution", location, errors)
    attribution_required = _boolean(attribution, "required", f"{location}.attribution", errors)
    attribution_text = _text(attribution, "text", f"{location}.attribution", errors)
    attribution_placement = _text(attribution, "placement", f"{location}.attribution", errors)

    redistribution = _get(asset, "redistribution", location, errors)
    redistribution_status = _text(redistribution, "status", f"{location}.redistribution", errors)
    if redistribution_status not in {"allowed", "restricted"}:
        errors.append(
            f"{location}.redistribution.status: only 'allowed' or reviewed 'restricted' assets may ship"
        )
    redistribution_notes = _text(redistribution, "notes", f"{location}.redistribution", errors)

    processing = _get(asset, "processing", location, errors)
    _text(processing, "tool", f"{location}.processing", errors)
    _text(processing, "command", f"{location}.processing", errors)

    qc = _get(asset, "qc", location, errors)
    auditioned = _boolean(qc, "auditioned", f"{location}.qc", errors)
    if auditioned is False:
        errors.append(f"{location}.qc.auditioned: must be true before cataloging")
    target_lufs = _number(qc, "target_lufs", f"{location}.qc", errors)
    tolerance_lu = _number(qc, "tolerance_lu", f"{location}.qc", errors)
    if target_lufs is not None and not -70.0 <= target_lufs <= -1.0:
        errors.append(f"{location}.qc.target_lufs: expected a value from -70 to -1")
    if tolerance_lu is not None and not 0.0 <= tolerance_lu <= 12.0:
        errors.append(f"{location}.qc.tolerance_lu: expected a value from 0 to 12")
    qc_notes = _text(qc, "notes", f"{location}.qc", errors)

    loop = _get(asset, "loop", location, errors)
    loop_enabled = _boolean(loop, "enabled", f"{location}.loop", errors)
    loop_start = _number(loop, "start_seconds", f"{location}.loop", errors)
    loop_end = _number(loop, "end_seconds", f"{location}.loop", errors)
    seam_tested = _boolean(loop, "seam_tested", f"{location}.loop", errors)
    loop_notes = _text(loop, "notes", f"{location}.loop", errors)
    if loop_start is not None and loop_start < 0:
        errors.append(f"{location}.loop.start_seconds: must be non-negative")
    if loop_start is not None and loop_end is not None and loop_end <= loop_start:
        errors.append(f"{location}.loop.end_seconds: must be greater than start_seconds")
    if loop_enabled is True and seam_tested is not True:
        errors.append(f"{location}.loop.seam_tested: enabled loops must be seam-tested")

    files = _get(asset, "files", location, errors)
    runtime_files: list[dict[str, Any]] = []
    if not isinstance(files, list) or not files:
        errors.append(f"{location}.files: expected at least one runtime file")
        files = []

    for file_index, file_data in enumerate(files):
        file_location = f"{location}.files[{file_index}]"
        relative_path = _text(file_data, "path", file_location, errors)
        final_sha = _sha256(file_data, "sha256", file_location, errors)
        declared_bytes = _get(file_data, "bytes", file_location, errors)
        if not isinstance(declared_bytes, int) or isinstance(declared_bytes, bool) or declared_bytes <= 0:
            errors.append(f"{file_location}.bytes: expected a positive integer")
        mime_type = _text(file_data, "mime_type", file_location, errors)
        duration = _number(file_data, "duration_seconds", file_location, errors)
        integrated_lufs = _number(file_data, "integrated_lufs", file_location, errors)
        true_peak = _number(file_data, "true_peak_dbtp", file_location, errors)
        sample_rate = _get(file_data, "sample_rate_hz", file_location, errors)
        channels = _get(file_data, "channels", file_location, errors)

        pure_path = PurePosixPath(relative_path)
        if (
            not relative_path
            or pure_path.is_absolute()
            or ".." in pure_path.parts
            or "\\" in relative_path
            or len(pure_path.parts) != 2
            or pure_path.parts[0] != kind
        ):
            errors.append(f"{file_location}.path: expected safe {kind}/<filename> POSIX path")
        suffix = pure_path.suffix.lower()
        expected_mime = MIME_BY_SUFFIX.get(suffix)
        if expected_mime is None:
            errors.append(f"{file_location}.path: unsupported browser-audio extension {suffix!r}")
        elif mime_type != expected_mime:
            errors.append(f"{file_location}.mime_type: expected {expected_mime!r} for {suffix}")
        if asset_id and final_sha and suffix:
            expected_name = f"{asset_id}--{final_sha[:12]}{suffix}"
            if pure_path.name != expected_name:
                errors.append(f"{file_location}.path: filename must be {expected_name!r}")
        if relative_path in seen_paths:
            errors.append(f"{file_location}.path: duplicate path {relative_path!r}")
        seen_paths.add(relative_path)

        if duration is not None and duration <= 0:
            errors.append(f"{file_location}.duration_seconds: must be positive")
        if integrated_lufs is not None and not -70.0 <= integrated_lufs <= 0.0:
            errors.append(f"{file_location}.integrated_lufs: expected a value from -70 to 0")
        if (
            integrated_lufs is not None
            and target_lufs is not None
            and tolerance_lu is not None
            and abs(integrated_lufs - target_lufs) > tolerance_lu
        ):
            errors.append(f"{file_location}.integrated_lufs: outside declared target/tolerance")
        if true_peak is not None and not -60.0 <= true_peak <= -1.0:
            errors.append(f"{file_location}.true_peak_dbtp: expected -60 to -1 dBTP")
        if not isinstance(sample_rate, int) or isinstance(sample_rate, bool) or not 8000 <= sample_rate <= 192000:
            errors.append(f"{file_location}.sample_rate_hz: expected an integer from 8000 to 192000")
        if not isinstance(channels, int) or isinstance(channels, bool) or channels not in {1, 2}:
            errors.append(f"{file_location}.channels: expected 1 or 2")
        if loop_end is not None and duration is not None and loop_end > duration + 0.001:
            errors.append(f"{location}.loop.end_seconds: exceeds {file_location} duration")

        candidate = (asset_root / Path(*pure_path.parts)).resolve()
        try:
            candidate.relative_to(asset_root)
        except ValueError:
            errors.append(f"{file_location}.path: resolves outside the asset root")
        else:
            if not candidate.is_file():
                errors.append(f"{file_location}.path: file not found below asset root")
            else:
                if isinstance(declared_bytes, int) and candidate.stat().st_size != declared_bytes:
                    errors.append(f"{file_location}.bytes: does not match the file size")
                if final_sha and _hash_file(candidate) != final_sha:
                    errors.append(f"{file_location}.sha256: does not match the file contents")

        runtime_files.append(
            {
                "bytes": declared_bytes,
                "channels": channels,
                "durationSeconds": duration,
                "integratedLufs": integrated_lufs,
                "mimeType": mime_type,
                "path": relative_path,
                "sampleRateHz": sample_rate,
                "sha256": final_sha,
                "truePeakDbtp": true_peak,
            }
        )

    return {
        "attribution": {
            "placement": attribution_placement,
            "required": attribution_required,
            "text": attribution_text,
        },
        "creator": {"name": creator_name, "url": creator_url},
        "description": description,
        "files": sorted(runtime_files, key=lambda entry: (str(entry["mimeType"]), str(entry["path"]))),
        "id": asset_id,
        "kind": kind,
        "license": {"checkedOn": checked_on, "name": license_name, "url": license_url},
        "loop": {
            "enabled": loop_enabled,
            "endSeconds": loop_end,
            "notes": loop_notes,
            "seamTested": seam_tested,
            "startSeconds": loop_start,
        },
        "qc": {
            "auditioned": auditioned,
            "notes": qc_notes,
            "targetLufs": target_lufs,
            "toleranceLu": tolerance_lu,
        },
        "redistribution": {"notes": redistribution_notes, "status": redistribution_status},
        "role": role,
        "sourcePageUrl": source_page_url,
        "tags": sorted(clean_tags),
        "title": title,
    }


def build_catalog(manifest: Any, asset_root: Path) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    if not isinstance(manifest, dict):
        return {"catalogVersion": 1, "assets": []}, ["manifest: expected a JSON object"]
    if manifest.get("schema_version") != 1:
        errors.append("schema_version: expected 1")
    assets = manifest.get("assets")
    if not isinstance(assets, list) or not assets:
        errors.append("assets: expected a non-empty array")
        assets = []

    resolved_root = asset_root.resolve()
    runtime_assets: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_paths: set[str] = set()
    for index, asset in enumerate(assets):
        runtime_assets.append(
            _runtime_asset(asset, index, resolved_root, seen_ids, seen_paths, errors)
        )
    return {
        "catalogVersion": 1,
        "assets": sorted(runtime_assets, key=lambda entry: str(entry["id"])),
    }, errors


def render_catalog(catalog: dict[str, Any]) -> str:
    return json.dumps(catalog, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, help="Path to the hand-authored audit manifest")
    parser.add_argument("--asset-root", required=True, type=Path, help="Root for manifest file paths")
    output = parser.add_mutually_exclusive_group()
    output.add_argument("--output", type=Path, help="Write the deterministic runtime catalog")
    output.add_argument("--check-catalog", type=Path, help="Fail unless this catalog is current")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"error: cannot read manifest: {error}", file=sys.stderr)
        return 2

    catalog, errors = build_catalog(manifest, args.asset_root)
    if errors:
        for error in errors:
            print(f"error: {error}", file=sys.stderr)
        print(f"validation failed with {len(errors)} error(s)", file=sys.stderr)
        return 1

    rendered = render_catalog(catalog)
    if args.check_catalog:
        try:
            current = args.check_catalog.read_text(encoding="utf-8")
        except OSError as error:
            print(f"error: cannot read catalog: {error}", file=sys.stderr)
            return 2
        if current != rendered:
            print(f"error: catalog is stale: {args.check_catalog}", file=sys.stderr)
            return 1
        print(f"validated {len(catalog['assets'])} asset(s); catalog is current")
        return 0

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"validated {len(catalog['assets'])} asset(s); wrote {args.output}")
    else:
        sys.stdout.write(rendered)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
