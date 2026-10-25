import { describe, expect, it } from 'vitest';
import { MOVEMENT_TYPES } from '../../src/core/grid';
import { STAT_KEYS } from '../../src/core/unit';
import { RULES } from '../../src/data/rules';

describe('rule tables', () => {
  it('give every class complete bases and growths and only known weapon types', () => {
    const weaponTypes = new Set(Object.values(RULES.weapons).map((w) => w.type));
    for (const klass of Object.values(RULES.classes)) {
      expect(Object.keys(klass.bases).sort()).toEqual([...STAT_KEYS].sort());
      expect(Object.keys(klass.growths).sort()).toEqual([...STAT_KEYS].sort());
      expect(klass.weaponTypes.length).toBeGreaterThan(0);
      for (const type of klass.weaponTypes) expect(weaponTypes.has(type)).toBe(true);
    }
  });

  it('cover the five weapon types and key ids by their own id', () => {
    expect([...new Set(Object.values(RULES.weapons).map((w) => w.type))].sort()).toEqual(['anima', 'axe', 'bow', 'lance', 'sword']);
    for (const table of [RULES.weapons, RULES.classes, RULES.terrains]) {
      for (const [id, entry] of Object.entries(table)) expect(entry.id).toBe(id);
    }
  });

  it('define a cost (or null) for every movement type on every terrain, and plains cost 1', () => {
    for (const terrain of Object.values(RULES.terrains)) {
      expect(Object.keys(terrain.moveCost).sort()).toEqual([...MOVEMENT_TYPES].sort());
    }
    expect(Object.values(RULES.terrains.plain!.moveCost)).toEqual([1, 1, 1, 1]);
  });
});
