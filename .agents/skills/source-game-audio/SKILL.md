---
name: source-game-audio
description: Source, license, download, normalize, loop, catalog, validate, and preview music and sound effects for browser games. Use when Codex needs to find game audio, assess whether an asset may be shipped, prepare browser-ready audio files, create or audit audio provenance metadata, perform loudness or loop quality control, wire audio into a web game, or build an in-app audio/credits gallery.
---

# Source Game Audio

Build a traceable audio pipeline from an approved source page to tested browser playback. Treat rights evidence, processing reproducibility, and the in-app gallery as part of the deliverable.

Treat the repository as a monorepo. Keep this skill and source-only audit tooling at the repository root; the browser application and all runtime audio live under `control-desk/`. Run the catalog commands below from the repository root and Bun commands from `control-desk/`.

## Choose the operating lane

- Use the **prototype lane** for local hackathon exploration. A YouTube or other stream reference may be acquired with `yt-dlp` when speed matters. Record its canonical page URL, title, uploader, acquisition date, exact command, and `distribution: prototype-only`; keep it out of any public or submission bundle until cleared.
- Use the **shipping lane** for anything redistributed in a deployed build. Follow every source, license, processing, catalog, and attribution gate below.
- Never silently promote a prototype-lane file to shipping. The audio lab must show the lane and redistribution state.

## Establish the brief

1. Inspect the game, its existing audio code, public asset conventions, build system, and credits UI.
2. List each required cue with `kind` (`music` or `sfx`), gameplay event, mood, approximate duration, loop behavior, and priority.
3. Prefer a small coherent palette over many near-duplicate clips. Avoid adding dependencies solely for preview playback when native browser audio is sufficient.

## Source and clear candidates

1. Search creator pages, publisher libraries, and established audio repositories.
2. Open the canonical asset page and the primary license text. Never treat a search result, repost, video description, or aggregator summary as rights evidence.
3. Read [rights-and-qc.md](references/rights-and-qc.md) before accepting a candidate or writing its manifest entry.
4. Reject game/movie rips, converted streams, social-media reposts, unlabeled files, AI outputs without clear output rights, and any asset whose creator, license, or redistribution permission is unclear.
5. Record the canonical source page URL, direct download URL, primary license URL, creator URL, license check date, exact attribution text, attribution placement, and explicit redistribution notes before integration.
6. Accept only assets whose redistribution status is `allowed` or `restricted` with notes confirming that distribution inside this game's browser bundle is permitted. Do not ship an asset marked forbidden or unknown.

## Download reproducibly

1. Download to a temporary or source-only location without overwriting an existing file. Preserve the original filename in metadata.
2. For a shipping-lane direct file, use a reproducible command such as `curl --fail --location --retry 3 --output <original-name> <direct-download-url>`.
3. For a prototype-lane video reference, use the project wrapper so the command, naming, metadata sidecar, and no-playlist behavior stay consistent: `.agents/skills/source-game-audio/scripts/download_prototype_reference.sh <cue-id> <canonical-video-url> <source-only-output-dir>`. Keep the generated info JSON beside the source-only file until its catalog entry is created.
4. Hash the untouched download with `shasum -a 256 <file>`. Record the lowercase SHA-256, exact download URL, and original filename in the audit manifest.
5. Keep an original only when its license and repository policy permit doing so. Never commit a source archive merely for convenience.

## Normalize and encode

1. Work from the hashed original and keep the complete processing command in `processing.command`, including filters and encoder settings. Record the tool and version in `processing.tool`.
2. Use a two-pass EBU R128 `loudnorm` workflow with FFmpeg when available. Start near `-18 LUFS` for music and `-16 LUFS` for SFX, with a true-peak ceiling of `-1 dBTP`; adjust deliberately for the game's mix.
3. Preserve musical dynamics. Trim unwanted silence and noise without cutting intended attacks or reverb tails.
4. Prefer browser-ready encodes already supported by the project. Supply multiple formats only when the supported browser matrix requires them.
5. Hash every final encode, then name it `<id>--<first-12-final-sha256>.<ext>` under `music/` or `sfx/`. Do not hand-invent cache-busting suffixes.

## Verify loudness and loops

1. Measure each final encode, not only the source or intermediate master. Use `ffmpeg -filter_complex ebur128=peak=true` and `ffprobe` or equivalent tools.
2. Record duration, integrated LUFS, true peak, sample rate, channels, size, and final SHA-256 for each file.
3. Listen through the actual game playback path at representative master/music/SFX volume settings. Set `qc.auditioned` to `true` only after that check.
4. For loops, cut at musically appropriate zero crossings, record start/end seconds, and audition at least five consecutive transitions in the browser. Set `loop.seam_tested` to `true` only after confirming no click, gap, doubled beat, or ambience jump.
5. Document exceptions and subjective findings in the QC notes. Do not conceal clipping or a poor seam by widening tolerances.

## Catalog and validate

1. Maintain a hand-authored audit manifest matching the schema and example in [rights-and-qc.md](references/rights-and-qc.md).
2. Place runtime files below `control-desk/public/audio`, with manifest paths relative to that asset root.
3. Generate the deterministic runtime catalog and verify the assets:

   ```bash
   python3 .agents/skills/source-game-audio/scripts/catalog_audio.py \
     path/to/audio-manifest.json \
     --asset-root control-desk/public/audio \
     --output control-desk/src/generated/audioCatalog.json
   ```

4. Check that a committed catalog is current in CI or before handoff:

   ```bash
   python3 .agents/skills/source-game-audio/scripts/catalog_audio.py \
     path/to/audio-manifest.json \
     --asset-root control-desk/public/audio \
     --check-catalog control-desk/src/generated/audioCatalog.json
   ```

5. Fix every reported error. Never weaken or bypass the validator to admit an unclear asset.

## Integrate the in-app gallery

1. Load the generated catalog rather than duplicating audio metadata in components.
2. Add a discoverable Audio Gallery or Audio Credits surface inside the app. For each cue, show title, kind/role, creator, attribution text, license link, source-page link, and redistribution note.
3. Provide play/pause, stop, volume, and loop controls using the same playback path as the game. Allow only intentional playback; never autoplay on page load.
4. Stop the previous preview when another begins and release listeners/audio nodes on unmount. Preserve the game's mute and volume policy.
5. Use accessible native controls or labeled keyboard-operable buttons with visible focus and playback state. Make external license/source links identifiable.
6. Keep gallery playback out of scoring and game state. Gate a developer-only gallery explicitly if the product should expose credits elsewhere.
7. From `control-desk/`, run the app's lint, typecheck/build, and a browser smoke test. Confirm every catalog entry plays, loop toggles work, credits links resolve, and missing audio fails gracefully.

## Handoff

Report accepted and rejected candidates, license/attribution obligations, files and manifests added, normalization targets and measured results, loop findings, gallery location, and validation/build commands. Include unresolved rights or playback questions as blockers rather than assumptions.
