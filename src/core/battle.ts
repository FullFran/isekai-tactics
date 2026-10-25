import { forecastCombat, inWeaponRange, resolveCombat, weaponOf, type CombatResult } from './combat';
import { samePoint, terrainAt, type Grid, type Point } from './grid';
import { moveRange, type Faction, type World } from './movement';
import { clone } from './clone';
import { createRng, type Rng } from './rng';
import type { Rules, Unit } from './unit';

export type Objective = { type: 'rout' } | { type: 'seize'; tile: Point };

export interface BattleConfig {
  /** The lord retreating fails the chapter. */
  lordLossFails: boolean;
  /** Carry-over wound applied to retreated units (off by default). */
  wound: { enabled: boolean; penaltyPct: number };
}

export const DEFAULT_CONFIG: BattleConfig = { lordLossFails: true, wound: { enabled: false, penaltyPct: 10 } };

export type Action =
  | { type: 'move'; unitId: string; to: Point }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'wait'; unitId: string }
  | { type: 'seize'; unitId: string }
  | { type: 'endPhase' };

export type BattleEvent =
  | { type: 'combat'; attackerId: string; defenderId: string; result: CombatResult }
  | { type: 'retreat'; unitId: string }
  | { type: 'defeated'; unitId: string }
  | { type: 'phase'; phase: Faction; turn: number }
  | { type: 'outcome'; outcome: Outcome };

export type Outcome = 'ongoing' | 'victory' | 'defeat';

/** Whole battle as plain data: clone it, serialise it, replay it from `log`. */
export interface BattleState {
  grid: Grid;
  units: Unit[];
  objective: Objective;
  config: BattleConfig;
  turn: number;
  phase: Faction;
  rng: Rng;
  log: Action[];
  events: BattleEvent[];
  outcome: Outcome;
}

export interface BattleSetup {
  grid: Grid;
  units: Unit[];
  objective: Objective;
  seed: number;
  config?: BattleConfig;
}

export function createBattle(setup: BattleSetup): BattleState {
  const units = clone(setup.units).map((u) =>
    u.faction === 'player' ? { ...u, progressAtStart: { level: u.level, exp: u.exp, stats: { ...u.stats } } } : u,
  );
  return {
    grid: clone(setup.grid),
    units,
    objective: setup.objective,
    config: clone(setup.config ?? DEFAULT_CONFIG),
    turn: 1,
    phase: 'player',
    rng: createRng(setup.seed),
    log: [],
    events: [{ type: 'phase', phase: 'player', turn: 1 }],
    outcome: 'ongoing',
  };
}

export const activeUnits = (state: BattleState): Unit[] => state.units.filter((u) => u.status === 'active');

export const worldOf = (rules: Rules, state: BattleState): World => ({ grid: state.grid, terrains: rules.terrains, units: activeUnits(state) });

export function unitById(state: BattleState, id: string): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`unknown unit ${id}`);
  return unit;
}

/** Units of the faction whose phase it is and that can still act. */
export const readyUnits = (state: BattleState): Unit[] => activeUnits(state).filter((u) => u.faction === state.phase && !u.acted);

function actor(state: BattleState, id: string): Unit {
  const unit = unitById(state, id);
  if (unit.status !== 'active') throw new Error(`${id} is not on the map`);
  if (unit.faction !== state.phase) throw new Error(`${id} cannot act during the ${state.phase} phase`);
  if (unit.acted) throw new Error(`${id} has already acted`);
  return unit;
}

