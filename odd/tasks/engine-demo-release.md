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
- Committed third-party art is allowed only with an open license and credits (DawnLike, CC-BY 4.0, in `public/sprites/dawnlike/` and `CREDITS.md`); private or unlicensed art stays in git-ignored `assets-local/`.
- Remote work (create GitHub repo, push, deploy) requires explicit user authorization of destination and visibility before it happens.

## Delivery
- Strategy: `ask-on-risk`. Forecast: about 1,200 authored changed lines. Branch `feat/engine-demo-release` from `feat/authoring-and-sprite-packs`.
- RDD: off (global).

## Tasks
- [x] T1 UI and controls parity: title, settings, credits, panels, font, input mapping, controls hint, juice, presentable placeholder art, route select. Tests for pure pieces (input mapping, animation timing/queues, view-model). Route: delegated (writer).
- [x] T2 Pages workflow, relative base, README demo/controls section; verify `dist/` has no `assets-local`. Route: delegated (same writer).
- [x] T4 Committed default sprite pack: DawnLike CC-BY 4.0, mapped classes and terrain, credits; assets-local overrides it. Route: delegated (writer).
- [x] T3 Create remote, push main, deploy, verify live bundle. Route: parent (authorized by user: public FullFran/isekai-tactics, Pages at www.fullfran.com/isekai-tactics/).

## Acceptance criteria
- `npm test`, `npm run typecheck`, `npm run build`, `npm run validate` pass.
- Title → route select → play the sample chapter to victory or defeat → back to title, with Mazmorra-like look and controls.
- Deployed URL serves the demo; `dist/` contains no `assets-local` files.

## Checks per task
`npm test`, `npm run typecheck`, `npm run build`, `npm run validate`.

## Progress / evidence
- T1 `1ccaf3e` (delegated writer). RED observed first for `pathTo`, `battleCommand`, settings, hud, presenter, ported nav and `nextReadyUnit` tests; then GREEN. Checks: `npm test` 20 files / 120 tests pass, `npm run typecheck` ok, `npm run build` ok, `npm run validate` "content ok". Smoke: headless Firefox screenshots of the built title screen and `?route=easy` battle render correctly (keyboard/mouse flows not driven: no automation browser). Decisions: A/W/S action hotkeys dropped because WASD now moves the cursor (the action menu is a W/S cursor list instead); Tab added (next ready unit); `?route=` deep link added for links and smoke checks. Larger than the 400-line heuristic (~1,900 authored lines incl. the ported UI kit and CSS) because the UI kit, renderer and presenter only make sense together.
- T2 `b1baf56` (delegated writer). No RED: CI config and docs, no runnable behaviour. Checks: `npm test` 20 files / 120 tests, typecheck ok, build ok, validate "content ok". A normal build (with the dummy pack present in `assets-local/`) leaves `dist/` with only `index.html`, `assets/index-*.js` and `fonts/` (no `assets-local`); `index.html` references `./assets/…` (relative base). Workflow uses Node 24 (one dependency needs ^22.20 or ^24.12) and adds a `test ! -e dist/assets-local` guard. YAML not executed (no remote, no local runner).
- T4 `7d9b4c7` (delegated writer). RED observed first: 9 failing tests for `mergeSpritePacks`/`rebaseSheets` and the layered loader (default + `assets-local`, local wins per item, sheets relative to each manifest, invalid pack skipped with a warning, none → null); then GREEN. Checks: `npm test` 128 tests pass, typecheck ok, build ok, validate "content ok: 1 chapter(s), 10 classes, 8 weapons, 9 terrains"; `dist/` holds `sprites/dawnlike/` and no `assets-local`. Pack: cells cropped from DawnLike into `units.png` / `units-enemy.png` (row per class, idle cols 0-1, moving cols 2-5; Commissions front walk for knight, fighter, mage) and `terrain.png` (overlays composited on grass); every class in `rules.ts` and every sample terrain mapped (tested). Cavalier = DawnLike centaur (no mounted rider exists). Enemies use distinct sprites plus the default red tint (a faction disc under the feet was tried and dropped: hidden by the sprite). Visual check: headless Firefox shots of title, `?route=easy`, `?route=hard` with the dummy pack parked, plus a private build confirming the dummy pack overrides lord, plain and forest. Gaps: the DawnLike README asks users to hide the Platino sprite; not done per instruction (courtesy request, not a CC-BY term). River tile is static (procedural glints are skipped when a river tile is mapped). Per-item `tileSize` added to the manifest format.

- T3 (parent). Created public repo FullFran/isekai-tactics, Pages build_type=workflow, pushed main (= feat/engine-demo-release ef8deb7) and the three feature branches. Push did not trigger the workflow; `gh workflow run deploy.yml --ref main` run 40223379462: build success, deploy success. Live `index-Dgkk-TPC.js` matches local build; `/sprites/dawnlike/pack.json` 200; `/assets-local/pack.json` 404. Local checks before push: 128 tests, validate ok.

## Next step
Andrés plays the demo. Known gaps: keyboard/mouse flows never driven by automation; dark band under the river row in screenshots (suspected phase banner); river tile not animated with the pack; DawnLike Platino sprite intentionally omitted.
