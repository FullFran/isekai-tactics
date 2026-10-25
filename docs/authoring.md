# Authoring content

Everything a player sees on the map (chapters, classes, weapons, terrain) is data. You can edit it by hand or describe what you want to Claude. Either way, finish with:

```bash
npm run validate
```

It checks every chapter, the rule tables and the Spanish/English names, and prints each problem with the file and the exact place, for example:

```
src/data/chapters/ch02-bridge.json: unitGroups.guards[0].weapon: soldier cannot wield sword ("ironSword")
```

Fix the line it points at and run it again until it says `content ok`.

## Asking Claude

Paste a request like this one; the more concrete, the better:

> Add chapter 2, "The Broken Bridge" (es: "El puente roto"). 8×5 map: a river across row 2 with one road crossing, a fort in the top-left corner that the lord must seize. Party: Aren (lord, level 2) and Lio (cavalier, level 3). Enemies: a level-2 soldier guarding the bridge, a level-4 mercenary boss on the fort who never moves. On hard, add an archer who charges. Run `npm run validate` and `npm test` when done.

Claude follows `CLAUDE.md`: content goes under `src/data`, the engine does not change for a content request, and validation must pass.

## Add a chapter

1. Create `src/data/chapters/<id>.json` (see the worked example and the reference below).
2. Register it in `src/data/chapters/index.ts`:
   ```ts
   import bridge from './ch02-bridge.json';
   export const CHAPTERS = { [sample.id]: sample, [bridge.id]: bridge };
   ```
   `npm run validate` reports any JSON file in that folder that is not registered.
3. `npm run validate`.

### Worked example

```json
{
  "id": "ch02-bridge",
  "title": { "es": "El puente roto", "en": "The Broken Bridge" },
  "map": {
    "legend": { ".": "plain", "F": "forest", "~": "river", "=": "road", "T": "fort", "#": "wall" },
    "rows": [
      "##..F...",
      "#T......",
      "~~~=~~~~",
      "..F.....",
      "........"
    ]
  },
  "objective": { "type": "seize", "tile": [1, 1] },
  "routes": {
    "easy": { "enemyLevelBonus": 0, "aiOffenseBias": 0.5, "deploySlots": 2, "unitGroups": ["guards"] },
    "hard": { "enemyLevelBonus": 2, "aiOffenseBias": 2, "deploySlots": 2, "unitGroups": ["guards", "ambush"] }
  },
  "playerStarts": [[3, 4], [4, 4]],
  "party": [
    { "id": "aren", "name": "Aren", "class": "lord", "level": 2, "weapon": "ironSword", "lord": true },
    { "id": "lio", "name": "Lio", "class": "cavalier", "level": 3, "weapon": "ironLance" }
  ],
  "unitGroups": {
    "guards": [
      { "id": "guard-1", "name": "Guardia", "class": "soldier", "level": 2, "weapon": "ironLance", "at": [3, 1], "ai": "inRange" },
      { "id": "captain", "name": "Capitana", "class": "mercenary", "level": 4, "weapon": "ironSword", "at": [1, 1], "ai": "guard", "boss": true }
    ],
    "ambush": [
      { "id": "archer-1", "name": "Arquero", "class": "archer", "level": 2, "weapon": "ironBow", "at": [6, 0], "ai": "charge" }
    ]
  }
}
```

Coordinates are `[x, y]`: `x` is the column (0 = left), `y` the row (0 = top). In this map `[1, 1]` is the `T` (fort) and `[3, 2]` is the `=` road crossing the river.

### Chapter reference

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique across chapters; used to register it. |
| `title` | `{ "es": string, "en": string }` | One entry per UI language. |
| `map.legend` | `{ char: terrainId }` | Single-character keys; values are terrain ids (table below). |
| `map.rows` | string[] | Top row first; every row the same length; every character in the legend. |
| `objective` | `{ "type": "rout" }` or `{ "type": "seize", "tile": [x, y] }` | Rout: defeat every enemy. Seize: the lord ends a move on the tile and picks *Seize*. |
| `rules.lordLossFails` | boolean, optional | Default `true`: the chapter fails when the lord retreats. |
| `rules.wound` | `{ "enabled": boolean, "penaltyPct": number }`, optional | Default off. Flags retreated units with a wound for later chapters. |
| `routes.easy`, `routes.hard` | route object | Both required (below). |
| `playerStarts` | `[x, y][]` | Deploy order: the lord takes the first, then party order. Passable tiles. |
| `party` | party member[] | Exactly one `"lord": true`. |
| `unitGroups` | `{ groupName: enemy[] }` | Named groups of enemies; routes pick which groups appear. |

**Route object**

| Field | Type | Rules |
|---|---|---|
| `enemyLevelBonus` | integer | Added to every enemy level on this route (capped at 20). |
| `aiOffenseBias` | number ≥ 0 | 0 = cautious, 0.5 ≈ balanced-cautious, 2–3 = aggressive. |
| `deploySlots` | integer | 1 … min(party size, number of player starts). |
| `unitGroups` | string[] | Group names from `unitGroups`. Tiles used on one route must not overlap. |

**Party member**

