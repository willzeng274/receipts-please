---
name: debug-r3f-visuals
description: Diagnose and verify layout, camera framing, 3D assets, shaders, postprocessing, animation, interaction, responsive behavior, WebGL resilience, and frame performance in the receipts_please React Three Fiber browser game and its asset/effects lab. Use for visual mismatches, clipping, blank canvases, bad DPR or resizing, broken raycasts, asset/effect regressions, motion-accessibility issues, slow frames, or end-to-end visual QA after R3F changes; require Chrome evidence and recorded artifacts.
---

# Debug R3F Visuals

Treat the repository as a monorepo. The application root is `control-desk/`; inspect and run the Bun/Vite project there. Keep this skill, project instructions, the design brief, and `.codex/` evidence at the repository root.

## Operating contract

Use source inspection to form hypotheses, then prove or disprove them in the running app. Do not declare a visual issue fixed from code, types, or a production build alone.

Before any browser action, load and follow the installed `chrome:control-chrome` (`control-chrome`) skill completely. Treat use of this project skill as an explicit choice of Chrome for the QA phase. Select the Chrome extension browser, read its complete runtime documentation, and use only its documented browser-client and in-skill Playwright APIs. Do not substitute the in-app browser, standalone Playwright, Computer Use, or command-line screenshot tools.

Keep diagnosis and mutation separate:

- For review or diagnosis, inspect and report without editing application code.
- For an authorized fix, capture the failing baseline first, make the smallest relevant change, and repeat the failed cases plus the smoke matrix.
- Never install packages, alter dependencies, or change project configuration merely to make QA easier without approval.
- Report an unavailable route, lab, fixture, browser capability, or fallback as `NOT RUN` with the reason. Never infer a pass.

Read [references/qa-matrix.md](references/qa-matrix.md) before executing a visual pass. Use [references/artifact-record.md](references/artifact-record.md) to record the run.

## 1. Establish the test surface

1. Inspect `control-desk/package.json`, `control-desk/bun.lock`, application entry points, routes, game-state stores, R3F `Canvas` setup, cameras, controls, loaders, effects, shaders, responsive rules, and the asset/effects lab.
2. Identify the canonical game route and every lab route or lab mode. Inventory meaningful visual states: boot/loading, default, active play, paused/modal, success/failure, and isolated asset/effect variants. Adapt this list to what exists; do not invent routes or controls.
3. Identify camera modes and responsive branches. Record camera type, FOV or orthographic bounds, near/far planes, position/target, Canvas DPR policy, tone mapping, color space, shadows, postprocessing, and any quality tier when observable.
4. Reuse a healthy server that belongs to this workspace. Otherwise start the declared development command from `control-desk/` with Bun, capture its URL and logs, and keep it alive for the run. Do not silently replace the declared workflow.
5. Record the commit, dirty state, browser version, URL, feature flags, timestamp, and whether the server is development or production-like.

If the asset/effects lab does not exist yet or cannot be reached from the current checkout, continue with the game route and mark lab coverage as `NOT RUN`.

## 2. Create an evidence directory

Use a user-specified destination when provided. Otherwise create root `.codex/artifacts/r3f-visual-qa/<UTC-YYYYMMDDTHHMMSSZ>/` and keep all generated QA evidence there. Do not place artifacts in `control-desk/src/`, `control-desk/public/`, or asset directories.

Create:

```text
report.md
environment.json
console.txt
network.txt
performance.json
screenshots/
```

Use stable screenshot names: `<route>__<state>__<viewport>__<camera>__<variant>__before|after.png`. Sanitize separators rather than losing identifying data. Keep baseline and post-fix images; never overwrite them.

## 3. Run the canonical baseline

1. Open the canonical game URL in Chrome at `1440x900`, normal motion, the app's default quality, and the default camera.
2. Start console and page-error collection before navigating or reloading so boot failures are not missed. Clear unrelated historical entries, then perform a clean reload using the Chrome skill's documented APIs.
3. Wait for an explicit ready condition: the loading UI has completed, required fonts have loaded, critical resources have settled, the Canvas has nonzero dimensions, and the intended scene is visibly rendered. Use a bounded wait and record timeouts.
4. Record the Canvas CSS bounds and backing-buffer width/height, effective pixel ratio, visible camera parameters, WebGL/WebGL2 status, GPU renderer string when exposed safely, effect stack, and quality tier. Avoid relying on private R3F internals when public scene or renderer data is available.
5. Capture a full-viewport screenshot and, when it reveals useful detail, a tight Canvas or lab-panel screenshot. Inspect the returned pixels visually; taking a screenshot is not itself validation.
6. Check composition, crop and safe areas, occlusion, UI/canvas stacking, transparency, geometry/material readiness, lighting, shadows, tone mapping, banding, aliasing, z-fighting, particles, trails, bloom, depth effects, and text legibility.
7. Save console, page error, failed-request, and server-log evidence. Treat shader compile/link errors, WebGL warnings, context loss, uncaught exceptions, rejected promises, and missing critical assets as failures unless proven benign.

## 4. Execute the viewport and camera matrix

Run the core matrix in [references/qa-matrix.md](references/qa-matrix.md). Add rows for project-specific breakpoints, camera modes, lab variants, and reported repro dimensions. Do not prune a row solely because the first cases look correct.

For every row, follow the same loop:

1. Set the viewport, device scale behavior, color/motion media state, route, game state, camera, and effect variant.
2. Reload when responsive logic or capability selection occurs at initialization.
3. Wait for the same deterministic ready condition. If animation prevents a stable pose, use an existing pause/debug control; otherwise capture a short named sequence at consistent elapsed times and record the limitation.
4. Exercise the row's primary interaction before capture when the state depends on hover, pointer, touch, drag, keyboard, or lab controls.
5. Capture and visually inspect the screenshot. Compare it with the adjacent breakpoint/state and any supplied reference, accounting for intentional responsive composition.
6. Query new console/page errors and failed requests since the prior row.
7. Record actual viewport, Canvas CSS/backing size, DPR, camera data, state, screenshot path, result, and notes immediately.

