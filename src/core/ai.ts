import { applyAction, activeUnits, readyUnits, worldOf, type Action, type BattleState } from './battle';
import { COMBAT, forecastCombat, inWeaponRange, weaponOf, type CombatSide } from './combat';
import { neighbours, pointKey, samePoint, terrainAt, type Point } from './grid';
import { moveRange } from './movement';
import type { Rules, Unit } from './unit';

/** Score bonus for a likely kill, on top of lethality (0..1). */
export const KILL_BONUS = 1;
const EPSILON = 1e-9;

/** Expected HP removed by one side over the whole exchange, crits included. */
function expectedDamage(side: CombatSide): number {
  const p = side.trueHit / 100;
  const critFactor = 1 + (COMBAT.critMultiplier - 1) * (side.crit / 100);
  return side.damage * p * critFactor * side.strikes;
}

/** Chance to kill in this exchange, ignoring crits (cheap, monotonic, deterministic). */
function killChance(side: CombatSide, targetHp: number): number {
  const p = side.trueHit / 100;
  if (side.damage <= 0 || side.strikes === 0) return 0;
  if (side.damage >= targetHp) return 1 - (1 - p) ** side.strikes;
  if (side.strikes === 2 && side.damage * 2 >= targetHp) return p * p;
  return 0;
}

/**
 * Offense = lethality + kill bonus; defense = 1 - share of own HP expected to be lost to the counter.
 * Blended with weight bias / (bias + 1), so a higher bias means a more reckless AI.
 */
export function scoreAttack(rules: Rules, state: BattleState, attacker: Unit, tile: Point, target: Unit): number {
  const f = forecastCombat(rules, state.grid, attacker, tile, target);
  const kill = killChance(f.attacker, target.hp);
  const offense = Math.min(1, expectedDamage(f.attacker) / target.hp) + KILL_BONUS * kill;
  const taken = expectedDamage(f.defender) * (1 - kill);
  const defense = 1 - Math.min(1, taken / attacker.hp);
  const w = state.config.ai.offenseBias / (state.config.ai.offenseBias + 1);
  return offense * w + defense * (1 - w);
}

/** Path cost from every tile to the nearest player unit, for the given unit's movement type. */
function distanceToPlayers(rules: Rules, state: BattleState, mover: Unit): Map<string, number> {
  const dist = new Map<string, number>();
  const frontier: Array<{ p: Point; c: number }> = [];
  for (const u of activeUnits(state)) {
    if (u.faction === mover.faction) continue;
    dist.set(pointKey(u.pos), 0);
    frontier.push({ p: u.pos, c: 0 });
  }
  while (frontier.length > 0) {
    frontier.sort((a, b) => a.c - b.c || a.p.y - b.p.y || a.p.x - b.p.x);
    const { p, c } = frontier.shift()!;
    if (c > (dist.get(pointKey(p)) ?? Infinity)) continue;
    for (const n of neighbours(state.grid, p)) {
      // Cost of stepping from n into p, so the field measures the mover's walk towards the target.
      const step = terrainAt(state.grid, rules.terrains, p).moveCost[mover.movementType];
      const enter = terrainAt(state.grid, rules.terrains, n).moveCost[mover.movementType];
      if (step === null || enter === null) continue;
      const next = c + step;
      if (next >= (dist.get(pointKey(n)) ?? Infinity)) continue;
      dist.set(pointKey(n), next);
      frontier.push({ p: n, c: next });
    }
  }
  return dist;
}

/** Plans the next enemy's whole turn (move + attack/wait), or `endPhase` when every enemy has acted. */
export function planEnemyTurn(rules: Rules, state: BattleState): Action[] {
  if (state.phase !== 'enemy' || state.outcome !== 'ongoing') throw new Error('planEnemyTurn only runs during an ongoing enemy phase');
  const unit = readyUnits(state)[0];
  if (!unit) return [{ type: 'endPhase' }];
  const behaviour = unit.ai ?? 'charge';
  const range = moveRange(worldOf(rules, state), unit, unit.moved || behaviour === 'guard' ? 0 : unit.stats.mov);
  // Prefer moving less: candidate tiles by movement spent, then row, then column.
  const tiles = [...range.destinations].sort(
    (a, b) => (range.cost.get(pointKey(a)) ?? 0) - (range.cost.get(pointKey(b)) ?? 0) || a.y - b.y || a.x - b.x,
  );
  const weapon = weaponOf(rules, unit);
  const targets = activeUnits(state).filter((u) => u.faction !== unit.faction);
  let best: { tile: Point; target: Unit; score: number } | null = null;
  for (const target of targets) {
    for (const tile of tiles) {
      if (!inWeaponRange(weapon, tile, target.pos)) continue;
      const score = scoreAttack(rules, state, unit, tile, target);
      if (!best || score > best.score + EPSILON) best = { tile, target, score };
    }
  }
  const moveTo = (to: Point): Action[] => (samePoint(to, unit.pos) ? [] : [{ type: 'move', unitId: unit.id, to }]);
  if (best) return [...moveTo(best.tile), { type: 'attack', unitId: unit.id, targetId: best.target.id }];
  if (behaviour !== 'charge') return [{ type: 'wait', unitId: unit.id }];

  const dist = distanceToPlayers(rules, state, unit);
  let goal = unit.pos;
  let goalDist = dist.get(pointKey(unit.pos)) ?? Infinity;
  for (const tile of tiles) {
    const d = dist.get(pointKey(tile)) ?? Infinity;
    if (d < goalDist - EPSILON) [goal, goalDist] = [tile, d];
  }
  return [...moveTo(goal), { type: 'wait', unitId: unit.id }];
}

/** Plays the whole enemy phase and returns the state at the start of the next player phase (or the end). */
export function runEnemyPhase(rules: Rules, initial: BattleState): BattleState {
  let state = initial;
  while (state.phase === 'enemy' && state.outcome === 'ongoing') {
    for (const action of planEnemyTurn(rules, state)) {
      state = applyAction(rules, state, action);
      if (state.outcome !== 'ongoing') break;
    }
  }
  return state;
}
