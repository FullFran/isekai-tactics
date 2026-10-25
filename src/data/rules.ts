import type { MovementType, Terrain } from '../core/grid';
import type { ClassDef, Rules, Stats, WeaponDef } from '../core/unit';

// Calibration: GBA-era magnitudes as a hint, our own numbers. See README "Calibration".

const s = (hp: number, str: number, mag: number, skl: number, spd: number, lck: number, def: number, res: number, con: number, mov: number): Stats =>
  ({ hp, str, mag, skl, spd, lck, def, res, con, mov });

type Cost = number | null;
const terrain = (id: string, avoid: number, def: number, healPct: number, [foot, armor, mounted, flier]: [Cost, Cost, Cost, Cost]): Terrain =>
  ({ id, avoid, def, healPct, moveCost: { foot, armor, mounted, flier } satisfies Record<MovementType, Cost> });

const terrains: Record<string, Terrain> = {
  plain: terrain('plain', 0, 0, 0, [1, 1, 1, 1]),
  road: terrain('road', 0, 0, 0, [1, 1, 1, 1]),
  forest: terrain('forest', 20, 1, 0, [2, 2, 3, 1]),
  hill: terrain('hill', 30, 1, 0, [3, null, 4, 1]),
  village: terrain('village', 10, 0, 0, [1, 1, 1, 1]),
  fort: terrain('fort', 20, 2, 20, [2, 2, 2, 1]),
  gate: terrain('gate', 30, 3, 10, [1, 1, 1, 1]),
  river: terrain('river', 0, 0, 0, [5, null, null, 1]),
  wall: terrain('wall', 0, 0, 0, [null, null, null, null]),
};

const weapon = (id: string, type: WeaponDef['type'], might: number, hit: number, crit: number, weight: number, minRange = 1, maxRange = 1, effectiveAgainst: MovementType[] = []): WeaponDef =>
  ({ id, type, might, hit, crit, weight, minRange, maxRange, effectiveAgainst });

const weapons: Record<string, WeaponDef> = {
  ironSword: weapon('ironSword', 'sword', 5, 90, 0, 5),
  slimSword: weapon('slimSword', 'sword', 3, 100, 5, 2),
  ironLance: weapon('ironLance', 'lance', 7, 80, 0, 8),
  javelin: weapon('javelin', 'lance', 6, 65, 0, 11, 1, 2),
  ironAxe: weapon('ironAxe', 'axe', 8, 75, 0, 10),
  handAxe: weapon('handAxe', 'axe', 7, 60, 0, 12, 1, 2),
  ironBow: weapon('ironBow', 'bow', 6, 85, 0, 5, 2, 2, ['flier']),
  fire: weapon('fire', 'anima', 5, 90, 0, 4, 1, 2),
};

const klass = (id: string, movementType: MovementType, critBonus: number, weaponTypes: ClassDef['weaponTypes'], bases: Stats, growths: Stats): ClassDef =>
  ({ id, movementType, critBonus, weaponTypes, bases, growths });

const classes: Record<string, ClassDef> = {
  lord: klass('lord', 'foot', 0, ['sword'], s(18, 5, 1, 6, 7, 5, 4, 1, 7, 5), s(80, 45, 5, 50, 50, 45, 30, 30, 0, 0)),
  mercenary: klass('mercenary', 'foot', 0, ['sword'], s(20, 5, 0, 8, 7, 0, 4, 0, 9, 5), s(80, 40, 0, 40, 40, 30, 25, 20, 0, 0)),
  myrmidon: klass('myrmidon', 'foot', 15, ['sword'], s(16, 4, 0, 9, 10, 0, 2, 0, 6, 5), s(70, 30, 0, 50, 55, 35, 15, 20, 0, 0)),
  soldier: klass('soldier', 'foot', 0, ['lance'], s(20, 3, 0, 1, 1, 0, 4, 0, 6, 5), s(80, 50, 0, 30, 20, 25, 25, 15, 0, 0)),
  knight: klass('knight', 'armor', 0, ['lance'], s(17, 5, 0, 2, 0, 0, 7, 0, 13, 4), s(80, 40, 0, 30, 15, 25, 40, 10, 0, 0)),
  cavalier: klass('cavalier', 'mounted', 0, ['sword', 'lance'], s(20, 5, 0, 2, 5, 0, 6, 0, 9, 7), s(75, 35, 0, 40, 30, 30, 15, 15, 0, 0)),
  fighter: klass('fighter', 'foot', 0, ['axe'], s(20, 5, 0, 2, 4, 0, 2, 0, 11, 5), s(85, 55, 0, 30, 20, 15, 15, 5, 0, 0)),
  brigand: klass('brigand', 'foot', 0, ['axe'], s(20, 5, 0, 1, 5, 0, 3, 0, 12, 5), s(82, 50, 0, 30, 20, 15, 10, 13, 0, 0)),
  archer: klass('archer', 'foot', 0, ['bow'], s(18, 4, 0, 3, 3, 0, 3, 0, 7, 5), s(70, 35, 0, 40, 32, 35, 15, 15, 0, 0)),
  mage: klass('mage', 'foot', 0, ['anima'], s(16, 0, 4, 2, 3, 0, 2, 3, 6, 5), s(70, 0, 55, 40, 35, 20, 5, 30, 0, 0)),
};

export const RULES: Rules = { terrains, classes, weapons };
