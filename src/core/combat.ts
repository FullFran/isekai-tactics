import { manhattan, terrainAt, type Grid, type Point } from './grid';
import { nextRn, type Rng } from './rng';
import type { Rules, Unit, WeaponDef, WeaponType } from './unit';

/** Formula constants (GBA-style calibration, our own table). */
export const COMBAT = {
  doubleThreshold: 4,
  critMultiplier: 3,
  effectiveMultiplier: 3,
  triangleHit: 15,
  triangleMight: 1,
} as const;

const BEATS: Partial<Record<WeaponType, WeaponType>> = { sword: 'axe', axe: 'lance', lance: 'sword' };

/** +1 when `own` beats `other` in the weapon triangle, -1 when it loses, 0 otherwise. */
export function triangle(own: WeaponType, other: WeaponType | undefined): -1 | 0 | 1 {
  if (other === undefined) return 0;
  if (BEATS[own] === other) return 1;
  if (BEATS[other] === own) return -1;
  return 0;
}

/**
 * Probability (percent) that two RNs in 0..99 average below the displayed hit:
 * the "true hit" of the 2RN system. Exact count over the 10,000 pairs.
 */
export function trueHit(displayed: number): number {
  const limit = 2 * Math.max(0, Math.min(100, displayed));
  let pairs = 0;
  for (let sum = 0; sum < limit && sum <= 198; sum++) pairs += sum <= 99 ? sum + 1 : 199 - sum;
  return pairs / 100;
}

export interface CombatSide {
  unitId: string;
  hp: number;
  attackSpeed: number;
  damage: number;
  /** Displayed hit (0..100) used by the 2RN roll. */
  hit: number;
  /** Real probability of hitting under 2RN, in percent. */
  trueHit: number;
  crit: number;
  /** 0, 1 or 2 strikes this exchange. */
  strikes: number;
  canCounter: boolean;
}

export interface CombatForecast {
  attacker: CombatSide;
  defender: CombatSide;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function weaponOf(rules: Rules, u: Unit): WeaponDef | undefined {
  return u.weaponId === null ? undefined : rules.weapons[u.weaponId];
}

export function attackSpeed(rules: Rules, u: Unit): number {
  const w = weaponOf(rules, u);
  return u.stats.spd - Math.max(0, (w?.weight ?? 0) - u.stats.con);
}

export function inWeaponRange(w: WeaponDef | undefined, from: Point, to: Point): boolean {
  if (!w) return false;
  const d = manhattan(from, to);
  return d >= w.minRange && d <= w.maxRange;
}

interface Side {
  unit: Unit;
  pos: Point;
}

function sideNumbers(rules: Rules, grid: Grid, own: Side, foe: Side) {
  const w = weaponOf(rules, own.unit);
  const foeWeapon = weaponOf(rules, foe.unit);
  if (!w) return { damage: 0, hit: 0, crit: 0 };
  const tri = triangle(w.type, foeWeapon?.type);
  const magic = w.type === 'anima';
  const effective = w.effectiveAgainst.includes(foe.unit.movementType) ? COMBAT.effectiveMultiplier : 1;
  const foeTerrain = terrainAt(grid, rules.terrains, foe.pos);
  const attack = (magic ? own.unit.stats.mag : own.unit.stats.str) + w.might * effective + tri * COMBAT.triangleMight;
  const defence = (magic ? foe.unit.stats.res : foe.unit.stats.def) + foeTerrain.def;
  const hitRate = w.hit + own.unit.stats.skl * 2 + Math.floor(own.unit.stats.lck / 2) + tri * COMBAT.triangleHit;
  const avoid = attackSpeed(rules, foe.unit) * 2 + foe.unit.stats.lck + foeTerrain.avoid;
  const critRate = w.crit + Math.floor(own.unit.stats.skl / 2) + (rules.classes[own.unit.classId]?.critBonus ?? 0);
  return {
    damage: Math.max(0, attack - defence),
    hit: clamp(hitRate - avoid, 0, 100),
    crit: clamp(critRate - foe.unit.stats.lck, 0, 100),
  };
}

/** What the player sees before confirming an attack from `attackerPos`. */
export function forecastCombat(rules: Rules, grid: Grid, attacker: Unit, attackerPos: Point, defender: Unit): CombatForecast {
  const a: Side = { unit: attacker, pos: attackerPos };
  const d: Side = { unit: defender, pos: defender.pos };
  const asA = attackSpeed(rules, attacker);
  const asD = attackSpeed(rules, defender);
  const canCounter = inWeaponRange(weaponOf(rules, defender), attackerPos, defender.pos);
  const na = sideNumbers(rules, grid, a, d);
  const nd = canCounter ? sideNumbers(rules, grid, d, a) : { damage: 0, hit: 0, crit: 0 };
  return {
    attacker: {
      unitId: attacker.id, hp: attacker.hp, attackSpeed: asA, ...na, trueHit: trueHit(na.hit),
      strikes: weaponOf(rules, attacker) ? (asA - asD >= COMBAT.doubleThreshold ? 2 : 1) : 0, canCounter: true,
    },
    defender: {
      unitId: defender.id, hp: defender.hp, attackSpeed: asD, ...nd, trueHit: trueHit(nd.hit),
      strikes: canCounter ? (asD - asA >= COMBAT.doubleThreshold ? 2 : 1) : 0, canCounter,
    },
  };
}

export interface Strike {
  attackerId: string;
  targetId: string;
  hit: boolean;
  crit: boolean;
  /** HP actually removed (capped at the target's remaining HP). */
  damage: number;
  /** Slice of `rng.log` consumed by this strike. */
  rnFrom: number;
  rnTo: number;
}

export interface CombatResult {
  strikes: Strike[];
  attackerHp: number;
  defenderHp: number;
}

/** Plays the exchange: attacker, counter, then the follow-up of whoever doubles. */
export function resolveCombat(forecast: CombatForecast, rng: Rng): CombatResult {
  const hp = { attacker: forecast.attacker.hp, defender: forecast.defender.hp };
  const order: Array<'attacker' | 'defender'> = ['attacker', 'defender'];
  if (forecast.attacker.strikes === 2) order.push('attacker');
  if (forecast.defender.strikes === 2) order.push('defender');
  const strikes: Strike[] = [];
  const used = { attacker: 0, defender: 0 };
  for (const who of order) {
    const side = forecast[who];
    const foe = who === 'attacker' ? 'defender' : 'attacker';
    if (used[who] >= side.strikes || hp.attacker <= 0 || hp.defender <= 0) continue;
    used[who] += 1;
    const rnFrom = rng.log.length;
    const hit = nextRn(rng, 'hit') + nextRn(rng, 'hit') < 2 * side.hit;
    const crit = hit && nextRn(rng, 'crit') < side.crit;
    const raw = hit ? side.damage * (crit ? COMBAT.critMultiplier : 1) : 0;
    const damage = Math.min(raw, hp[foe]);
    hp[foe] -= damage;
    strikes.push({ attackerId: side.unitId, targetId: forecast[foe].unitId, hit, crit, damage, rnFrom, rnTo: rng.log.length });
  }
  return { strikes, attackerHp: hp.attacker, defenderHp: hp.defender };
}
