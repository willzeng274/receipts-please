---
name: create-game-model
description: Create, import, animate, optimize, or visually review one production-quality 3D game asset for Receipts, Please. Use for procedural React Three Fiber models, authored GLB/GLTF models, Blender handoff briefs, gltfjsx generation, asset manifests, model-lab integration, material and scale review, or any request involving an individual desk prop, office model, character, giraffe, or animated 3D asset.
---

# Create Game Model

Build one memorable, reusable asset at a time and prove it in `/model-lab`. Treat the model as production art: deliberate silhouette, credible construction, authored materials, useful pivots, interaction states, and animation are required. For the current Builders Cup milestone, use procedural R3F and do not start a Blender-authored asset pipeline.

Treat the repository as a monorepo. Keep this skill and project instructions at the repository root; the Bun/Vite/R3F application root is `control-desk/`. Resolve every `src/` and `public/` path below from `control-desk/`, and run Bun commands there.

## Enforce fresh-context model ownership

Assign every individual model to a new subagent with fresh context. Give that agent only:

- this skill;
- the single-model brief;
- the component contract in `control-desk/src/models/types.ts`;
- the relevant design-plan excerpt;
- the registry/manifest schema;
- the command needed to build and inspect the app.

Do not let one agent create multiple models. Do not show a new model agent sibling model implementations before its first design proposal; preserve independent silhouette and material decisions. Let the parent agent integrate the result and resolve shared-code issues.

## Choose the asset route

Use procedural R3F for geometric props whose quality comes from construction detail, bevels, materials, labels, and interaction states: stamps, trays, buttons, calculators, printer mechanisms, documents, and modular set pieces.

Defer organic forms, characters, the giraffe, deforming parts, baked surface detail, and other assets that would normally need Blender until the user reopens that scope.

Do not generate a naive Three.js-exported GLB and call it final. Import a GLB only when a licensed, already-authored asset is clearly stronger than a procedural solution, then use the installed conversion path below. A technically valid binary is not a quality result.

## Write the single-model brief

Define before implementation:

- narrative job and the remembered moment it supports;
- real-world dimensions in meters and canonical forward/up axes;
- silhouette from player, profile, and close inspection cameras;
- materials, wear, micro-detail, and any printed graphics;
- interaction pivots, collision/selection zones, and snap points;
- idle, interaction, impact, recovery, and reduced-motion behavior;
- expected camera distance and the harshest lighting preset;
- soft triangle, draw-call, texture, and file-size budget from `references/quality-gates.md`.

Reject a brief that only names an object or proposes a generic low-poly style. Find concrete construction references and use them to specify seams, fasteners, bevel radii, panel gaps, thickness, manufacturing logic, and wear placement.

## Build a procedural R3F asset

1. Implement one component in its own file under `control-desk/src/models/procedural/` and accept `ProceduralAssetProps`.
2. Model at meter scale with the base resting at `y=0` and the useful face oriented toward `+z` unless the brief documents another convention.
3. Compose geometry into a convincing manufactured object. Add bevels or rounded transitions, separate moving parts, recessed gaps, fasteners, feet, seams, label plates, and contact surfaces where the real object has them.
4. Use tuned `meshStandardMaterial` or `meshPhysicalMaterial` values. Avoid raw primary colors, uniform roughness, pure black, and identical materials across unrelated surfaces.
5. Keep animation deterministic from `effectPreset` and `effectRun`. Every shared effect ID (`paper-drop`, `approve`, `reject`, `fraud`, `printer-jam`, and `migration`) needs a response specific to this model's mechanism; do not map several IDs to the same generic wobble. Use short authored sequences with anticipation, contact/state change, secondary response, settle, and a clean reset. Respect `reducedMotion` at the scene level.
6. Use `castShadow` and `receiveShadow` intentionally. Avoid new geometry or materials inside `useFrame`.
7. Keep hit targets ergonomic without changing the visible silhouette. Stop pointer propagation on internal interactions.
8. Add the component to `control-desk/src/models/registry.tsx` only after it renders in isolation.

Default primitives are construction tools, not an art direction. Visible faceting, toy-like proportions, unmotivated chunky forms, and placeholder materials fail review unless the brief explicitly calls for them.

## Import an exceptional existing GLB

1. Verify that the licensed source already has clean transforms, useful origins, named meshes/materials/bones, intentional animation clips, and no hidden junk.
2. Put the untouched source GLB in `control-desk/public/models/source/`. Keep approved runtime assets in `control-desk/public/models/`.
4. Generate the typed component with the installed CLI; do not hand-transcribe the GLTF graph:

```bash
cd control-desk
bunx gltfjsx public/models/source/<asset>.glb --transform --types --shadows --output src/models/generated/<Asset>.tsx
```

4. Inspect the generated component. Preserve credits, use `useAnimations` for clips, and verify the transformed file path. Do not manually recreate node/material typings.
5. Retain the source file and record what the transform changed. Never simplify a hero silhouette merely to hit a numeric budget; optimize invisible density, duplicate materials, oversized textures, and draw calls first.

## Separate object and screen animation

Keep mesh motion in the model component or GLB clips. Keep monitor/UI sequences in deterministic GSAP or Motion timelines outside the asset. Expose explicit triggers so `/effects-lab` can replay each sequence without reloading.

For impact animation, include anticipation, peak contact, secondary motion, and settle. For screen animation, include entry hierarchy, state change, and exit/cleanup. Reduced motion must preserve state comprehension even when camera and parallax movement are minimized.

## Register provenance

Record each model in `control-desk/public/models/manifest.json`, including procedural assets. Preserve source, author, license, modifications, dimensions, scale, orientation, animation names, and status. From `control-desk/`, run `python3 ../.agents/skills/create-game-model/scripts/validate_asset_manifest.py public/models/manifest.json` before review.

Never use an asset with unclear redistribution rights. Keep source URLs even for CC0 work. Do not copy marketplace preview files, ripped game assets, or search-result thumbnails.

## Prove the asset in the lab

1. From `control-desk/`, run `bun run build` and resolve type or bundle failures.
2. Open `/model-lab` with the project visual-debugging skill.
3. Capture front, rear, left, right, high three-quarter, and low three-quarter inspection angles, plus player, profile, and overview cameras under manual, studio, Ramp, and night lighting.
4. At each meaningful angle, check that text, buttons, covers, cables, fasteners, papers, screens, and moving subassemblies remain attached, visible, correctly layered, and inside their parent construction.
5. Open the asset's solo sequence in `/animation-lab`. Replay every shared effect repeatedly, including rapid retriggers and exact reset, then inspect the combined sequence that uses the asset when one exists.
6. Inspect silhouette, bevel highlights, grounding, z-fighting, transparency, texture color space, shadow acne, pivots, scale, pointer targets, and reduced motion.
7. Check triangles, draw calls, texture memory, and frame behavior. Treat budgets as investigation thresholds, not permission to ship a visibly weak asset.
8. Compare against `references/quality-gates.md`. Mark the asset `review` only when every blocking gate passes; do not self-label it final.

Hand back the model brief, implementation path, manifest entry, animation/effect list, measured performance, review screenshots, known gaps, and exact next art revision.
