# Feature: engine-demo-release

Locator: `odd/tasks/engine-demo-release.md` · Engram mirror: `odd/engine-demo-release/tasks`

## Objective
Publish a small, polished demo of the tactics engine to show Andrés, with controls, interface and quality on par with Mazmorra Sombría (`~/fullfran/mazmorra-sombria`, live at https://www.fullfran.com/shadow-dungeon/).

## Problem / why
The engine works but looks like a debug view with placeholder shapes. A short demo that feels finished is the best way to show the co-author what the engine can do and to start writing chapters on top of it.

## Scope (authorized)
- UI and controls parity with Mazmorra Sombría where it makes sense for a turn-based grid game: same font and window/panel style, title screen (Play, Settings, Credits), settings (language es/en, any options that apply), keyboard + mouse with the same feel (WASD/arrows, Enter/Space confirm, Esc back, mouse hover/click), on-screen controls hint, and juice adapted to tactics (smooth unit movement along the path, attack lunge and hit flash, floating damage numbers, crit and miss feedback, phase banners, HP bars, terrain/unit info panels, cursor animation).
- Placeholder art made presentable (coloured, readable unit tokens with class glyphs and faction colours; terrain tiles drawn procedurally), since no third-party art is committed. Licensed CC0/CC-BY assets only if added with credits.
- The demo is the existing sample chapter (no balance or content changes beyond what the demo flow needs, e.g. route select easy/hard on the title).
- GitHub Pages workflow like Mazmorra Sombría (relative base, test + build in CI, deploy on push to main and `workflow_dispatch`); README with a demo link and controls.
- `assets-local/` never included in the deployed build.

Out of scope: new chapters, music (no licensed tracks chosen yet), story content, mobile touch.

## Constraints
- Same stack and rules as `CLAUDE.md` (pure core, test-first for behaviour, original IP, no AI attribution).
- Remote work (create GitHub repo, push, deploy) requires explicit user authorization of destination and visibility before it happens.

## Delivery
- Strategy: `ask-on-risk`. Forecast: about 1,200 authored changed lines. Branch `feat/engine-demo-release` from `feat/authoring-and-sprite-packs`.
- RDD: off (global).

## Tasks
- [ ] T1 UI and controls parity: title, settings, credits, panels, font, input mapping, controls hint, juice, presentable placeholder art, route select. Tests for pure pieces (input mapping, animation timing/queues, view-model). Route: delegated (writer).
- [ ] T2 Pages workflow, relative base, README demo/controls section; verify `dist/` has no `assets-local`. Route: delegated (same writer).
- [ ] T3 Create remote, push main, deploy, verify live bundle. Route: parent; blocked on user authorization of destination.

## Acceptance criteria
- `npm test`, `npm run typecheck`, `npm run build`, `npm run validate` pass.
- Title → route select → play the sample chapter to victory or defeat → back to title, with Mazmorra-like look and controls.
- Deployed URL serves the demo; `dist/` contains no `assets-local` files.

## Checks per task
`npm test`, `npm run typecheck`, `npm run build`, `npm run validate`.

## Progress / evidence
(none yet)

## Next step
T1.
