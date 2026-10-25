# Isekai Tactics

Browser tactics RPG engine for an original-IP story (grid tactics in the style of the GBA era: player phase / enemy phase, weapon triangle, 2RN hit). Mechanics only: no third-party names, maps, characters or assets.

## Run

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest (node)
npm run typecheck  # whole project + DOM-free core/data
npm run build      # typecheck + production build into dist/
```

## Layout

| Path | Role |
|---|---|
| `src/core` | Pure simulation: RNG, grid, combat, phases, AI, EXP, chapter validation. No DOM (enforced by `tsconfig.core.json`). |
| `src/data` | Content tables (terrain, classes, weapons) and chapter JSON. No DOM. |
| `src/adapters` | Canvas 2D rendering and input. |
| `src/app` | Browser entry point and UI flow. |
| `src/i18n` | UI strings, Spanish (default, source of truth) and English. A test fails if a key is missing. |
