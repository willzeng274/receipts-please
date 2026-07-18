# Receipts, Please — living agent brief

This is the canonical maintained process and scope document. Update it in the same change whenever scope, architecture, tooling, or production policy changes. Do not create a second roadmap, process note, setup guide, or status Markdown file. Add another Markdown file only when a tool requires a standalone contract (for example a Codex `SKILL.md`) or the user explicitly asks for one; remove or fold stale guidance back into this file.

## Repository layout

This repository is a monorepo. Root owns coordination and durable project context: `AGENTS.md`, `receipts_please_game_design.md`, and `.agents/skills/`. The Bun/Vite/R3F application lives at `control-desk/`; run package, typecheck, lint, build, and dev-server commands from that directory. Do not add a root `package.json` merely to proxy the app. Future apps belong in sibling directories with explicit ownership rather than being mixed into `control-desk/`.

Keep local Chrome QA evidence in the root `.codex/` directory and do not commit it. Keep `node_modules/` and build output local to their application directory.

## Current scope

Build the internal R3F production tool first. The current milestone includes:

- a local Bun + Vite + React + TypeScript + Tailwind + R3F/Drei environment;
- `/model-lab` as the default route, with an orbitable/pannable/zoomable scene, overview and close cameras, lighting presets, model registry, selection, inspection framing, and performance visibility;
- `/effects-lab` (labeled **System FX**) for replaying deterministic stamp, paper, printer, migration, freeze-card, screen, object, and camera responses together;
- `/animation-lab` as a composition stage, separate from the asset register, for replaying one-model and multi-model interactions such as a stamp contacting paper, a receipt moving through a decision workflow, and a fraud response across the computer and card control;
- `/scene-lab` as an explorable desk/environment assembly with free OrbitControls, saved camera views, lighting comparisons, and the actual relative placement used by later gameplay;
- `/audio-lab` as a rights-aware audio intake/gallery surface;
- a focusable workstation-screen prototype: clicking the computer display moves into a readable OS view, mouse and keyboard input stay scoped to that OS, `Escape` and a visible close control exit, and the finance workspace demonstrates the manual-to-Ramp product transition without starting the full case loop;
- polished procedural R3F hero props plus a growing modular desk/office kit. Six assets are only the first batch, not an environment-completeness claim;
- project-local skills for model creation, audio sourcing, and Chrome visual QA.
- `/game` as the user-facing vertical slice: six manual cases, six Ramp exceptions, physical desk tools, decisions, required actions, timing, scoring, interactive migration, adaptive prototype audio, and the giraffe ending.

The current review priority is the hero workstation, decision controls, and authored camera/interaction paths. The boxed office only needs to be coherent and extensible at this milestone; do not spend hero-prop time polishing background filler that does not support a remembered moment.

The user explicitly advanced the project beyond the lab-only milestone. Keep `/game` as a thin orchestration layer over the receipt catalog, registered desk assets, effects, audio, migration state, and the existing scene. Pre-Ramp play must use fragmented records plus the physical calculator, stamps, trays, printer, and freeze control; post-Ramp play must demonstrate receipt matching, policy citations, connected travel/vendor/procurement evidence, pre-spend controls, and an exception-only queue. Freeform document physics, organic employee characters, and branching dialogue remain deferred until the vertical slice is stable.

We are not using Blender for this hackathon phase. Prefer carefully constructed procedural R3F models. Do not create a low-quality generated GLB merely to have a binary file. The installed `gltfjsx` path remains available only for a licensed, already-authored GLB that is clearly better than a procedural solution. The user has explicitly reopened the giraffe as a lab/environment asset: build a high-quality procedural head/neck/badge reveal now, while keeping organic employee characters and full ending choreography deferred.

Use sections 10–13 of the design brief as the asset backlog, in this order: finish the hero desk loop (three distinct stamps, freeze control, calculator/tape, printer, trays, computer, phone, lamp, shredder, nameplate), then the employee window and high-value office furniture/set dressing, then reusable documents and comedy props. Asset count alone is not progress; priority-A interaction silhouettes and the five remembered moments in section 23 come first.

## Product direction after the lab

This is for Ramp's Builders Cup. The later game must earn the Ramp reveal through play:

1. Let the player feel fragmented receipt matching, policy lookup, travel checking, vendor review, and inventory reconciliation.
2. Introduce Ramp at the midpoint as a smooth workflow transformation, not an opening advertisement.
3. Keep the desk, cases, and player judgment continuous while matching receipts, surfacing policy, connecting travel/vendor data, and enabling card freeze actions.
4. Use Ramp branding mainly inside the post-migration software and the transition. Product capability and relief lead; the logo confirms what the player already felt.
5. Preserve the comedy and finance-worker point of view. The contrast is broken process versus unified control, not bad people versus a perfect brand.

