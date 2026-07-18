# Receipts, Please

An internal production lab for **Receipts, Please**, a Ramp Builders Cup browser-game prototype about surviving a chaotic finance desk before the workflow transforms.

The current milestone includes the desk environment, procedural 3D asset library, animation/effects sandbox, interactive Expense OS, and a playable five-minute `/game` vertical slice.

## Repository layout

```text
.
├── AGENTS.md                       # Canonical scope and agent process
├── receipts_please_game_design.md  # Full game and story design brief
├── .agents/skills/                 # Project-specific Codex skills
└── control-desk/                   # Bun + Vite + React Three Fiber app
```

Run application commands from `control-desk/`. The repository root intentionally has no `package.json`.

## Requirements

- [Bun](https://bun.sh/) 1.2 or newer
- A current Chrome build with WebGL and hardware acceleration enabled

## Local setup

```bash
git clone https://github.com/willzeng274/receipts-please.git
cd receipts-please/control-desk
bun install
bun run dev
```

Vite prints the local URL when the server starts. Open `/model-lab` for the default asset inspector.

## App scripts

Run these from `control-desk/`:

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server |
| `bun run build` | Typecheck and create the production build |
| `bun run lint` | Run Oxlint over the application |
| `bun run preview` | Serve the production build locally |

Validate the asset provenance and transform manifest with:

```bash
python3 ../.agents/skills/create-game-model/scripts/validate_asset_manifest.py public/models/manifest.json
```

## Production labs

| Route | Purpose |
| --- | --- |
| `/model-lab` | Inspect every registered model in isolation from saved camera and lighting presets |
| `/animation-lab` | Replay solo and multi-model animation compositions |
| `/scene-lab` | Review the assembled office, horseshoe desk, seated POV, lighting, and story sequences |
| `/effects-lab` | Test coupled object, screen, camera, and environment responses |
| `/audio-lab` | Review sourced music/SFX metadata and playback |

The 3D labs expose OrbitControls, saved cameras, lighting controls, grid visibility, reduced motion, and the performance profiler. The seated first-person camera in Desk Scene uses a constrained forward-facing look arc so the open rear of the review environment is never exposed.

## Working with Codex

Before changing the app, read the complete root [`AGENTS.md`](AGENTS.md), the relevant project skill, and [`receipts_please_game_design.md`](receipts_please_game_design.md). After context compaction or handoff, re-read both root documents rather than relying only on a summary.

Project skills:

- `create-game-model` — builds and reviews one production-quality model with fresh-context ownership.
- `debug-r3f-visuals` — runs Chrome-based visual, interaction, camera, and performance QA.
- `source-game-audio` — sources, processes, catalogs, and validates browser-game audio.

For parallel Codex work, use a separate branch or worktree per task. Keep individual model work isolated, and let one integration task own shared files such as `control-desk/src/models/registry.tsx`, `control-desk/src/config/sceneManifest.ts`, and the asset manifest.

## Package policy

Use Bun for every package operation. Never edit `control-desk/package.json` manually; use `bun add`, `bun remove`, or the existing scripts so `bun.lock` stays authoritative.
