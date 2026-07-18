# Model quality gates

Use these as review thresholds for the browser vertical slice. Visual and interaction quality remain the deciding criteria.

## Blocking gates

- Readable silhouette from player, inspection, profile, and overview cameras.
- Real-world meter scale, documented forward/up axes, applied transforms, grounded base, useful origin, and correct moving-part pivots.
- Beveled or rounded highlight behavior on manufactured edges; no unintended faceting at inspection distance.
- At least two materially distinct surface responses when the object has multiple real materials.
- No z-fighting, broken normals, missing textures, shadow acne, floating contact, accidental clipping, or unstable reset.
- Interaction animation has anticipation, contact, secondary motion, and settle. Idle motion does not drift.
- Reduced motion preserves the state change and interaction result.
- Source, author, license, modifications, and asset status are recorded.

## Soft browser budgets

| Asset class | Triangles | Draw calls | Runtime textures | Runtime GLB |
| --- | ---: | ---: | ---: | ---: |
| Small interactive prop | 8k–35k | ≤ 18 | ≤ 4 × 2K | ≤ 3 MB |
| Hero desk mechanism | 25k–90k | ≤ 28 | ≤ 8 × 2K | ≤ 8 MB |
| Reusable office furniture | 12k–50k | ≤ 16 | ≤ 5 × 2K | ≤ 5 MB |
| Upper-body character | 45k–110k | ≤ 24 | ≤ 8 × 2K | ≤ 10 MB |
| Giraffe hero reveal | 70k–160k | ≤ 28 | ≤ 10; one 4K allowed | ≤ 15 MB |

Exceeding a threshold requires a recorded reason and a stable lab frame-time check. Falling far below it is not an achievement if curves, joints, shading, or close-up details look weak.

## Animation review

- Begin and end clips on intentional poses; remove dead frames.
- Keep loop seams invisible and root transforms stable unless root motion is required.
- Test action crossfades at 0.15, 0.3, and 0.5 seconds.
- Verify rapid retrigger, mid-clip interruption, and exact reset.
- Keep important mechanical motion on physically plausible axes.
- Add asymmetry and secondary motion where it improves weight; avoid universal bounce.

## Screenshot matrix

Capture at 1440×900 and 390×844:

1. inspection camera / studio light;
2. player camera / manual light;
3. profile camera / Ramp light;
4. overview camera / night light;
5. peak interaction frame;
6. settled interaction frame.

Reject the asset if the screenshot only looks convincing from one preferred angle.
