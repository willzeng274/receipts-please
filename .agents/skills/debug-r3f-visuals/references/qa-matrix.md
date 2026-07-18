# R3F visual QA matrix

Use this reference to choose explicit cases. Run all core rows unless the route cannot render at that size. Add project breakpoints and reported repro dimensions; record skipped rows as `NOT RUN`.

## Viewport core

| ID | CSS viewport | Device behavior | Primary purpose |
| --- | ---: | --- | --- |
| `phone-small` | 320x568 | touch-sized layout; high-DPR policy | minimum supported width, safe areas, legibility, crop |
| `phone` | 390x844 | portrait; high-DPR policy | common mobile composition and controls |
| `phone-landscape` | 844x390 | landscape; high-DPR policy | short-height camera crop, HUD collision, rotation |
| `tablet-portrait` | 768x1024 | touch-sized layout; medium/high DPR | breakpoint transitions and panel fit |
| `tablet-landscape` | 1024x768 | touch/desktop boundary | camera aspect, overlay reflow, raycast mapping |
| `laptop` | 1280x720 | DPR 1 when emulation permits | short desktop height and effect cost |
| `desktop` | 1440x900 | browser-native DPR | canonical baseline |
| `desktop-hd` | 1920x1080 | DPR 1 when emulation permits | backing buffer, wide framing, postprocessing |
| `ultrawide` | 2560x1080 | DPR 1 when emulation permits | horizontal overexposure, camera/frustum edges |

Do not claim a physical DPR that Chrome did not actually apply. Record CSS viewport, `window.devicePixelRatio`, Canvas CSS bounds, and Canvas backing-buffer size. When Chrome cannot emulate a requested DPR in the existing profile, test the CSS viewport and mark DPR coverage separately.

## Camera and scene-state axes

Cross every core viewport with the default camera and default ready state. Then use pairwise coverage for other axes so each variant appears at narrow, canonical, and wide/aspect-stress sizes.

| Axis | Required values when present |
| --- | --- |
| Camera | default; each gameplay camera; lab inspect/orbit; min/max allowed zoom or FOV; reset state |
| Lifecycle | initial loading; first ready frame; stable idle; active play; paused/modal; route leave/return |
| Gameplay | default; densest representative state; success/failure or equivalent terminal states |
| Lab asset | smallest bounds; largest bounds; transparent; emissive; skinned/animated; missing/error fixture if provided |
| Effects | all off; defaults; each effect isolated; supported maximum combination; reset |
| Quality | default; low/fallback; high, when selectable |
| Motion | normal; `prefers-reduced-motion: reduce` |

For perspective cameras, record FOV, aspect, near/far, position, rotation/quaternion, and controls target when public. For orthographic cameras, record left/right/top/bottom, zoom, near/far, transform, and target. Confirm projection updates after resize and no object disappears from near/far clipping unexpectedly.

## Minimum smoke cross-product

Run this table after every authorized visual fix in addition to the exact reproduction.

| Viewport | Camera/state | Variant | Required checks |
| --- | --- | --- | --- |
| 390x844 | default/ready | default effects | screenshot, console, primary tap, reduced motion |
| 844x390 | default/active | default effects | crop, HUD, resize/raycast |
| 1024x768 | default/ready | default effects | breakpoint in both directions, pointer edge |
| 1440x900 | default/ready | default effects | full baseline, keyboard/pointer, steady frames |
| 1440x900 | lab inspect | effects off/on | control accuracy, isolated screenshots, frames |
| 2560x1080 | default/active | default effects | wide framing, overlay anchors, edge raycast |

If no lab route exists, mark both lab checks and effect-isolation coverage `NOT RUN` rather than substituting the game route.

## Screenshot loop

For each case:

1. Apply viewport/media/camera/state/variant and reload if initialization reads them.
2. Wait for the named ready condition with a finite timeout.
3. Record actual dimensions, DPR, camera, state, renderer capability, and effect/quality settings.
4. Perform the representative interaction using real input.
5. Capture the whole viewport; add a Canvas crop or detail only when it improves evidence.
6. Inspect for blank/partial frames, stretching, crop, clipping, overflow, occlusion, stale buffers, z-fighting, aliasing, shadow defects, color/tone inconsistency, excessive effects, and unreadable UI.
7. Compare adjacent breakpoint/state images and any supplied reference.
8. Collect new console/page/network failures and record `PASS`, `FAIL`, or `NOT RUN` immediately.

Capture stable poses. Prefer an existing pause, seed, camera preset, or lab reset. If none exists, use consistent elapsed checkpoints such as `t+0s`, `t+1s`, and `t+3s`, name them, and avoid pixel-difference claims.

## Console and network gate

Collect from before navigation through interaction completion:

- uncaught exceptions and unhandled promise rejections;
- React errors and error-boundary output;
- shader compile/link diagnostics and WebGL invalid-operation warnings;
- WebGL context loss/restoration and repeated fallback messages;
- failed or canceled critical GLTF/GLB, texture, HDRI, font, audio, worker, and shader requests;
- CORS, decode, MIME, and path/case failures;
- repeated loader retries, duplicate fetches, or error storms caused by interaction;
- dev-server errors that correlate with a visible failure.

Preserve exact messages and timestamps. Note known benign warnings separately with evidence; do not suppress them merely to make the gate green.

## Interaction matrix

| Input | Minimum cases |
| --- | --- |
| Pointer | hover and activate center object; activate near each Canvas edge; overlay click; outside-Canvas click |
| Drag/controls | intended drag/orbit/pan; limit; reset; release outside Canvas; overlay conflict |
| Keyboard | primary actions; movement if present; focus/blur; repeat; pause/modal; Escape if supported |
| Touch proxy | primary tap; control target sizes; representative single-pointer gesture at mobile width |
| Resize | drag/cross breakpoint both directions; rotate portrait/landscape; repeat after interaction |
| State | pause/resume; restart; rapid repeat; route/lab enter-leave-return; asset/effect switch/reset |

Validate pixels and state together. A changed label without the matching visual effect, or a visual reaction from the wrong hit target, is a failure.

## Frame and stability matrix

Measure after warm-up for at least 10 seconds per scenario, using identical scripted actions for comparisons.

| Scenario | Viewport | Workload |
| --- | --- | --- |
| Idle | 1440x900 | no input after ready |
| Typical | 1440x900 | repeat core gameplay interaction |
| Stress | 1440x900 | densest gameplay or lab maximum |
| Mobile expensive | 390x844 or worst supported mobile row | typical plus default effects |

Record rAF sample count, median/p95/p99/worst delta, counts over 33.3 ms and 50 ms, display refresh assumption, warm-up duration, renderer/quality data when public, and startup-versus-steady-state distinction. Record trace paths if a trace is captured.

## WebGL and accessibility fallbacks

| Case | Procedure | Pass evidence |
| --- | --- | --- |
| Normal | detect actual WebGL/WebGL2 after ready | scene visible; renderer/capability recorded; no errors |
| WebGL1/low quality | use app-supported selector or fixture | usable scene or explicit supported fallback; settings accurate |
| Context loss/restore | use `WEBGL_lose_context` when exposed, then restore | message/fallback; recovery; no duplicate scene or error storm |
| Creation failure | use existing hook or Chrome-supported pre-navigation override | useful non-canvas UI/fallback; no crash loop |
| Reduced motion | emulate `reduce`, reload, repeat core path, return to normal | less nonessential motion; essential feedback and input preserved |

Do not fake WebGL1 by changing a label, simulate creation failure after the renderer already exists, or call a fallback passed when the browser could not exercise it. Use `NOT RUN` with a concrete limitation.
