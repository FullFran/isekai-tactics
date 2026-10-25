# Credits

Isekai Tactics is an original tactics game. Code: Fran. Story and chapters: Andrés.

## Font

[Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) by The Pixelify Sans Project Authors, under the
SIL Open Font License 1.1 (`public/fonts/PixelifySans-OFL.txt`).

## Art

Map sprites and terrain tiles: **"DawnLike - 16x16 Universal Rogue-like tileset v1.81" by DragonDePlatino**,
palette (DB32) by **DawnBringer**. The Commissions sprites used here (Paladin, Warrior, Mage) were commissioned by Romet.

- Source: https://opengameart.org/content/dawnlike-16x16-universal-rogue-like-tileset-v181
- License: CC-BY 4.0, https://creativecommons.org/licenses/by/4.0/ (the author's README with the terms is in
  `public/sprites/dawnlike/DawnLike-README.txt`).
- Files used: `Characters/Player0.png`, `Player1.png`, `Humanoid0.png`, `Humanoid1.png`; `Commissions/Paladin.png`,
  `Warrior.png`, `Mage.png`; `Objects/Floor.png`, `Tree0.png`, `Hill0.png`, `Map0.png`, `Pit0.png`.
- Changes: 16x16 cells were cropped from those sheets and rearranged into `public/sprites/dawnlike/units.png`,
  `units-enemy.png` and `terrain.png`; terrain cells composite a tree, hill or building over a grass cell; enemy units
  are tinted red at runtime. The exact cells are listed in `public/sprites/dawnlike/SOURCES.txt`.

Anything the pack does not map is drawn in code (`src/adapters/canvas.ts`). Local sprite packs (`assets-local/`,
git-ignored) are private and never published.

## Interface

Window style, cursor menus and controls are adapted from Mazmorra Sombría, by the same author.

## Music

None yet.
