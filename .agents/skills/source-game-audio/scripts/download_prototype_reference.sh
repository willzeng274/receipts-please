#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <cue-id> <canonical-video-url> <source-only-output-dir>" >&2
  exit 64
fi

cue_id="$1"
source_url="$2"
output_dir="$3"

if [[ ! "$cue_id" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "cue-id must use lowercase letters, digits, and hyphens" >&2
  exit 64
fi

if [[ "$source_url" != https://* && "$source_url" != http://* ]]; then
  echo "canonical-video-url must be an http(s) URL" >&2
  exit 64
fi

command -v yt-dlp >/dev/null || { echo "yt-dlp is required" >&2; exit 69; }
mkdir -p "$output_dir"

yt-dlp \
  --extract-audio \
  --audio-format wav \
  --audio-quality 0 \
  --no-playlist \
  --restrict-filenames \
  --write-info-json \
  --output "$output_dir/$cue_id.%(ext)s" \
  "$source_url"

echo "prototype-only: keep the WAV and info JSON out of redistributed builds until cleared"
