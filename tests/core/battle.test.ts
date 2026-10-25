import { describe, expect, it } from 'vitest';
import { activeUnits, applyAction, createBattle, replay, type Action, type BattleSetup } from '../../src/core/battle';
import { parseGrid } from '../../src/core/grid';
import { legend, rules, stats, unit } from './fixtures';

function setup(over: Partial<BattleSetup> = {}): BattleSetup {
  return {
    grid: parseGrid(['......', '......', '.....G'], legend),
    units: [
      unit({ id: 'lord', lord: true, pos: { x: 0, y: 0 } }),
      unit({ id: 'ally', pos: { x: 0, y: 1 } }),
      unit({ id: 'foe1', faction: 'enemy', pos: { x: 4, y: 0 }, weaponId: 'axe' }),
      unit({ id: 'foe2', faction: 'enemy', pos: { x: 4, y: 1 }, weaponId: 'axe' }),
    ],
    objective: { type: 'rout' },
    seed: 1234,
    ...over,
  };
}

const play = (state: ReturnType<typeof createBattle>, actions: Action[]) => actions.reduce((s, a) => applyAction(rules, s, a), state);

describe('phase loop', () => {
  it('starts on turn 1 player phase, alternates phases and resets action flags', () => {
    let s = createBattle(setup());
    expect([s.turn, s.phase]).toEqual([1, 'player']);
    s = play(s, [{ type: 'move', unitId: 'lord', to: { x: 1, y: 0 } }, { type: 'wait', unitId: 'lord' }]);
    expect(s.units.find((u) => u.id === 'lord')).toMatchObject({ pos: { x: 1, y: 0 }, moved: true, acted: true });
    s = applyAction(rules, s, { type: 'endPhase' });
    expect([s.turn, s.phase]).toEqual([1, 'enemy']);
    s = applyAction(rules, s, { type: 'endPhase' });
    expect([s.turn, s.phase]).toEqual([2, 'player']);
    expect(s.units.find((u) => u.id === 'lord')).toMatchObject({ moved: false, acted: false });
  });

  it('never mutates the previous state and logs every action', () => {
    const s0 = createBattle(setup());
    const snapshot = structuredClone(s0);
    const s1 = applyAction(rules, s0, { type: 'wait', unitId: 'ally' });
    expect(s0).toEqual(snapshot);
    expect(s1.log).toEqual([{ type: 'wait', unitId: 'ally' }]);
  });

  it('rejects illegal actions', () => {
    const s = createBattle(setup());
    expect(() => applyAction(rules, s, { type: 'move', unitId: 'lord', to: { x: 5, y: 2 } })).toThrow(/reach/);
    expect(() => applyAction(rules, s, { type: 'wait', unitId: 'foe1' })).toThrow(/phase/);
    expect(() => applyAction(rules, s, { type: 'attack', unitId: 'lord', targetId: 'foe1' })).toThrow(/range/);
    const waited = applyAction(rules, s, { type: 'wait', unitId: 'lord' });
    expect(() => applyAction(rules, waited, { type: 'move', unitId: 'lord', to: { x: 1, y: 0 } })).toThrow(/acted/);
  });

  it('heals units standing on healing terrain at the start of their phase', () => {
    const grid = parseGrid(['T.....', '......', '......'], legend);
    const s0 = createBattle(setup({ grid }));
    s0.units[0]!.hp = 5; // lord on the fort, max 20, fort heals 20%
    const s = play(s0, [{ type: 'endPhase' }, { type: 'endPhase' }]);
    expect(s.units[0]!.hp).toBe(9);
  });
});

describe('combat in the battle', () => {
  it('applies combat damage and records a combat event', () => {
    const s0 = createBattle(setup());
    const s = play(s0, [
      { type: 'move', unitId: 'lord', to: { x: 3, y: 0 } },
      { type: 'attack', unitId: 'lord', targetId: 'foe1' },
    ]);
    const event = s.events.find((e) => e.type === 'combat');
    expect(event).toBeDefined();
    const foe = s.units.find((u) => u.id === 'foe1')!;
    const lord = s.units.find((u) => u.id === 'lord')!;
    expect(lord.acted).toBe(true);
    if (event?.type === 'combat') {
      expect(foe.hp).toBe(event.result.defenderHp);
      expect(lord.hp).toBe(event.result.attackerHp);
    }
  });
});

