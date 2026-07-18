# Rights, manifest, and quality controls

## Rights acceptance rules

Require all of the following before downloading or integrating an asset:

- Identify the creator or publishing entity from its canonical page.
- Link `source.page_url` to the canonical asset page and `source.download_url` to the exact retrieved file.
- Link `license.url` to the primary license text maintained by the licensor or license steward.
- Record the license name/version and the ISO date on which its terms were checked.
- State whether attribution is required. Record meaningful text and placement even when it is not required, for example `No attribution required; creator shown voluntarily in the Audio Gallery.`
- State whether redistribution is `allowed` or `restricted`, plus notes explaining why shipping the encoded file inside the game bundle is permitted.
- Confirm that editing, normalization, looping, and format conversion are allowed.

Reject the candidate when any of these facts cannot be established. In particular, reject ripped commercial-game audio, soundtrack uploads, stream/video conversions, reposts without provenance, “free” assets without terms, licenses limited to personal use when commercial use is possible, and assets that prohibit the intended browser distribution. Treat noncommercial, no-derivatives, share-alike, marketplace, and bespoke licenses as requiring project-specific review rather than assumptions.

Do not infer permission from technical download access. Do not replace a primary source/license URL with a search results page, CDN URL alone, or third-party license summary.

## Audit manifest schema

Store UTF-8 JSON with `schema_version: 1` and an `assets` array. Use stable lowercase hyphenated IDs. Keep manifest paths POSIX-style and relative to the asset root.

```json
{
  "schema_version": 1,
  "assets": [
    {
      "id": "receipt-stamp",
      "kind": "sfx",
      "title": "Receipt Stamp",
      "description": "Short paper-and-stamp confirmation cue.",
      "role": "successful receipt validation",
      "tags": ["confirmation", "paper"],
      "creator": {
        "name": "Example Creator",
        "url": "https://creator.example/audio"
      },
      "source": {
        "page_url": "https://library.example/assets/receipt-stamp",
        "download_url": "https://library.example/downloads/receipt-stamp.wav",
        "original_filename": "receipt_stamp_24bit.wav",
        "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      },
      "license": {
        "name": "CC BY 4.0",
        "url": "https://creativecommons.org/licenses/by/4.0/",
        "checked_on": "2026-07-18"
      },
      "attribution": {
        "required": true,
        "text": "Receipt Stamp by Example Creator, licensed CC BY 4.0.",
        "placement": "In-app Audio Gallery and distributed credits"
      },
      "redistribution": {
        "status": "allowed",
        "notes": "May be redistributed, including in an adapted browser-game bundle, with attribution."
      },
      "processing": {
        "tool": "ffmpeg 8.0",
        "command": "ffmpeg -i receipt_stamp_24bit.wav -af loudnorm=... -ar 48000 receipt-stamp.wav"
      },
      "qc": {
        "auditioned": true,
        "target_lufs": -16.0,
        "tolerance_lu": 3.0,
        "notes": "Auditioned through the game SFX bus at 25%, 50%, and 100%."
      },
      "loop": {
        "enabled": false,
        "start_seconds": 0.0,
        "end_seconds": 0.82,
        "seam_tested": false,
        "notes": "One-shot cue; no loop intended."
      },
      "files": [
        {
          "path": "sfx/receipt-stamp--bbbbbbbbbbbb.ogg",
          "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          "bytes": 18234,
          "mime_type": "audio/ogg",
          "duration_seconds": 0.82,
          "integrated_lufs": -15.4,
          "true_peak_dbtp": -1.2,
          "sample_rate_hz": 48000,
          "channels": 1
        }
      ]
    }
  ]
}
```

The catalog script requires every field shown. It accepts `.mp3`, `.ogg`, `.webm`, `.wav`, and `.m4a` with matching MIME types. It rejects duplicate IDs/paths, unsafe paths, noncanonical filenames, missing files, incorrect byte counts or hashes, implausible measurements, loudness outside the declared target/tolerance, peaks above `-1 dBFS`, unlistened assets, and enabled loops without a tested seam.

The generated runtime catalog intentionally omits direct download URLs, original hashes, and processing commands. Preserve the audit manifest in version control when its license metadata permits doing so; it is the provenance record. Expose source-page and primary license links from the runtime catalog in the Audio Gallery.

## Quality-control procedure

1. Measure the final encoded file. Avoid copying measurements from a WAV master to a compressed derivative.
2. Use integrated LUFS as a repeatable mix baseline, not a substitute for listening. For extremely short SFX, retain the measured result and use a deliberately wider documented tolerance if necessary.
3. Keep true peak at or below `-1 dBTP` unless the project has a stricter ceiling.
4. Compare related cues for perceived level, transient harshness, masking, and repetition fatigue.
5. Test music/SFX buses at minimum, normal, and maximum settings and with the game's mute/resume behavior.
6. Test enabled loops through at least five seams in the browser and after tab suspension/resume.
7. Re-run the catalog validator after any re-encode; a content change must produce a new hash-derived filename and updated measurements.
