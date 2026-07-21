---
name: design-operating-system
description: Design, rebuild, or review convincing desktop operating-system interfaces and multi-application workflows in React, including embedded R3F/Drei Html monitor UIs. Use for Expense OS, macOS-like shells, app docks and icons, desktop windows, notifications, manual-versus-unified finance software, interaction architecture, or visual/hit-testing problems that make an interface feel like a dashboard instead of an operating system.
---

# Design Operating Systems

Create an app ecosystem with a coherent desktop shell, not one dashboard divided into cards. For Receipts, Please, read the root `AGENTS.md`, the full design brief, and the frontend-design and debug-r3f-visuals skills before editing.

## Establish the interaction model

Write a compact design plan before code:

- Name the user's role, the current task, and the one action the screen must make obvious.
- Diagram the desktop shell, app windows, data boundaries, and physical-world handoff.
- Define 4–6 flat colors, distinct display/body/utility type roles, spacing, window geometry, and one signature motif grounded in the product world.
- Critique the plan. Replace any generic dashboard, excessive glass cards, gradient stacks, marketing copy, or decorative metric with an OS-native element. Use gradients only when they communicate a physical light/material transition that a flat surface cannot.

For this game, preserve the loop: pick up the physical receipt, focus the monitor, open separate source apps, compare evidence, press Escape, then use a physical stamp. Do not reveal the answer in the inbox.

## Build one shell with two eras

Keep a stable desktop grammar across manual and Ramp states: menu bar, desktop, dock, app icon language, window chrome, notification location, focus/close behavior, and keyboard rules.

Manual mode must feel fragmented through behavior, not sloppy CSS. Open Transactions, Directory, Slack, Policy PDF, Travel, and Inventory as distinct applications with incomplete slices of the case. Allow overlapping windows and deliberate context switching.

Post-Ramp mode keeps the recognizable shell but consolidates evidence into one Ramp workspace. Show receipt matching, policy citations, connected people/travel/vendor/inventory evidence, controls, and an exception queue. Relief comes from reduced switching and clearer hierarchy, not from replacing the product with an unrelated UI.

## Use real visual assets

Centralize authored SVG or raster app icons, avatars, document thumbnails, vendor marks, status glyphs, and window controls. Reuse them through semantic components. Do not ship two-letter icon tiles, emoji, placeholder initials, repeated generic squares, or a generic outline-icon pack when an authored asset can communicate the application.

Give each app a recognizable silhouette and flat color family while preserving a shared icon construction grid. Prefer standalone SVG files with meaningful internal detail over CSS-colored icon containers. Keep labels readable at monitor scale. Use assets to support recognition, not as decoration.

## Keep React ownership explicit

- Reuse the existing serializable store for case, app, notification, and migration state.
- Prefer one OS shell and one app registry over parallel pre-Ramp and post-Ramp implementations.
- Give each window one owner for position, z-order, focus, close, and content state.
- Keep DOM timelines separate from Three camera/object timelines.
- Mount readable UI once per active surface; avoid duplicate backgrounds beneath `<Html>`.

## Make embedded monitor input real

Treat a visually correct Drei `<Html transform>` surface as unverified until real pointer input works. During focus transitions, preserve a stable visual frame; after focus settles, use a monitor-aligned interactive surface whose DOM hitboxes match its pixels.

Verify with browser evidence:

1. Inspect `getBoundingClientRect()` for the shell and every primary control.
2. Confirm `document.elementFromPoint()` returns the visible control at its center.
3. Click with real Chrome pointer actions, not handler dispatch or synthetic state changes.
4. Confirm clicks at the center and near every monitor edge.
5. Confirm Escape restores the prior camera and physical controls remain reachable.

Never leave an invisible full-screen gate above the canvas. Never accept a transformed element whose visual pixels and hitbox disagree.

## Design notifications and guidance

Use one instruction at a time, located beside the object or app that performs it. Do not duplicate onboarding in corner modals, floating pills, and desktop copy. Notifications belong in a consistent top-right stack, identify their source, and either open the relevant app or explain the next action. Empty states must tell the player which app to open.

## QA gate

Use the Chrome visual QA skill after the build:

- Capture cold open, receipt pickup, focus start/mid/end, every manual app, migration, Ramp workspace, and focus exit.
- Click every app icon, close control, notification, receipt control, and physical decision control through the browser.
- Check 1440×900 plus one narrower viewport, normal and reduced motion.
- Confirm no flash, z-fighting, stale duplicate UI, clipped text, answer leakage, placeholder icons, offset hitboxes, or unreadable window layers.
- Inspect every captured frame, name the three weakest visual decisions, revise them, and repeat the same captures. A first screenshot is a baseline, never approval.
- Reject the pass if it still reads as a finance dashboard rather than a desktop with separate applications.
