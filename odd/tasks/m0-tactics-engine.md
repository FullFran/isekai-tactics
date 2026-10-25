# Feature: m0-tactics-engine

Locator: `odd/tasks/m0-tactics-engine.md` · Engram mirror: `odd/m0-tactics-engine/tasks`

## Objective
Build milestone M0 of the tactics engine for an original-IP, GBA Fire Emblem-style tactics RPG based on Fran and Andrés' isekai novel: one playable chapter in the browser, player phase vs enemy phase, start to victory or defeat.

## Problem / why
The engine is the foundation for two story routes (easy and hard, Eliwood/Hector-mode style) and must let a non-programmer co-author write chapters as data. Mechanics are validated in a pure, tested core before any content or art.

## Scope (authorized)
- Pure domain core: grid with terrain (move cost per movement type, avoid, def), units with FE7-style stats (HP, Str, Mag, Skl, Spd, Lck, Def, Res, Con, Mov), classes, weapons (sword/lance/axe/bow/anima) with weapon triangle.
- Movement range (Dijkstra, enemies block, allies passable) and attack range (move tiles plus weapon min/max range).
- Combat forecast (shows true hit for 2RN) and resolution consuming a seeded RNG; doubling at attack-speed difference of 4 or more; crit x3 on one RN.
- Phase loop: player, enemy, turn counter; actions move, attack, wait; action log (enables rewind later).
- No permadeath: a defeated unit retreats (removed from map, forfeits map EXP, flagged `retreated`); lord defeat fails the chapter; a configurable `wound` hook exists but is off by default.
- Enemy AI v1: `charge`, `inRange`, `guard`, deterministic scoring (expected damage dealt vs received, kill bonus), deterministic tie-break.
- EXP and level-ups with growth rates (seeded).
- Chapters as JSON with schema validation: map, objective (rout, seize), deploy slots, player starts, unit groups, route-conditional difficulty config (`easy`, `hard`: enemy level bonus, AI offense bias).
- Canvas 2D adapter with placeholder shapes (no third-party sprites): map, units, cursor, move/attack highlights, forecast panel, enemy phase playback, victory/defeat screen. UI strings via i18n (es default, en).

Out of scope: supports, fog, rescue, promotion, shops, weapon ranks, rewind UI, dialogue/events, deploy, art.

## Constraints
- Stack: TypeScript strict + Vite + Canvas 2D + Vitest, same setup as `~/fullfran/mazmorra-sombria` (including `tsconfig.core.json` that typechecks `src/core` and `src/data` without DOM).
- Original IP: no Nintendo or Pokémon assets or names; numbers are our own tables (FE7 values only as calibration hints).
- Code, identifiers, comments, tests and commits in English; player-facing text in i18n files.
- Conventional commits, no AI attribution lines.
- Research input: `~/fullfran/game-analysis/notes/fire-emblem-likes.md` (§1 formulas, §2.3 no-permadeath levers, §6 engine implications).

## Delivery
- Strategy: `ask-on-risk`. Forecast: about 2,500 authored changed lines, above the ~400 budget. No remote exists, so no PR; chain-strategy question deferred until a remote exists. Work-unit commits on branch `feat/m0-tactics-engine`.
- RDD: off (global), so no native review lifecycle; ordinary checks only.

## Tasks
- [x] T1 Scaffold: Vite + TS strict + Vitest, layout (`src/core`, `src/data`, `src/adapters`, `src/app`, `src/i18n`), DOM-free core tsconfig, i18n es/en with missing-key test, npm scripts, README. Route: delegated (writer).
- [x] T2 Seeded RNG, grid/terrain, movement and attack range. TDD. Route: delegated.
- [x] T3 Stats, classes, weapons, triangle; combat forecast and resolution (2RN hit, 1RN crit, doubling). TDD. Route: delegated.
- [x] T4 Phase loop, actions, action log, retreat hook, lord-loss failure, rout/seize objectives. TDD. Route: delegated.
- [x] T5 Enemy AI v1 (charge, inRange, guard) with deterministic scoring. TDD. Route: delegated.
- [x] T6 EXP and level-ups with growths. TDD. Route: delegated.
- [ ] T7 Chapter JSON schema, loader and validator; sample chapter with easy/hard config. TDD. Route: delegated.
- [ ] T8 Canvas adapter and app flow: playable sample chapter in the browser. Manual check + build. Route: delegated.

Route trigger evidence: every task touches 2+ non-trivial files (writer trigger) and needs preparation reading (preparation trigger).

## Acceptance criteria
- `npm test`, `npm run typecheck`, `npm run build` pass.
- `npm run dev` opens a playable chapter: select a unit, see move/attack ranges, see the forecast, attack, end turn, watch the enemy phase, reach victory (rout/seize) or defeat (lord retreats).
- Same seed and same actions give the same result (test).
- Switching the chapter route between easy and hard changes enemy stats/AI per config (test).

## Checks per task
`npm test`, `npm run typecheck`; plus `npm run build` from T1 on.

## Progress / evidence
- T1 a14f6d6 chore: scaffold Vite + TypeScript strict + Vitest with DOM-free core and i18n. npm test: 2 files, 7 tests passed. typecheck: clean. build: ok. Test-first exception: scaffold, no behaviour (i18n/layering tests written with it).
- T2 ee8f7ba feat(core): add seeded RNG, terrain grid, movement and attack ranges. RED observed (modules missing). npm test: 4 files, 16 tests passed. typecheck: clean. build: ok.
- T3 34225e3 feat(core): add stats, classes, weapons, triangle and 2RN combat forecast and resolution. RED observed (combat and data/rules modules missing). npm test: 6 files, 28 tests passed. typecheck: clean. build: ok.
- T4 39ec519 feat(core): add phase loop, actions, action log, retreat hook and rout/seize objectives. RED observed (battle module missing). npm test: 7 files, 40 tests passed. typecheck: clean (structuredClone is not in the ES2022 lib; core uses a JSON clone helper). build: ok.
- T5 f237426 feat(core): add enemy AI v1 with charge, inRange and guard behaviours and offense-bias scoring. RED observed (ai module missing). npm test: 8 files, 48 tests passed. typecheck: clean. build: ok.
- T6 482ef5e feat(core): add combat EXP and seeded level-ups with growth rates. RED observed (exp module missing). npm test: 9 files, 53 tests passed. typecheck: clean. build: ok.

## Next step
T7.