The approved lab prototype of that midpoint is now explicit: the manual **Expense OS** remains dark, fragmented, and stressful until it presents a Ramp migration notification. That notice has one action, **Try Ramp**. Activating it exits monitor focus, shakes the camera/world, and starts a six-step migration controller; every progress stage advances only after explicit player interaction. Finishing the sequence changes the office from dark/manual lighting to bright/Ramp lighting and briefly fades the supplied `control-desk/public/brand/low-cortisol.jpeg` image in and out. It is a payoff to the established manual workflow, never an opening ad, and the same desk, cases, and judgment remain continuous afterward.

The official white Ramp lockup lives at `control-desk/public/brand/ramp-lockup-white.svg`. It came from Ramp's official press kit; preserve its proportions and metadata, and do not imply partnership or endorsement outside the Builders Cup context.

## Working process

1. Read this entire file, the relevant project skill, and root `receipts_please_game_design.md` before acting. After any context compaction, handoff, or resumed task, explicitly re-read both this file and the full design brief before trusting a summary.
2. Keep the active milestone narrow. Register semantic asset/effect IDs before connecting later gameplay.
3. Parallelize independent assets and research. Use one fresh-context subagent per individual model; the parent agent owns integration and shared scene changes.
4. Put every asset in the lab immediately. Review silhouette, scale, materials, interaction, animation reset, lighting, camera framing, and performance before adding another scene dependency.
5. Keep effects replayable and deterministic. Separate object animation, camera impulse, and screen/DOM timelines.
6. Treat every visible control as a product contract. Exercise all effect buttons, camera and lighting presets, Grid, Perf, reduced motion, navigation, asset selection, and any composition controls in Chrome before handoff.
7. Review every model from front, rear, left, right, top-biased, and low three-quarter views, then repeat the meaningful animation states. Detached text, buried keys, floating parts, and parent/child drift are release blockers even when the default view looks correct.
8. Build solo assets before depending on them in `/animation-lab` or `/scene-lab`; the combined scene is also a scale, contact, lighting, and camera integration test.
9. From `control-desk/`, run `bun run build`, then use the Chrome visual-QA skill for browser evidence. A successful build is not visual approval.
10. Update this file when a decision changes. Do not leave abandoned alternatives in new docs.
11. Do not move the camera when the selected asset or animation composition changes. Free-orbit state persists; only an explicit camera preset choice or `Reset view` may animate to a saved camera.
12. Keep the labs distinct: Model Floor is the isolated construction/material/all-angle register with per-model replay controls; Animation Stage owns solo mechanisms plus deliberately authored multi-model sequence scenes; Desk Scene owns the real-scale workstation, seated reach, environment layout, controllable lighting, and workstation-screen focus; System FX owns coupled selected-object, DOM/screen, camera-impulse, and postprocessing response testing. “Model Floor” and “System FX” are not alternate names for the same view.
13. Keep the performance profiler available in every 3D lab, but default it off so profiling does not tax normal interaction. The render-quality selector owns the shared budget: Low favors constrained devices, Default targets smooth review, and Capture restores expensive shadows, DPR, and postprocessing for authored screenshots.

## Project skills in use

- `.agents/skills/create-game-model`: single-model brief, fresh-agent isolation, procedural quality gates, animation, registry/provenance, and lab review.
- `.agents/skills/source-game-audio`: source/license verification, reproducible download and processing, loudness/loop QC, cataloging, and gallery integration.
- `.agents/skills/debug-r3f-visuals`: Chrome-only visual, camera, responsive, interaction, WebGL, reduced-motion, and performance QA.

Keep these skills concise and executable. Update an existing skill instead of writing a new process file when the workflow belongs to that skill.

For this hackathon proof of concept, audio exploration may use `yt-dlp` to acquire a working reference track or effect quickly. Keep the video URL, title, and download command in the catalog; label it prototype-only and do not imply redistribution clearance. Rights clearance becomes mandatory before any public build or submission bundle that redistributes the file.

## Package management

- Use Bun for scaffolding, installation, removal, scripts, and one-off package binaries.
- Never hand-edit `control-desk/package.json`. From `control-desk/`, use `bun create`, `bun add`, `bun remove`, and existing `bun run` scripts.
- Do not add Rapier or another physics engine unless a demonstrated interaction cannot be delivered with constrained scripted motion.

## R3F transform and React safety

