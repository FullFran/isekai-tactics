import { parseGrid, type Terrain } from '../../src/core/grid';
import type { ClassDef, Rules, Stats, Unit, WeaponDef } from '../../src/core/unit';

export const stats = (over: Partial<Stats> = {}): Stats => ({
  hp: 20, str: 5, mag: 0, skl: 5, spd: 5, lck: 0, def: 0, res: 0, con: 7, mov: 5, ...over,
});

const terrain = (id: string, avoid: number, def: number, cost: number | null, healPct = 0): Terrain => ({
  id, avoid, def, healPct, moveCost: { foot: cost, armor: cost, mounted: cost, flier: cost === null ? null : 1 },
});

const weapon = (over: Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'type'>): WeaponDef => ({
  might: 5, hit: 80, crit: 0, weight: 5, minRange: 1, maxRange: 1, effectiveAgainst: [], ...over,
});

const klass = (id: string, over: Partial<ClassDef> = {}): ClassDef => ({
  id, movementType: 'foot', bases: stats(), growths: stats({ hp: 0, str: 0, skl: 0, spd: 0, con: 0, mov: 0 }), critBonus: 0, weaponTypes: ['sword', 'lance', 'axe', 'bow', 'anima'], ...over,
});

export const rules: Rules = {
  terrains: {
    plain: terrain('plain', 0, 0, 1),
    forest: terrain('forest', 20, 1, 2),
    fort: terrain('fort', 20, 2, 2, 20),
    wall: terrain('wall', 0, 0, null),
    gate: terrain('gate', 20, 2, 1),
  },
  classes: {
    blade: klass('blade'),
    brute: klass('brute'),
    killer: klass('killer', { critBonus: 15 }),
    flier: klass('flier', { movementType: 'flier' }),
  },
  weapons: {
    sword: weapon({ id: 'sword', type: 'sword', might: 5, hit: 90, weight: 5 }),
    axe: weapon({ id: 'axe', type: 'axe', might: 8, hit: 75, weight: 10 }),
    lance: weapon({ id: 'lance', type: 'lance', might: 7, hit: 80, weight: 8 }),
    bow: weapon({ id: 'bow', type: 'bow', might: 6, hit: 85, weight: 5, minRange: 2, maxRange: 2, effectiveAgainst: ['flier'] }),
    fire: weapon({ id: 'fire', type: 'anima', might: 5, hit: 90, weight: 4, minRange: 1, maxRange: 2 }),
    edge: weapon({ id: 'edge', type: 'sword', might: 5, hit: 200, crit: 200, weight: 0 }),
  },
};

export const legend = { '.': 'plain', F: 'forest', T: 'fort', '#': 'wall', G: 'gate' };
export const openGrid = (w: number, h: number) => parseGrid(Array.from({ length: h }, () => '.'.repeat(w)), legend);

export function unit(over: Partial<Unit> & Pick<Unit, 'id'>): Unit {
  const s = over.stats ?? stats();
  return {
    name: over.id, faction: 'player', classId: 'blade', movementType: 'foot', pos: { x: 0, y: 0 }, level: 1, exp: 0,
    hp: s.hp, stats: s, growths: stats({ hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0, con: 0, mov: 0 }),
    weaponId: 'sword', lord: false, boss: false, status: 'active', moved: false, acted: false, ai: null,
    progressAtStart: null, wound: null, ...over,
  };
}
