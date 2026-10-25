# CLAUDE.md

Original-IP browser tactics RPG (GBA grid-tactics style). TypeScript strict, Vite, Canvas 2D, Vitest. Authors: Fran (code) and Andrés (story, chapters; not a programmer).

## Architecture

- `src/core`: pure simulation. No DOM, no rendering, no I/O. Enforced by `tsconfig.core.json` (no DOM lib) and `tests/architecture.test.ts`.
- `src/data`: content (rule tables in `rules.ts`, chapters in `chapters/*.json`). Pure data, no DOM.
- `src/adapters`: Canvas rendering, input, sprite-pack loading; `src/adapters/ui`: windows, cursor menus and UI tokens. `src/app`: browser entry and UI flow. `src/i18n`: UI strings (Spanish is the source; English must have the same keys).
- `tools/`: Node CLIs (`npm run validate`).
- Dependencies point inward: adapters/app → core/data, never the reverse.

## Content requests

- A content request (chapter, enemy group, class, weapon, terrain, route tuning) changes `src/data` and `src/i18n` only. Follow `docs/authoring.md`.
- Every new class/weapon/terrain id needs a name in both i18n files.
- Do not change existing numbers (balance) or existing chapters unless explicitly asked.

## Original IP and assets

- No third-party names, characters or maps in the repository.
- Committed art must be openly licensed (CC0/CC-BY or similar) and credited in `CREDITS.md` and the in-game credits (`credits.art`). The committed default sprite pack is DawnLike (CC-BY 4.0) in `public/sprites/dawnlike/` (cells listed in its `SOURCES.txt`); procedural placeholders draw anything it does not map.
- Private or unlicensed sprites live only in git-ignored `assets-local/` as a sprite pack (format: `docs/authoring.md`, template: `docs/sprite-pack.example.json`); it is layered over the default pack per item. Never commit, copy or reference its files elsewhere; check `git status` before committing.

## Working rules

- Behaviour changes are test-first: write the failing test, run it and see it fail, then implement.
- Before every commit run, and keep green:
  ```bash
  npm test && npm run typecheck && npm run build && npm run validate
  ```
- Conventional Commits (`feat(core): …`, `docs: …`). No AI attribution or Co-Authored-By lines.
- Code, comments, tests, commits and docs in English; player-facing text in i18n files. Keep comments sparse.