- Model at real-world meter scale with the asset root at a documented origin. Apply display zoom only in the registry/stage wrapper.
- Treat every child `position`, `rotation`, and `scale` as local to its parent. Before changing a nested transform, identify the full parent chain and calculate the intended world result.
- Give one component ownership of each animated transform. Do not animate a parent's axis and the child's same axis unless the additive motion is deliberate and tested.
- Use named refs for moving subassemblies such as stamp head, printer tray, cover hinge, button plunger, and paper exit. Animate the smallest stable group.
- Reset every mutated local transform, material value, and visibility flag before replay. React Strict Mode and rapid retriggers must not accumulate timelines or drift.
- Do not create Three geometry, materials, vectors, colors, or GSAP timelines inside `useFrame`. Memoize reusable values and dispose only resources the component owns.
- Keep registry scale separate from real dimensions. An asset that looks correctly sized only because its internal root is arbitrarily scaled fails review.
- Stop pointer propagation inside interactive assets and keep hit targets separate from visible meshes when necessary.
- Keep Three objects and timelines out of Zustand. Store serializable IDs and settings; components own refs and imperative animation state.
- Keep the desk scene rearrangeable through one typed code manifest. Asset world placements, hero camera poses, and authored scene-sequence targets belong there instead of being duplicated across JSX. Zustand owns serializable sequence IDs/runs and focus modes; a scene controller translates those events into component-owned camera, object, and DOM timelines.
- A scene asset is not selected by default. Selection outlines, rings, and diagnostic emissive cues belong only to the isolated model inspector unless an authored effect explicitly calls for them.
- Workstation `Html` input must stop propagation at its own boundary without leaving an invisible gate over active controls. Pointer and keyboard input stay scoped while focused; no monitor, light, or status surface may strobe continuously outside a named effect cue.

## Quality gates

- No visibly faceted blockout aesthetic, default-material look, unexplained chunky proportions, floating contact, z-fighting, shadow acne, broken normals, or one-angle-only asset.
- Validate inspection, player, profile, and overview cameras under manual, studio, Ramp, and night lighting.
- Animation needs anticipation, contact/state change, secondary motion, settle, and exact reset. Reduced motion must preserve meaning.
- Shared effect IDs describe intent, not a canned motion. Each model must respond in a way that is unique to its mechanism and physical role; a global camera impulse may supplement but never substitute for model-specific behavior.
- The operator camera must originate from a plausible seated eye point, preserve usable reach/readability, and avoid intersecting the chair or desk. Model-inspection camera labels must describe inspection views rather than reusing gameplay terminology such as `player`.
- Desk Scene exposes a true seated first-person review camera with a fixed eye point at `[0,1.28,1.19]`, a 54-degree vertical FOV, and yaw limited to `±0.20π`. Dragging turns the view left/right within that authored forward-office arc (never far enough to expose the intentionally open rear of the room); it does not orbit the player around a target. Every desk-wide animation must stage its important action inside that allowed arc. Exact free-orbit state is restored when leaving temporary workstation or giraffe focus.
- Desk layout is a real spatial-design pass, not a prop pile. The surface must be large enough for hero controls, maintain clear left/manual and right/decision zones, keep cables attached to believable sockets, and leave the screen and input devices unobstructed.
- The current desk integration contract is an extreme 2.50 m × 1.18 m horseshoe with a local finished surface at y=.780. Its local bounds are x ±1.25 and z −.48…+.70; the operator recess is 350 mm deep, with shoulders at x ±.60 and wing peaks at x ±.92/z=.70. Grommet centers remain x −.78/0/+.78, y=.782, z=−.395. In the room, add the exported desk anchor `[0,.07,.28]`, giving a world surface height of .850. Keep the center input field at x ±.58/z −.24…+.32, fan manual tools along the left wing, and fan stamps/freeze/trays along the right wing using `FINANCE_DESK_CONTRACT.wingPlacementArc`. Recompute scene coordinates against this contract when a prop envelope changes.
- `OfficeRoomShell` owns the boxed scene envelope and exports the authoritative room anchors. Its local envelope is x −4.20…+4.20, y 0…3.24, z −4.80…+2.40 with finished floor y=.07 and an intentionally open +Z camera edge. Place the desk at `[0,.07,.28]`, `OfficeServiceWindow` at `[0,0,-4.66]`, and the giraffe root at the forwarded `[.76,0,-6.88]` reveal anchor. Do not duplicate the service module's glazing, corridor, skyline, or giraffe bay inside the shell.
- `DeskComputer` exposes `DESK_COMPUTER_SCREEN`; derive the focus-camera target from that exported local anchor plus the computer’s scene position. Mount the Drei `Html` through the computer's optional screen child slot so it inherits the same screen anchor, animated assembly, and every outer transform; do not render it as a world-space sibling or duplicate an untracked screen coordinate. Workstation focus saves the exact free-orbit camera/FOV/target, disables orbit while focused, and restores that saved view on Escape or the visible close button.
- The narrative nameplate keeps the stable `contractor-nameplate` asset ID for integrations, but its approved visible copy is now **HEAD OF FINANCE**.
- The giraffe is absent in the normal scene and at the start of its animation composition. The ending/review sequence is an authored missing → rise → hold entrance, not a loose orbit suggestion: it saves the current camera, performs a forced zoom to the service window, raises the giraffe from below the occlusion line, and holds there behind a clear click-to-exit affordance. The Desk Scene sidebar can run it directly. Clicking or pressing Escape exits, hides the giraffe again, and restores the exact prior camera.
- Preserve source, author, license, modifications, scale, orientation, and animation metadata for every external or generated asset.
- Use authored GLB only when it already exists and passes the lab. Run it through the installed `gltfjsx --transform --types --shadows` CLI; never hand-transcribe its graph.
