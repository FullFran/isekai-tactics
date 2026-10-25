import type { MovementType, Point, Terrain } from './grid';
import type { Faction } from './movement';

export const STAT_KEYS = ['hp', 'str', 'mag', 'skl', 'spd', 'lck', 'def', 'res', 'con', 'mov'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const WEAPON_TYPES = ['sword', 'lance', 'axe', 'bow', 'anima'] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export interface WeaponDef {
  id: string;
  type: WeaponType;
  might: number;
  hit: number;
  crit: number;
  weight: number;
  minRange: number;
  maxRange: number;
  /** Movement types this weapon is effective against (might x3). */
  effectiveAgainst: MovementType[];
}

export interface ClassDef {
  id: string;
  movementType: MovementType;
  bases: Stats;
  /** Growth rates in percent; `mov` and `con` are normally 0. */
  growths: Stats;
  /** Class crit bonus (e.g. +15 for a crit-focused class). */
  critBonus: number;
  weaponTypes: WeaponType[];
}

/** The shared rule tables every core function reads. */
export interface Rules {
  terrains: Readonly<Record<string, Terrain>>;
  classes: Readonly<Record<string, ClassDef>>;
  weapons: Readonly<Record<string, WeaponDef>>;
}

export type UnitStatus = 'active' | 'retreated' | 'defeated';

export type AiBehaviour = 'charge' | 'inRange' | 'guard';

/** Progress snapshot taken at chapter start; restored when a unit retreats (map EXP forfeited). */
export interface Progress {
  level: number;
  exp: number;
  stats: Stats;
}

export interface Unit {
  id: string;
  name: string;
  faction: Faction;
  classId: string;
  movementType: MovementType;
  pos: Point;
  level: number;
  exp: number;
  /** Current HP; max HP is `stats.hp`. */
  hp: number;
  stats: Stats;
  growths: Stats;
  weaponId: string | null;
  lord: boolean;
  boss: boolean;
  status: UnitStatus;
  moved: boolean;
  acted: boolean;
  ai: AiBehaviour | null;
  progressAtStart: Progress | null;
  wound: { penaltyPct: number } | null;
}
