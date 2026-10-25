import { describe, expect, it } from 'vitest';
import { planEnemyTurn, runEnemyPhase } from '../../src/core/ai';
import { applyAction, createBattle, DEFAULT_CONFIG, type BattleSetup, type BattleState } from '../../src/core/battle';
import { manhattan, parseGrid } from '../../src/core/grid';
import type { Unit } from '../../src/core/unit';
import { legend, rules, stats, unit } from './fixtures';

const grid = parseGrid(Array.from({ length: 5 }, () => '..........'), legend);

function enemyPhase(units: Unit[], over: Partial<BattleSetup> = {}): BattleState {
  const s = createBattle({ grid, units, objective: { type: 'rout' }, seed: 7, ...over });
  return applyAction(rules, s, { type: 'endPhase' });
}

const foe = (over: Partial<Unit> & Pick<Unit, 'id'>) => unit({ faction: 'enemy', weaponId: 'axe', ai: 'charge', ...over });

describe('enemy AI v1', () => {
  it('charge: with nobody in reach, moves to get closer to the nearest player unit', () => {
    const s = enemyPhase([unit({ id: 'lord', lord: true, pos: { x: 0, y: 2 } }), foe({ id: 'e', pos: { x: 9, y: 2 }, stats: stats({ mov: 3 }) })]);
    const plan = planEnemyTurn(rules, s);
    expect(plan).toEqual([{ type: 'move', unitId: 'e', to: { x: 6, y: 2 } }, { type: 'wait', unitId: 'e' }]);
  });

  it('inRange: waits in place until a player unit is attackable, then attacks', () => {
    const far = enemyPhase([unit({ id: 'lord', lord: true, pos: { x: 0, y: 2 } }), foe({ id: 'e', ai: 'inRange', pos: { x: 9, y: 2 } })]);
    expect(planEnemyTurn(rules, far)).toEqual([{ type: 'wait', unitId: 'e' }]);
    const near = enemyPhase([unit({ id: 'lord', lord: true, pos: { x: 5, y: 2 } }), foe({ id: 'e', ai: 'inRange', pos: { x: 9, y: 2 } })]);
    const plan = planEnemyTurn(rules, near);
    expect(plan.at(-1)).toEqual({ type: 'attack', unitId: 'e', targetId: 'lord' });
    const move = plan[0];
    expect(move?.type === 'move' && manhattan(move.to, { x: 5, y: 2 })).toBe(1);
  });

  it('guard: never moves, attacks only what is already in weapon range', () => {
    const s = enemyPhase([unit({ id: 'lord', lord: true, pos: { x: 7, y: 2 } }), foe({ id: 'e', ai: 'guard', pos: { x: 9, y: 2 } })]);
    expect(planEnemyTurn(rules, s)).toEqual([{ type: 'wait', unitId: 'e' }]);
    const adjacent = enemyPhase([unit({ id: 'lord', lord: true, pos: { x: 8, y: 2 } }), foe({ id: 'e', ai: 'guard', pos: { x: 9, y: 2 } })]);
    expect(planEnemyTurn(rules, adjacent)).toEqual([{ type: 'attack', unitId: 'e', targetId: 'lord' }]);
  });

  it('prefers a target it can kill (kill bonus)', () => {
    const s = enemyPhase([
      unit({ id: 'lord', lord: true, pos: { x: 3, y: 1 } }),
      unit({ id: 'hurt', pos: { x: 3, y: 3 }, hp: 3 }),
      foe({ id: 'e', pos: { x: 6, y: 2 } }),
    ]);
    expect(planEnemyTurn(rules, s).at(-1)).toEqual({ type: 'attack', unitId: 'e', targetId: 'hurt' });
  });

  it('offense bias changes the choice: cautious picks the harmless target, aggressive the dangerous one', () => {
    const units = () => [
      unit({ id: 'lord', lord: true, pos: { x: 0, y: 0 } }),
      // Cannot counter, very hard to hurt.
      unit({ id: 'wall', pos: { x: 3, y: 1 }, weaponId: null, stats: stats({ def: 12, hp: 30 }) }),
      // Takes real damage but survives this turn and hits back hard.
      unit({ id: 'glass', pos: { x: 3, y: 3 }, weaponId: 'edge', stats: stats({ hp: 20, str: 12, def: 0, spd: 0 }) }),
      foe({ id: 'e', pos: { x: 5, y: 2 }, stats: stats({ hp: 20, str: 6, skl: 10, spd: 6 }) }),
    ];
    const cautious = enemyPhase(units(), { config: { ...DEFAULT_CONFIG, ai: { offenseBias: 0.25 } } });
    const aggressive = enemyPhase(units(), { config: { ...DEFAULT_CONFIG, ai: { offenseBias: 4 } } });
    expect(planEnemyTurn(rules, cautious).at(-1)).toEqual({ type: 'attack', unitId: 'e', targetId: 'wall' });
    expect(planEnemyTurn(rules, aggressive).at(-1)).toEqual({ type: 'attack', unitId: 'e', targetId: 'glass' });
  });

  it('breaks ties deterministically by unit order', () => {
    const s = enemyPhase([
      unit({ id: 'lord', lord: true, pos: { x: 0, y: 0 } }),
      unit({ id: 'twinA', pos: { x: 5, y: 1 } }),
      unit({ id: 'twinB', pos: { x: 5, y: 3 } }),
      foe({ id: 'e', ai: 'guard', pos: { x: 5, y: 2 } }),
    ]);
    expect(planEnemyTurn(rules, s)).toEqual([{ type: 'attack', unitId: 'e', targetId: 'twinA' }]);
    expect(planEnemyTurn(rules, s)).toEqual(planEnemyTurn(rules, structuredClone(s)));
  });

  it('runEnemyPhase acts with every enemy and hands the turn back to the player', () => {
    const s = enemyPhase([
      unit({ id: 'lord', lord: true, pos: { x: 0, y: 2 } }),
      foe({ id: 'e1', pos: { x: 9, y: 1 } }),
      foe({ id: 'e2', pos: { x: 9, y: 3 } }),
    ]);
    const after = runEnemyPhase(rules, s);
    expect([after.turn, after.phase]).toEqual([2, 'player']);
    expect(after.log.filter((a) => a.type === 'wait' || a.type === 'attack').map((a) => ('unitId' in a ? a.unitId : ''))).toEqual(['e1', 'e2']);
    expect(planEnemyTurn(rules, s)).toEqual(planEnemyTurn(rules, s));
  });

  it('has nothing to plan outside the enemy phase except ending it', () => {
    const s = enemyPhase([unit({ id: 'lord', lord: true }), foe({ id: 'e', pos: { x: 9, y: 4 } })]);
    const done = applyAction(rules, applyAction(rules, s, { type: 'wait', unitId: 'e' }), { type: 'endPhase' });
    expect(() => planEnemyTurn(rules, done)).toThrow(/enemy phase/);
    expect(planEnemyTurn(rules, applyAction(rules, s, { type: 'wait', unitId: 'e' }))).toEqual([{ type: 'endPhase' }]);
  });
});