/** Returns a new state; the input is never mutated. Throws on illegal actions. */
export function applyAction(rules: Rules, previous: BattleState, action: Action): BattleState {
  if (previous.outcome !== 'ongoing') throw new Error('the battle is over');
  const state = clone(previous);
  switch (action.type) {
    case 'move': {
      const unit = actor(state, action.unitId);
      if (unit.moved) throw new Error(`${unit.id} has already moved`);
      const reachable = moveRange(worldOf(rules, state), unit).destinations.some((p) => samePoint(p, action.to));
      if (!reachable) throw new Error(`${unit.id} cannot reach ${action.to.x},${action.to.y}`);
      unit.pos = { ...action.to };
      unit.moved = true;
      break;
    }
    case 'attack': {
      const unit = actor(state, action.unitId);
      const target = unitById(state, action.targetId);
      if (target.status !== 'active' || target.faction === unit.faction) throw new Error(`${target.id} is not a valid target`);
      if (!inWeaponRange(weaponOf(rules, unit), unit.pos, target.pos)) throw new Error(`${target.id} is out of range`);
      const result = resolveCombat(forecastCombat(rules, state.grid, unit, unit.pos, target), state.rng);
      unit.hp = result.attackerHp;
      target.hp = result.defenderHp;
      state.events.push({ type: 'combat', attackerId: unit.id, defenderId: target.id, result });
      for (const u of [unit, target]) if (u.hp <= 0) onUnitDefeated(state, u);
      unit.moved = true;
      unit.acted = true;
      break;
    }
    case 'wait': {
      const unit = actor(state, action.unitId);
      unit.moved = true;
      unit.acted = true;
      break;
    }
    case 'seize': {
      const unit = actor(state, action.unitId);
      if (state.objective.type !== 'seize') throw new Error('this chapter has no seize objective');
      if (!unit.lord) throw new Error('only a lord can seize');
      if (!samePoint(unit.pos, state.objective.tile)) throw new Error('the lord is not on the seize tile');
      unit.acted = true;
      finish(state, 'victory');
      break;
    }
    case 'endPhase': {
      if (state.phase === 'enemy') state.turn += 1;
      state.phase = state.phase === 'player' ? 'enemy' : 'player';
      for (const u of activeUnits(state)) {
        if (u.faction !== state.phase) continue;
        u.moved = false;
        u.acted = false;
        const heal = terrainAt(state.grid, rules.terrains, u.pos).healPct;
        if (heal > 0) u.hp = Math.min(u.stats.hp, u.hp + Math.floor((u.stats.hp * heal) / 100));
      }
      state.events.push({ type: 'phase', phase: state.phase, turn: state.turn });
      break;
    }
  }
  state.log.push(clone(action));
  checkOutcome(state);
  return state;
}

/** Retreat instead of death for the player side; enemies are simply defeated. */
function onUnitDefeated(state: BattleState, unit: Unit): void {
  unit.hp = 0;
  if (unit.faction === 'enemy') {
    unit.status = 'defeated';
    state.events.push({ type: 'defeated', unitId: unit.id });
    return;
  }
  unit.status = 'retreated';
  if (unit.progressAtStart) {
    unit.level = unit.progressAtStart.level;
    unit.exp = unit.progressAtStart.exp;
    unit.stats = { ...unit.progressAtStart.stats };
  }
  if (state.config.wound.enabled) unit.wound = { penaltyPct: state.config.wound.penaltyPct };
  state.events.push({ type: 'retreat', unitId: unit.id });
}

function finish(state: BattleState, outcome: Outcome): void {
  if (state.outcome !== 'ongoing') return;
  state.outcome = outcome;
  state.events.push({ type: 'outcome', outcome });
}

function checkOutcome(state: BattleState): void {
  const players = state.units.filter((u) => u.faction === 'player');
  const lordLost = players.some((u) => u.lord && u.status !== 'active');
  if ((state.config.lordLossFails && lordLost) || players.every((u) => u.status !== 'active')) return finish(state, 'defeat');
  if (state.objective.type === 'rout' && !state.units.some((u) => u.faction === 'enemy' && u.status === 'active')) finish(state, 'victory');
}

export function replay(rules: Rules, initial: BattleState, actions: readonly Action[]): BattleState {
  return actions.reduce((s, a) => applyAction(rules, s, a), initial);
}