Verify resize behavior in place as well as on fresh load. Cross a responsive breakpoint in both directions and confirm the camera aspect/projection, renderer size, postprocessing buffers, pointer mapping, and overlays update without stretching, stale pixels, or cumulative drift.

## 5. Verify interactions and lab controls

Use real pointer and keyboard actions through Chrome, not direct handler invocation.

- Verify hover/click/tap raycasts at the center and near Canvas edges after every representative resize. Confirm the visible object and the hit target agree.
- Verify drag/orbit/pan/zoom only where intended; confirm limits, camera target, and reset behavior. Ensure controls do not trap scrolling or steal clicks from overlay UI.
- Verify keyboard movement/actions, focus entry/exit, repeated input, and blur recovery. Confirm focus rings and instructions remain usable over the Canvas.
- Verify touch-sized controls and representative single-pointer gestures at mobile widths. Record unsupported multi-touch automation rather than approximating it.
- Verify pause, modal, restart, route transitions, and rapid repeat actions for duplicate objects, stale effects, frozen input, or state leakage.
- In the asset/effects lab, change one control at a time, then combinations at minimum/default/maximum values. Verify reset/default, asset switching, effect enable/disable, camera presets, and control values match the pixels.
- Treat every visible button, link, select, checkbox, file input, and model hit target as a required interaction. Exercise it through Chrome and verify both state and pixels; do not infer functionality from an attached React handler.
- For every registered model, orbit to front, rear, left, right, high three-quarter, and low three-quarter views. Replay all shared effects in its solo `/animation-lab` sequence and any combined sequence that uses it. Detached labels, buried controls, floating subassemblies, penetrations, broken transparent covers, parent/child drift, or reset residue are failures even when the default camera passes.
- In `/scene-lab`, verify the complete assembly from operator, overview, profile, and free-orbit views under every lighting preset. Check desktop contact, realistic world scale, occlusion, legroom, camera collision/framing, and whether all intended controls remain reachable over the Canvas.

Capture the state before and after each failing interaction and include exact reproduction steps.

## 6. Measure frames and resource stability

Measure rather than judge smoothness by eye. Use the Chrome skill's documented page-evaluation and performance facilities.

1. Measure at least `idle`, `typical interaction`, and `stress/lab maximum` scenarios at `1440x900`; repeat the most expensive supported mobile row.
2. Allow a warm-up period, then sample `requestAnimationFrame` deltas for at least 10 seconds. Record sample count, median, p95, p99, worst frame, frames over 33.3 ms and 50 ms, and the display refresh rate assumption. Do not promise 60 FPS on a non-60 Hz display.
3. Record long tasks, resource failures, unexpected reloads, and renderer/context events when the documented API exposes them. Use a Chrome performance trace only when available and warranted by a regression.
4. Repeat the same scripted action and duration for before/after comparisons. Separate shader compilation or initial asset upload from steady-state results, but report both.
5. Watch for runaway scene children, repeated listeners, duplicate render loops, rising draw calls/triangles/textures, or memory growth using existing debug/perf surfaces or public renderer info. Do not add permanent instrumentation unless the requested fix requires it.
6. Treat measurements as diagnostic evidence, not universal budgets. Compare against project targets when defined; otherwise flag severe long frames, persistent jank, and material regressions with the raw data.

## 7. Verify WebGL and motion resilience

Run every supported fallback row from [references/qa-matrix.md](references/qa-matrix.md).

- Confirm capability detection and the normal WebGL2 path.
- Exercise WebGL1 or a reduced-quality path only if the app or test surface supports it.
- Use `WEBGL_lose_context` through documented page evaluation when available to test loss and restoration. Verify a user-visible fallback/recovery path, no error storm, and no duplicated scene after restoration.
- Test context-creation failure or WebGL-unavailable behavior through an existing app/debug hook or a Chrome-supported pre-navigation override. If neither exists, record `NOT RUN`; do not monkey-patch after initialization and call it valid.
- Emulate `prefers-reduced-motion: reduce` with Chrome's documented media controls, reload, and rerun the core interaction path. Verify essential state feedback remains, indefinite/decorative motion is reduced, camera movement is not disorienting, and controls stay functional.
- Return to normal motion and verify the preference change does not leave stale animation or renderer state.

## 8. Triage and close the loop

Classify each finding:

- `P0`: unusable or unsafe for nearly everyone, such as a blank/crashing game.
- `P1`: core interaction, route, or major viewport is broken.
- `P2`: meaningful visual, lab, fallback, accessibility, or performance defect with a workaround.
- `P3`: minor polish issue with limited impact.

For each finding, include route/state, exact viewport and DPR, camera/effect state, steps, expected versus actual, screenshot/log evidence, console correlation, and confidence. Distinguish root cause from visible symptom.

After an authorized fix:

1. Rerun the exact reproduction until it passes twice without reload-sensitive variance.
2. Rerun the canonical baseline, smoke viewport/camera matrix, console/error gate, representative interaction, reduced-motion check, and relevant performance/fallback row.
3. Run the repository's normal static checks and build in proportion to the change.
4. Complete `report.md` from [references/artifact-record.md](references/artifact-record.md), link every artifact with a relative path, and list all `NOT RUN` or unverified areas.
5. Summarize outcome, fixes (if authorized), remaining findings, test coverage, and artifact directory. Never claim full visual QA when any required matrix family was skipped.
