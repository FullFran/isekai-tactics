import { describe, expect, it } from 'vitest';
import { applyAction, createBattle } from '../../src/core/battle';
import { combatExp, gainExp, levelUp, MAX_LEVEL } from '../../src/core/exp';
import { createRng } from '../../src/core/rng';
import { openGrid, rules, stats, unit } from './fixtures';

const zero = stats({ hp: 0, str: 0, mag: 0, skl: 0, spd: 0, lck: 0, def: 0, res: 0, con: 0, mov: 0 });

describe('combatExp', () => {
  it('gives 1 for no damage, a level-scaled amount for damage and a bonus for a kill', () => {
    const own = unit({ id: 'p', level: 5 });
    expect(combatExp(own, unit({ id: 'e', level: 5 }), { dealtDamage: false, killed: false })).toBe(1);
    expect(combatExp(own, unit({ id: 'e', level: 5 }), { dealtDamage: true, killed: false })).toBe(10);
    expect(combatExp(own, unit({ id: 'e', level: 8 }), { dealtDamage: true, killed: false })).toBe(11);
    expect(combatExp(own, unit({ id: 'e', level: 5 }), { dealtDamage: true, killed: true })).toBe(30);
    expect(combatExp(own, unit({ id: 'e', level: 7, boss: true }), { dealtDamage: true, killed: true })).toBe(11 + 26 + 40);
    expect(combatExp(unit({ id: 'p', level: 1 }), unit({ id: 'e', level: 20, boss: true }), { dealtDamage: true, killed: true })).toBe(100);
    expect(combatExp(unit({ id: 'p', level: 15 }), unit({ id: 'e', level: 1 }), { dealtDamage: true, killed: true })).toBe(5);
  });
});

describe('levelUp', () => {
  it('rolls one RN per stat against its growth, with guaranteed points above 100%', () => {
    const u = unit({ id: 'p', growths: { ...zero, hp: 100, str: 150, skl: 50 } });
    const before = { ...u.stats };
    const rng = createRng(3);
    const gains = levelUp(u, rng);
    expect(u.level).toBe(2);
    expect(gains.hp).toBe(1);
    expect([1, 2]).toContain(gains.str);
    expect(gains.spd).toBe(0);
    expect(u.stats.str).toBe(before.str + gains.str);
    expect(u.hp).toBe(before.hp + 1);
    expect(rng.log.slice(0, 10).map((e) => e.reason)).toEqual(['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'con', 'mov'].map((k) => `levelup:${k}`));
    const strRn = rng.log[1]!.value;
    expect(gains.str).toBe(strRn < 50 ? 2 : 1);
  });

  it('re-rolls a blank level-up at most twice', () => {
    const u = unit({ id: 'p', growths: zero });
    const rng = createRng(1);
    const gains = levelUp(u, rng);
    expect(Object.values(gains).every((g) => g === 0)).toBe(true);
    expect(rng.log).toHaveLength(30);
  });
});

describe('gainExp', () => {
  it('levels up at 100 and keeps the remainder; does nothing at the level cap', () => {
    const u = unit({ id: 'p', exp: 95, growths: { ...zero, hp: 100 } });
    const ups = gainExp(u, 10, createRng(1));
    expect([u.level, u.exp, ups.length]).toEqual([2, 5, 1]);
    const capped = unit({ id: 'q', level: MAX_LEVEL, exp: 0 });
    expect(gainExp(capped, 50, createRng(1))).toEqual([]);
    expect([capped.level, capped.exp]).toEqual([MAX_LEVEL, 0]);
  });
});

describe('EXP in battle', () => {
  it('awards EXP to player units after combat (not to enemies) and reports level-ups', () => {
    const s0 = createBattle({
      grid: openGrid(4, 1),
      objective: { type: 'rout' },
      seed: 11,
      units: [
        unit({ id: 'lord', lord: true, classId: 'killer', weaponId: 'edge', exp: 90, stats: stats({ str: 30, spd: 30 }), growths: { ...zero, str: 100 } }),
        unit({ id: 'foe', faction: 'enemy', pos: { x: 1, y: 0 } }),
        unit({ id: 'foe2', faction: 'enemy', pos: { x: 3, y: 0 } }),
      ],
    });
    const s = applyAction(rules, s0, { type: 'attack', unitId: 'lord', targetId: 'foe' });
    const lord = s.units.find((u) => u.id === 'lord')!;
    expect(s.events).toContainEqual({ type: 'exp', unitId: 'lord', amount: 30 });
    expect([lord.level, lord.exp, lord.stats.str]).toEqual([2, 20, 31]);
    expect(s.events.some((e) => e.type === 'levelUp' && e.unitId === 'lord')).toBe(true);
    expect(s.units.find((u) => u.id === 'foe')!.exp).toBe(0);
  });
});