| Field | Type | Rules |
|---|---|---|
| `id` | string | Unique across the whole chapter (party and enemies). |
| `name` | string | Shown in the UI as written. |
| `class` | class id | From `src/data/rules.ts`. |
| `level` | integer 1–20 | |
| `weapon` | weapon id or `null` | The class must be able to wield its type. |
| `lord` | boolean, optional | Exactly one per chapter. |
| `stats` | all ten stats, optional | `hp, str, mag, skl, spd, lck, def, res, con, mov`. Without it: class bases + fixed growth per level. |
| `growths` | all ten stats in %, optional | Defaults to the class growths. |

**Enemy**: same `id`, `name`, `class`, `level`, `weapon` as a party member, plus:

| Field | Type | Rules |
|---|---|---|
| `at` | `[x, y]` | Inside the map, passable for at least one movement type. |
| `ai` | `"charge"`, `"inRange"` or `"guard"` | Charge always advances; inRange acts only when a target is reachable this turn; guard never moves. |
| `boss` | boolean, optional | Extra EXP on kill; drawn with a dark outline. |

## Unit groups and routes

A route is a difficulty variant of the same map. Put enemies shared by both routes in one group (`"main"`), extra enemies in another (`"hardExtra"`), and list the groups each route uses. Make the hard route harder with `enemyLevelBonus`, a higher `aiOffenseBias` and fewer `deploySlots`.

## Add a class

1. `src/data/rules.ts`, in `classes`: `klass(id, movementType, critBonus, weaponTypes, bases, growths)`. `movementType` is `foot`, `armor`, `mounted` or `flier`; `weaponTypes` from `sword`, `lance`, `axe`, `bow`, `anima`; bases and growths use `s(hp, str, mag, skl, spd, lck, def, res, con, mov)`.
2. Add `"class.<id>"` to both `src/i18n/es.json` and `src/i18n/en.json`.
3. Optional: a placeholder letter in `CLASS_GLYPH` (`src/adapters/canvas.ts`) and a sprite in a local sprite pack.
4. `npm run validate && npm test`.

## Add a weapon

1. `src/data/rules.ts`, in `weapons`: `weapon(id, type, might, hit, crit, weight, minRange, maxRange, effectiveAgainst)`. Ranges default to 1–1; `effectiveAgainst` is a list of movement types (might ×3).
2. Add `"weapon.<id>"` to both i18n files.
3. `npm run validate && npm test`.

## Add a terrain

1. `src/data/rules.ts`, in `terrains`: `terrain(id, avoid, def, healPct, [foot, armor, mounted, flier])`; a cost of `null` means that movement type cannot enter.
2. Add `"terrain.<id>"` to both i18n files.
3. Optional: a colour in `TERRAIN_COLOURS` (`src/adapters/canvas.ts`) and a tile in a local sprite pack.
4. Use it in a chapter by adding a legend character.

Changing numbers in existing classes, weapons or terrain changes game balance: say so explicitly when asking for it, and run `npm test` afterwards.

## Sprite packs (local only)

The committed art is placeholder shapes. To try other sprites privately (including third-party sprites you must not redistribute), put a **sprite pack** in `assets-local/` at the project root. That folder is git-ignored: it is never committed, and normal builds leave it out.

1. Copy the template: `mkdir -p assets-local && cp docs/sprite-pack.example.json assets-local/pack.json`.
2. Put your PNG sheets next to it (paths in the manifest are relative to `assets-local/`).
3. Edit `pack.json` to map what you have; delete entries you do not have images for.
4. `npm run dev`. Anything the pack maps is drawn from it; everything else (and any sheet that fails to load) keeps the placeholder art. Problems with the manifest are printed in the browser console and the game falls back to placeholders.
5. Before committing, `git status` must not list anything under `assets-local/`.

### Manifest reference

| Field | Meaning |
|---|---|
| `version` | Always `1`. |
| `name` | Optional label. |
| `tileSize` | Pixel size of one map tile in your sheets (default 16). Sprites are scaled so one tile fills a map square; a 32×32 frame with `tileSize` 16 spans two squares wide and stands on the bottom edge of its tile. |
| `classes.<classId>` | Map sprite for every unit of that class. |
| `units.<unitId>` | Map sprite for one unit (overrides its class), e.g. a named character. |
| `terrain.<terrainId>` | `{ "sheet", "col", "row" }`: the tile at that cell (in `tileSize` units). |

**Unit sprite**

| Field | Meaning |
|---|---|
| `sheet` | PNG path, relative to `assets-local/`. |
| `frameWidth`, `frameHeight` | Size of one frame in pixels. |
| `idle` | `{ "row", "col"?, "frames", "frameMs", "pingPong"? }`: frames run left to right from `col` (default 0) on `row`; `pingPong` plays 0,1,2,1,0… |
| `moving` | Optional, same shape; played while the unit is selected or being moved. Defaults to `idle`. |
| `factions.player`, `factions.enemy` | Optional `{ "sheet"?, "tint"? }`: a separate sheet per faction (recommended) and/or a colour (`#rrggbb`) laid over the sprite. Without an `enemy` entry, enemies are tinted red. Units that already acted are greyed out. |

To include the pack in a production build for a **private** test, run `INCLUDE_LOCAL_SPRITES=1 npm run build`; it copies `assets-local/` into `dist/`. Never publish such a build.
