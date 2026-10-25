import { describe, expect, it } from 'vitest';
import { forecastCombat, resolveCombat, trueHit } from '../../src/core/combat';
import { parseGrid } from '../../src/core/grid';
import { createRng } from '../../src/core/rng';
import { legend, openGrid, rules, stats, unit } from './fixtures';

const swordsman = () =>
  unit({ id: 'A', pos: { x: 0, y: 0 }, weaponId: 'sword', stats: stats({ hp: 20, str: 5, skl: 6, spd: 7, lck: 3, def: 4, con: 7 }) });
const fighter = () =>
  unit({ id: 'D', faction: 'enemy', classId: 'brute', pos: { x: 1, y: 0 }, weaponId: 'axe', stats: stats({ hp: 26, str: 7, skl: 3, spd: 3, lck: 1, def: 3, con: 11 }) });

describe('trueHit (2RN)', () => {
  it('matches the known displayed-to-true table', () => {
    expect([10, 30, 50, 70, 80, 90, 95].map(trueHit)).toEqual([2.1, 18.3, 50.5, 82.3, 92.2, 98.1, 99.55]);
    expect(trueHit(0)).toBe(0);
    expect(trueHit(100)).toBe(100);
  });
});

describe('forecastCombat', () => {
  it('applies the formulas, the weapon triangle and doubling at AS +4', () => {
    const f = forecastCombat(rules, openGrid(3, 1), swordsman(), { x: 0, y: 0 }, fighter());
    // A: atk 5+5+1 = 11 - def 3 = 8; hit 90+12+1+15 = 118 - avoid (AS 3*2+1 = 7) -> 100; crit 3 - dodge 1 = 2.
    expect(f.attacker).toMatchObject({ damage: 8, hit: 100, trueHit: 100, crit: 2, strikes: 2 });
    // D: atk 7+8-1 = 14 - def 4 = 10; hit 75+6+0-15 = 66 - avoid (7*2+3 = 17) = 49; crit 1 - 3 -> 0.
    expect(f.defender).toMatchObject({ damage: 10, hit: 49, crit: 0, strikes: 1, canCounter: true });
    expect(f.defender.trueHit).toBeCloseTo(trueHit(49));
  });

  it('does not double below an AS gap of 4, and weight above Con slows the wielder', () => {
    const slowed = swordsman();
    slowed.stats.spd = 6; // AS gap 3
    expect(forecastCombat(rules, openGrid(3, 1), slowed, { x: 0, y: 0 }, fighter()).attacker.strikes).toBe(1);
    const weak = fighter();
    weak.stats.con = 6; // axe weight 10 - con 6 = -4 AS -> -1 (0 floor not applied to AS itself)
    expect(forecastCombat(rules, openGrid(3, 1), swordsman(), { x: 0, y: 0 }, weak).defender).toMatchObject({ attackSpeed: -1 });
  });

  it('adds the defender terrain avoid and def', () => {
    const grid = parseGrid(['.F'], legend);
    const f = forecastCombat(rules, grid, swordsman(), { x: 0, y: 0 }, fighter());
    expect(f.attacker.damage).toBe(7);
    expect(f.attacker.hit).toBe(91); // 118 - (7 + 20)
  });

  it('uses Mag vs Res for tomes and triples might when effective', () => {
    const mage = unit({ id: 'M', weaponId: 'fire', stats: stats({ str: 0, mag: 6 }) });
    const target = fighter();
    target.stats.res = 2;
    expect(forecastCombat(rules, openGrid(3, 1), mage, { x: 0, y: 0 }, target).attacker.damage).toBe(9);

    const archer = unit({ id: 'R', weaponId: 'bow', stats: stats({ str: 4 }) });
    const flier = unit({ id: 'F', faction: 'enemy', classId: 'flier', movementType: 'flier', pos: { x: 2, y: 0 }, stats: stats({ def: 4 }) });
    expect(forecastCombat(rules, openGrid(3, 1), archer, { x: 0, y: 0 }, flier).attacker.damage).toBe(4 + 18 - 4);
  });

  it('only lets the defender counter when the distance is inside its weapon range', () => {
    const archer = unit({ id: 'R', weaponId: 'bow' });
    const target = fighter();
    target.pos = { x: 2, y: 0 };
    const f = forecastCombat(rules, openGrid(3, 1), archer, { x: 0, y: 0 }, target);
    expect(f.defender.canCounter).toBe(false);
    expect(f.defender.strikes).toBe(0);
  });
});

describe('resolveCombat', () => {
  it('draws two RNs per hit check and one per crit check, in exchange order', () => {
    const f = forecastCombat(rules, openGrid(3, 1), swordsman(), { x: 0, y: 0 }, fighter());
    const rng = createRng(123);
    const result = resolveCombat(f, rng);
    expect(result.strikes.map((s) => s.attackerId)).toEqual(['A', 'D', 'A']);
    for (const strike of result.strikes) {
      const own = rng.log.slice(strike.rnFrom, strike.rnTo);
      expect(own.slice(0, 2).map((e) => e.reason)).toEqual(['hit', 'hit']);
      const hit = own[0]!.value + own[1]!.value < 2 * (strike.attackerId === 'A' ? f.attacker.hit : f.defender.hit);
      expect(strike.hit).toBe(hit);
      expect(own.length).toBe(hit ? 3 : 2);
      if (hit) expect(own[2]!.reason).toBe('crit');
    }
    const dealtToD = result.strikes.filter((s) => s.attackerId === 'A').reduce((sum, s) => sum + s.damage, 0);
    expect(result.defenderHp).toBe(26 - dealtToD);
  });

  it('stops as soon as a unit falls and triples damage on a crit', () => {
    const killer = unit({ id: 'K', classId: 'killer', weaponId: 'edge', stats: stats({ str: 5, spd: 20 }) });
    const target = fighter();
    target.hp = 20;
    const f = forecastCombat(rules, openGrid(3, 1), killer, { x: 0, y: 0 }, target);
    expect(f.attacker.crit).toBe(100);
    const result = resolveCombat(f, createRng(5));
    expect(result.strikes).toHaveLength(1);
    expect(result.strikes[0]).toMatchObject({ hit: true, crit: true, damage: 20 }); // (5+5+1-3)*3 = 24, capped at remaining HP
    expect(result.defenderHp).toBe(0);
  });

  it('is deterministic for the same seed', () => {
    const f = forecastCombat(rules, openGrid(3, 1), swordsman(), { x: 0, y: 0 }, fighter());
    expect(resolveCombat(f, createRng(9))).toEqual(resolveCombat(f, createRng(9)));
  });
});