describe('no permadeath', () => {
  const lethalFoe = (over = {}) => unit({ id: 'reaper', faction: 'enemy', classId: 'killer', weaponId: 'edge', pos: { x: 2, y: 1 }, stats: stats({ str: 30, spd: 30 }), ...over });

  it('a defeated player unit retreats: off the map, flagged, map progress forfeited', () => {
    const base = setup({ units: [unit({ id: 'lord', lord: true, pos: { x: 0, y: 2 } }), unit({ id: 'ally', pos: { x: 1, y: 1 } }), lethalFoe()] });
    let s = createBattle(base);
    s.units[1]!.level = 3; // pretend the ally levelled up during the map
    s.units[1]!.exp = 40;
    s = play(s, [{ type: 'endPhase' }, { type: 'attack', unitId: 'reaper', targetId: 'ally' }]);
    const ally = s.units.find((u) => u.id === 'ally')!;
    expect(ally.status).toBe('retreated');
    expect([ally.level, ally.exp]).toEqual([1, 0]);
    expect(ally.wound).toBeNull();
    expect(activeUnits(s).map((u) => u.id)).not.toContain('ally');
    expect(s.events.some((e) => e.type === 'retreat' && e.unitId === 'ally')).toBe(true);
    expect(s.outcome).toBe('ongoing');
  });

  it('applies the wound hook only when the config enables it', () => {
    const base = setup({
      units: [unit({ id: 'lord', lord: true, pos: { x: 0, y: 2 } }), unit({ id: 'ally', pos: { x: 1, y: 1 } }), lethalFoe()],
      config: { lordLossFails: true, wound: { enabled: true, penaltyPct: 10 } },
    });
    const s = play(createBattle(base), [{ type: 'endPhase' }, { type: 'attack', unitId: 'reaper', targetId: 'ally' }]);
    expect(s.units.find((u) => u.id === 'ally')!.wound).toEqual({ penaltyPct: 10 });
  });

  it('the lord retreating fails the chapter', () => {
    const base = setup({ units: [unit({ id: 'lord', lord: true, pos: { x: 1, y: 1 } }), unit({ id: 'ally', pos: { x: 5, y: 0 } }), lethalFoe()] });
    const s = play(createBattle(base), [{ type: 'endPhase' }, { type: 'attack', unitId: 'reaper', targetId: 'lord' }]);
    expect(s.outcome).toBe('defeat');
    expect(() => applyAction(rules, s, { type: 'endPhase' })).toThrow(/over/);
  });
});

describe('objectives', () => {
  it('rout: defeating the last enemy wins', () => {
    const base = setup({
      units: [unit({ id: 'lord', lord: true, classId: 'killer', weaponId: 'edge', stats: stats({ str: 30, spd: 30 }), pos: { x: 0, y: 0 } }), unit({ id: 'foe', faction: 'enemy', pos: { x: 2, y: 0 } })],
    });
    const s = play(createBattle(base), [{ type: 'move', unitId: 'lord', to: { x: 1, y: 0 } }, { type: 'attack', unitId: 'lord', targetId: 'foe' }]);
    expect(s.units.find((u) => u.id === 'foe')!.status).toBe('defeated');
    expect(s.outcome).toBe('victory');
  });

  it('seize: only the lord standing on the seize tile can seize', () => {
    const base = setup({ objective: { type: 'seize', tile: { x: 5, y: 2 } }, units: [unit({ id: 'lord', lord: true, pos: { x: 3, y: 2 } }), unit({ id: 'ally', pos: { x: 4, y: 2 } }), unit({ id: 'foe', faction: 'enemy', pos: { x: 0, y: 0 } })] });
    const s0 = createBattle(base);
    expect(() => play(s0, [{ type: 'move', unitId: 'ally', to: { x: 5, y: 2 } }, { type: 'seize', unitId: 'ally' }])).toThrow(/lord/);
    const s = play(s0, [{ type: 'move', unitId: 'ally', to: { x: 4, y: 1 } }, { type: 'move', unitId: 'lord', to: { x: 5, y: 2 } }, { type: 'seize', unitId: 'lord' }]);
    expect(s.outcome).toBe('victory');
  });
});

describe('determinism', () => {
  const actions: Action[] = [
    { type: 'move', unitId: 'lord', to: { x: 3, y: 0 } },
    { type: 'attack', unitId: 'lord', targetId: 'foe1' },
    { type: 'move', unitId: 'ally', to: { x: 3, y: 1 } },
    { type: 'attack', unitId: 'ally', targetId: 'foe2' },
    { type: 'endPhase' },
    { type: 'attack', unitId: 'foe1', targetId: 'lord' },
    { type: 'endPhase' },
  ];

  it('same seed and same actions give the same state; replaying the log reproduces it', () => {
    const a = play(createBattle(setup()), actions);
    const b = play(createBattle(setup()), actions);
    expect(a).toEqual(b);
    expect(replay(rules, createBattle(setup()), a.log)).toEqual(a);
    expect(a.rng.log.length).toBeGreaterThan(0);
  });

  it('a different seed draws different RNs', () => {
    const a = play(createBattle(setup()), actions.slice(0, 2));
    const c = play(createBattle(setup({ seed: 999 })), actions.slice(0, 2));
    expect(c.rng.log.map((e) => e.value)).not.toEqual(a.rng.log.map((e) => e.value));
  });
});
