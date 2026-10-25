# CLAUDE.md

Original-IP browser tactics RPG (GBA grid-tactics style). TypeScript strict, Vite, Canvas 2D, Vitest. Authors: Fran (code) and Andrés (story, chapters; not a programmer).

## Architecture

- `src/core`: pure simulation. No DOM, no rendering, no I/O. Enforced by `tsconfig.core.json` (no DOM lib) and `tests/architecture.test.ts`.
- `src/data`: content (rule tables in `rules.ts`, chapters in `chapters/*.json`). Pure data, no DOM.
- `src/adapters`: Canvas rendering, input, sprite-pack loading. `src/app`: browser entry and UI flow. `src/i18n`: UI strings (Spanish is the source; English must have the same keys).
- `tools/`: Node CLIs (`npm run validate`).
- Dependencies point inward: adapters/app → core/data, never the reverse.

## Content requests

- A content request (chapter, enemy group, class, weapon, terrain, route tuning) changes `src/data` and `src/i18n` only. Follow `docs/authoring.md`.
- Every new class/weapon/terrain id needs a name in both i18n files.
- Do not change existing numbers (balance) or existing chapters unless explicitly asked.

## Original IP and assets

- No third-party names, characters, maps or art in the repository. Placeholder shapes are the committed art.
- Third-party sprites (e.g. for private tests) live only in git-ignored `assets-local/` as a sprite pack (see `docs/authoring.md`). Never commit, copy or reference their files elsewhere; check `git status` before committing.

## Working rules

- Behaviour changes are test-first: write the failing test, run it and see it fail, then implement.
- Before every commit run, and keep green:
  ```bash
  npm test && npm run typecheck && npm run build && npm run validate
  ```
- Conventional Commits (`feat(core): …`, `docs: …`). No AI attribution or Co-Authored-By lines.
- Code, comments, tests, commits and docs in English; player-facing text in i18n files. Keep comments sparse.
