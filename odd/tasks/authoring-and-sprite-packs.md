# Feature: authoring-and-sprite-packs

Locator: `odd/tasks/authoring-and-sprite-packs.md` · Engram mirror: `odd/authoring-and-sprite-packs/tasks`

## Objective
Make the engine easy to extend in collaboration with Claude (and the non-programmer co-author), and let a first version use any sprites locally through a swappable sprite pack that never enters git.

## Problem / why
Content (chapters, classes, weapons, routes) should be added by describing it to Claude without breaking the engine. For a first version the authors want to try Fire Emblem sprites; those are Nintendo IP, so they must stay out of the repository and its history while the default build keeps working with placeholders.

## Scope (authorized)
- `CLAUDE.md`: project rules for agents (pure core, test-first, content lives in `src/data`, original IP, no third-party assets committed, how to validate).
- `docs/authoring.md`: how to add a chapter, unit group, class, weapon, terrain and route config, with a worked example; the chapter JSON format reference.
- `npm run validate`: CLI that validates every chapter (and rules data) and exits non-zero with path-located errors; tested.
- Sprite packs: renderer draws sprites from a pack manifest when present, otherwise falls back to the current placeholder shapes. Local packs load from `assets-local/` (git-ignored). Manifest maps class (and optionally unit id) to map-sprite sheets with frame size, idle/moving frames, faction palette or per-faction sheets; terrain tiles optional. Missing entries fall back per item. Manifest format validated and documented. An empty example manifest (no images) is committed under `docs/` or `public/` as a template.

Out of scope: battle animations, portraits, any committed third-party art.

## Constraints
- Same stack and rules as `m0-tactics-engine`; core stays DOM-free.
- No asset files from Nintendo or other third parties committed; `.gitignore` covers `assets-local/`.
- Artifacts in English; Conventional Commits; no AI attribution.

## Delivery
- Strategy: `ask-on-risk`. Forecast: about 700 authored changed lines. No remote; PR deferred. Branch `feat/authoring-and-sprite-packs` (from `feat/m0-tactics-engine`).
- RDD: off (global).

## Tasks
- [x] T1 `npm run validate` CLI (test-first) + `CLAUDE.md` + `docs/authoring.md`. Route: delegated (writer).
- [x] T2 Sprite pack manifest (types + validator, test-first), loader from `assets-local/`, renderer integration with per-item placeholder fallback, `.gitignore`, template manifest, docs section. Route: delegated (writer).

Route trigger evidence: both tasks touch 2+ non-trivial files and need preparation reading.

## Acceptance criteria
- `npm test`, `npm run typecheck`, `npm run build`, `npm run validate` pass; a broken chapter makes `validate` fail with a located error (test).
- With no `assets-local/`, the game renders exactly as before; with a pack, mapped classes use sprites and unmapped ones fall back.
- `git status` never shows files under `assets-local/`.

## Checks per task
`npm test`, `npm run typecheck`, `npm run build`, `npm run validate` (from T1).

## Progress / evidence
- T1 7060d01 feat(tools): add npm run validate content CLI, CLAUDE.md and authoring guide. RED observed (content and tools modules missing). Runner: vite-node (pinned as explicit devDependency, already installed via vitest; Node type stripping cannot resolve the extensionless imports). Validator also checks rule tables, unregistered chapter files and i18n names; docs worked example validated. npm test: 13 files, 79 tests. typecheck: clean. build: ok. validate: ok.

- T2 315f0c9 feat(adapters): add local sprite packs with per-item placeholder fallback. RED observed (spritePack and sprites modules missing). Manifest validator + frame resolution pure in core; loader in adapter with injected deps; renderer tested with a recording fake context (mapped class/terrain drawn from pack, unmapped keep placeholders). Dev server: pack.json served as application/json; a missing pack returns Vite's HTML fallback (200 text/html), handled silently by a content-type check. Default build leaves assets-local out of dist; INCLUDE_LOCAL_SPRITES=1 copies it (private builds only). Dummy pack in assets-local/ is ignored (`git status --ignored` shows `!! assets-local/`, 0 tracked files). npm test: 15 files, 95 tests. typecheck: clean. build: ok. validate: ok. NOT done: in-browser visual check (Playwright has no Chrome installed).

## Next step
Manual in-browser check with the dummy pack in assets-local/ (npm run dev: lord drawn as a yellow bobbing sprite, plain/forest tiles green, other units placeholders); then drop in a real local pack.
