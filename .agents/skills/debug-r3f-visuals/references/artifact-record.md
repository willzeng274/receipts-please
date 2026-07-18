# Visual QA artifact record

Use this structure for `report.md`. Keep artifact links relative to the run directory so the folder remains portable.

```markdown
# R3F visual QA report

## Outcome

- Result: PASS | FAIL | PARTIAL
- Scope: <game routes, lab routes, requested defect/fix>
- Artifact root: <path>
- Started/finished UTC: <timestamps>
- Tester: Codex using Chrome extension browser

## Environment

- Commit and dirty state: <sha; summary>
- Server command/type and URL: <development or production-like; URL>
- Chrome version/platform: <actual>
- Browser viewport/DPR baseline: <actual>
- WebGL version/GPU renderer: <safe observable value>
- R3F/Three version: <package values>
- Quality/effect flags: <values>
- Motion preference: <normal/reduce>

Raw environment: [environment.json](environment.json)

## Readiness condition

- Ready signal: <what proved the route was ready>
- Timeout: <seconds>
- Determinism: <pause/seed/preset or limitation>

## Findings

| ID | Priority | Result | Route/state | Viewport/DPR | Camera/variant | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-001 | P1 | OPEN | ... | ... | ... | [before](screenshots/...) |

### VIS-001 — <short symptom>

- Reproduction: <numbered exact actions>
- Expected: <observable result>
- Actual: <observable result>
- Console/network correlation: <message or none>
- Suspected root cause: <hypothesis and confidence; distinguish from symptom>
- Fix: <only when authorized and implemented>
- Verification: <two reruns and regression rows>
- Evidence: [before](screenshots/...), [after](screenshots/...)

## Matrix results

| Case | Route/state | Viewport/DPR | Camera/effects | Interaction | Screenshot | Console/network | Result/notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Performance

| Scenario | Samples | Median | p95 | p99 | Worst | >33.3 ms | >50 ms | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |

Raw measurements: [performance.json](performance.json)

## Resilience and accessibility

| Case | Result | Evidence/limitation |
| --- | --- | --- |
| WebGL normal | ... | ... |
| WebGL1/low-quality | ... | ... |
| Context loss/restoration | ... | ... |
| WebGL unavailable/creation failure | ... | ... |
| Reduced motion and return to normal | ... | ... |

## Error evidence

- Console/page errors: [console.txt](console.txt)
- Failed/critical requests: [network.txt](network.txt)
- Server log: <path or none>

## Not run and residual risk

- <case>: NOT RUN — <concrete reason and impact>

## Verification commands

- `<command>` — PASS | FAIL

## Final coverage statement

<State exactly which viewport, camera, lab, interaction, performance, fallback, and motion families passed; avoid "fully verified" when any required family is not run.>
```

Also create machine-readable `environment.json` and `performance.json`. Use `null` plus a `reason` field for unobtainable values; do not invent numbers.

Recommended `environment.json` keys:

```json
{
  "timestampUtc": "",
  "commit": "",
  "dirty": null,
  "url": "",
  "serverMode": "",
  "browserVersion": "",
  "platform": "",
  "viewport": { "width": 0, "height": 0, "dpr": 0 },
  "canvas": { "cssWidth": 0, "cssHeight": 0, "bufferWidth": 0, "bufferHeight": 0 },
  "webgl": { "version": "", "renderer": "", "contextLost": false },
  "camera": {},
  "quality": {},
  "motionPreference": "",
  "notes": []
}
```

Recommended `performance.json` keys:

```json
{
  "warmupMs": 0,
  "sampleDurationMs": 0,
  "refreshRateAssumptionHz": null,
  "scenarios": [
    {
      "name": "",
      "viewport": "",
      "sampleCount": 0,
      "medianFrameMs": null,
      "p95FrameMs": null,
      "p99FrameMs": null,
      "worstFrameMs": null,
      "over33_3Ms": 0,
      "over50Ms": 0,
      "notes": []
    }
  ]
}
```

In `console.txt` and `network.txt`, preserve chronological order, severity/status, route, matrix case, and timestamp. Redact tokens or user data if any appear in browser output.
