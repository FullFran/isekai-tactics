import { nextRn, type Rng } from './rng';
import { STAT_KEYS, type Stats, type Unit } from './unit';

export const MAX_LEVEL = 20;
export const EXP_PER_LEVEL = 100;
const BOSS_KILL_BONUS = 40;
/** Extra attempts after a blank level-up (two re-rolls, then accept). */
const BLANK_REROLLS = 2;

export interface CombatOutcomeForExp {
  dealtDamage: boolean;
  killed: boolean;
}

/** Our own GBA-flavoured EXP curve: level gap matters, kills pay most. Always 1..100. */
export function combatExp(own: Unit, foe: Unit, outcome: CombatOutcomeForExp): number {
  if (!outcome.dealtDamage) return 1;
  const gap = foe.level - own.level;
  let exp = Math.max(1, Math.floor((31 + gap) / 3));
  if (outcome.killed) exp += Math.max(0, 20 + gap * 3) + (foe.boss ? BOSS_KILL_BONUS : 0);
  return Math.max(1, Math.min(100, exp));
}

/** One level: one RN per stat against its growth; a blank result is re-rolled up to twice. */
export function levelUp(unit: Unit, rng: Rng): Stats {
  let gains = rollGains(unit, rng);
  for (let i = 0; i < BLANK_REROLLS && STAT_KEYS.every((k) => gains[k] === 0); i++) gains = rollGains(unit, rng);
  for (const key of STAT_KEYS) unit.stats[key] += gains[key];
  unit.hp += gains.hp;
  unit.level += 1;
  return gains;
}

function rollGains(unit: Unit, rng: Rng): Stats {
  const gains = {} as Stats;
  for (const key of STAT_KEYS) {
    const growth = unit.growths[key];
    const rn = nextRn(rng, `levelup:${key}`);
    gains[key] = Math.floor(growth / 100) + (rn < growth % 100 ? 1 : 0);
  }
  return gains;
}

/** Adds EXP, levelling up every 100. Returns the stat gains of each level gained. */
export function gainExp(unit: Unit, amount: number, rng: Rng): Stats[] {
  if (unit.level >= MAX_LEVEL) {
    unit.exp = 0;
    return [];
  }
  unit.exp += amount;
  const ups: Stats[] = [];
  while (unit.exp >= EXP_PER_LEVEL && unit.level < MAX_LEVEL) {
    unit.exp -= EXP_PER_LEVEL;
    ups.push(levelUp(unit, rng));
  }
  if (unit.level >= MAX_LEVEL) unit.exp = 0;
  return ups;
}
