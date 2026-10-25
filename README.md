# Isekai Tactics

Browser tactics RPG engine for an original-IP story (grid tactics in the style of the GBA era: player phase / enemy phase, weapon triangle, 2RN hit). Mechanics only: no third-party names, maps, characters or assets.

## Run

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest (node)
npm run typecheck  # whole project + DOM-free core/data
npm run build      # typecheck + production build into dist/
npm run validate   # check every chapter, rule table and UI name
```

Adding content (chapters, classes, weapons, terrain): see [`docs/authoring.md`](docs/authoring.md). Agent rules: [`CLAUDE.md`](CLAUDE.md).

## Play

`npm run dev`, open the printed URL. The sample chapter loads on the easy route with a random seed (shown in the panel); switch route or restart from the side panel.

- **Mouse:** click a blue unit to select it (blue = move, red = attack reach), click a blue tile to move, then pick *Attack*, *Seize* or *Wait*. While targeting, hover/click a target to see the forecast, click it again (or *Confirm*) to attack. Right-click cancels.
- **Keyboard:** arrows move the cursor, Enter/Space/Z confirm, Esc/X cancel, A attack, W wait, S seize, E end turn, R restart, L toggles Spanish/English.
- The player phase ends automatically when every unit has acted; the enemy phase plays back one action at a time.

## Layout

| Path | Role |
|---|---|
| `src/core` | Pure simulation: RNG, grid, combat, phases, AI, EXP, chapter validation. No DOM (enforced by `tsconfig.core.json`). |
| `src/data` | Content tables (terrain, classes, weapons) and chapter JSON. No DOM. |
| `src/adapters` | Canvas 2D rendering and input. |
| `src/app` | Browser entry point and UI flow. |
| `tools` | Node CLIs (`npm run validate`). |
| `src/i18n` | UI strings, Spanish (default, source of truth) and English. A test fails if a key is missing. |

## Rules (M0)

All formulas live in `src/core/combat.ts` and `src/core/exp.ts`; tables in `src/data/rules.ts`. Numbers are our own, calibrated on GBA-era magnitudes.

| Quantity | Formula |
|---|---|
| Attack speed (AS) | Spd − max(0, weapon Wt − Con) |
| Damage | Str (Mag for anima) + Mt (×3 if effective) ± 1 triangle − (Def or Res) − terrain Def, min 0 |
| Hit (displayed) | clamp(weapon Hit + 2·Skl + Lck/2 ± 15 triangle − (2·AS + Lck + terrain Avoid) of the foe, 0, 100) |
| Crit | clamp(weapon Crit + Skl/2 + class bonus − foe Lck, 0, 100), damage ×3 |
| Doubling | AS − foe AS ≥ 4 |
| Exchange | attacker, counter (if in the defender's weapon range), follow-up of whoever doubles; stops at a kill |

- **2RN hit.** Resolution draws two RNs (0–99) and hits when their sum is below 2 × displayed hit; the forecast shows both the displayed hit and the *true* hit derived from 2RN (e.g. 70 → 82.3 %). A crit check draws one RN, only after a hit. Every RN is logged with its reason (`hit`, `crit`, `levelup:str`, …) in `state.rng.log`.
- **Weapon triangle:** sword > axe > lance > sword (±15 hit, ±1 Mt). Bows and anima are neutral; bows are effective against fliers.
- **EXP:** no damage 1; damage ⌊(31 + level gap)/3⌋; kill adds max(0, 20 + 3·gap) (+40 boss); clamped 1–100. Level-up at 100: one RN per stat against its growth (>100 % gives a guaranteed point), a blank level-up is re-rolled up to twice. Cap level 20.
- **No permadeath:** a defeated player unit *retreats* (status `retreated`, off the map) and its level/EXP/stats are restored to the chapter-start snapshot, so it forfeits the map's EXP. A lord retreat fails the chapter (`rules.lordLossFails`). `rules.wound` (off by default) flags retreated units with a carry-over wound for later milestones.
- **Enemy AI v1** (`src/core/ai.ts`): `charge` (always advances), `inRange` (acts only when a target is reachable), `guard` (never moves). Every reachable (tile, target) pair is scored `offense·w + defense·(1−w)` with `w = bias/(bias+1)`; offense = expected damage share + kill bonus × kill chance, defense = 1 − expected counter-damage share. Ties go to unit order, then least movement, then row/column.
- **Generic units** get class bases + ⌊(level − 1) × growth%⌋ per stat (fixed autolevel, no RNG). Party members may give full personal `stats`.
- **Determinism:** the battle state is plain JSON (including the PRNG state). Same seed + same action log → identical state (`replay`).

### Terrain (avoid / def / heal, cost foot·armor·mounted·flier; – = impassable)

| Terrain | Avoid | Def | Heal | Cost |
|---|---|---|---|---|
| plain, road | 0 | 0 | – | 1·1·1·1 |
| forest | 20 | 1 | – | 2·2·3·1 |
| hill | 30 | 1 | – | 3·–·4·1 |
| village | 10 | 0 | – | 1·1·1·1 |
| fort | 20 | 2 | 20 % | 2·2·2·1 |
| gate | 30 | 3 | 10 % | 1·1·1·1 |
| river | 0 | 0 | – | 5·–·–·1 |
| wall | – | – | – | impassable |

## Chapter JSON

Chapters are plain JSON (`src/data/chapters/*.json`, full reference in `docs/authoring.md`), checked by `validateChapter` (`src/core/chapter.ts`), which reports every problem with a path such as `unitGroups.main[2].weapon: knight cannot wield sword`.

```jsonc
{
  "id": "sample-01",
  "title": { "es": "…", "en": "…" },
  "map": { "legend": { ".": "plain", "F": "forest", "#": "wall" }, "rows": ["..F#", "...."] },
  "objective": { "type": "rout" },               // or { "type": "seize", "tile": [x, y] }
  "rules": { "lordLossFails": true, "wound": { "enabled": false, "penaltyPct": 10 } },
  "routes": {
    "easy": { "enemyLevelBonus": 0, "aiOffenseBias": 0.5, "deploySlots": 4, "unitGroups": ["main"] },
    "hard": { "enemyLevelBonus": 1, "aiOffenseBias": 3,   "deploySlots": 3, "unitGroups": ["main", "hardExtra"] }
  },
  "playerStarts": [[2, 9], [3, 8]],               // deploy order; the lord always deploys first
  "party": [{ "id": "aren", "name": "Aren", "class": "lord", "level": 1, "weapon": "ironSword", "lord": true, "stats": { … } }],
  "unitGroups": {
    "main": [{ "id": "raider-1", "name": "Saqueador", "class": "brigand", "level": 1, "weapon": "ironAxe", "at": [5, 2], "ai": "charge", "boss": false }]
  }
}
```

The two routes share one map: a route picks which unit groups appear, a flat enemy level bonus, the AI offense bias and the number of deploy slots.

The sample chapter (`sample-01`) is a 14×10 rout map: four party members on easy (three on hard) against six enemies (seven on hard). A greedy scripted player wins easy in 4–7 turns in 10 of 12 seeds and hard in 4 of 12 (balance smoke test, not a test suite).
