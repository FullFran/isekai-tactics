import { DEFAULT_CONFIG, type BattleConfig, type BattleSetup, type Objective } from './battle';
import { inBounds, parseGrid, pointKey, terrainAt, type Grid, type Point } from './grid';
import { STAT_KEYS, type AiBehaviour, type Rules, type Stats, type Unit } from './unit';

export type Route = 'easy' | 'hard';
export const ROUTES: readonly Route[] = ['easy', 'hard'];
const AI_BEHAVIOURS: readonly AiBehaviour[] = ['charge', 'inRange', 'guard'];

export interface RouteConfig {
  enemyLevelBonus: number;
  aiOffenseBias: number;
  deploySlots: number;
  unitGroups: string[];
}

export interface PartyMemberDef {
  id: string;
  name: string;
  class: string;
  level: number;
  weapon: string | null;
  lord?: boolean;
  /** Full personal stats; when absent, class bases plus fixed growth per level. */
  stats?: Stats;
  growths?: Stats;
}

export interface EnemyDef {
  id: string;
  name: string;
  class: string;
  level: number;
  weapon: string | null;
  at: [number, number];
  ai: AiBehaviour;
  boss?: boolean;
}

export interface ChapterDef {
  id: string;
  title: Record<string, string>;
  map: { legend: Record<string, string>; rows: string[] };
  objective: { type: 'rout' } | { type: 'seize'; tile: [number, number] };
  rules?: Partial<Pick<BattleConfig, 'lordLossFails' | 'wound'>>;
  routes: Record<Route, RouteConfig>;
  playerStarts: Array<[number, number]>;
  party: PartyMemberDef[];
  unitGroups: Record<string, EnemyDef[]>;
}

export type ValidationResult = { ok: true; chapter: ChapterDef } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(isInt);

/**
 * Hand-written validator: every problem is reported with a JSON path so a
 * non-programmer can find it. Returns the typed chapter only when it is clean.
 */
export function validateChapter(raw: unknown, rules: Rules): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, message: string) => errors.push(`${path}: ${message}`);
  if (!isObj(raw)) return { ok: false, errors: ['chapter: must be an object'] };

  if (typeof raw.id !== 'string' || raw.id === '') err('id', 'must be a non-empty string');
  if (!isObj(raw.title) || !Object.values(raw.title).every((t) => typeof t === 'string')) err('title', 'must map languages to strings');

  // Map
  let grid: Grid | null = null;
  const map = raw.map;
  if (!isObj(map) || !isObj(map.legend) || !Array.isArray(map.rows) || map.rows.length === 0) {
    err('map', 'must have a legend object and a non-empty rows array');
  } else {
    const before = errors.length;
    for (const [char, id] of Object.entries(map.legend)) {
      if (char.length !== 1) err(`map.legend["${char}"]`, 'keys must be single characters');
      if (typeof id !== 'string' || !rules.terrains[id]) err(`map.legend["${char}"]`, `unknown terrain "${String(id)}"`);
    }
    const width = typeof map.rows[0] === 'string' ? map.rows[0].length : 0;
    map.rows.forEach((row, y) => {
      if (typeof row !== 'string') return err(`map.rows[${y}]`, 'must be a string');
      if (row.length !== width) err(`map.rows[${y}]`, `has length ${row.length}, expected ${width}`);
      for (const char of new Set(row)) if (!(char in (map.legend as Obj))) err(`map.rows[${y}]`, `character "${char}" is not in the legend`);
    });
    if (errors.length === before) grid = parseGrid(map.rows as string[], map.legend as Record<string, string>);
  }

  const checkTile = (path: string, v: unknown): Point | null => {
    if (!isPair(v)) return err(path, 'must be [x, y] integers'), null;
    const p = { x: v[0], y: v[1] };
    if (!grid) return p;
    if (!inBounds(grid, p)) return err(path, `${p.x},${p.y} is outside the map`), null;
    const terrain = terrainAt(grid, rules.terrains, p);
    if (Object.values(terrain.moveCost).every((c) => c === null)) err(path, `${p.x},${p.y} is impassable terrain`);
    return p;
  };

  // Objective
  if (!isObj(raw.objective)) err('objective', 'must be an object');
  else if (raw.objective.type === 'seize') checkTile('objective.tile', raw.objective.tile);
  else if (raw.objective.type !== 'rout') err('objective.type', 'must be "rout" or "seize"');

  // Rules
  if (raw.rules !== undefined) {
    if (!isObj(raw.rules)) err('rules', 'must be an object');
    else {
      if (raw.rules.lordLossFails !== undefined && typeof raw.rules.lordLossFails !== 'boolean') err('rules.lordLossFails', 'must be a boolean');
      const w = raw.rules.wound;
      if (w !== undefined && (!isObj(w) || typeof w.enabled !== 'boolean' || typeof w.penaltyPct !== 'number')) err('rules.wound', 'must be { enabled: boolean, penaltyPct: number }');
    }
  }

  const ids = new Set<string>();
  const checkUnit = (path: string, u: unknown, kind: 'party' | 'enemy'): void => {
    if (!isObj(u)) return void err(path, 'must be an object');
    if (typeof u.id !== 'string' || u.id === '') err(`${path}.id`, 'must be a non-empty string');
    else if (ids.has(u.id)) err(`${path}.id`, `duplicate unit id "${u.id}"`);
    else ids.add(u.id);
    if (typeof u.name !== 'string') err(`${path}.name`, 'must be a string');
    if (!isInt(u.level) || u.level < 1 || u.level > 20) err(`${path}.level`, 'must be an integer 1..20');
    const klass = typeof u.class === 'string' ? rules.classes[u.class] : undefined;
    if (!klass) err(`${path}.class`, `unknown class "${String(u.class)}"`);
    if (u.weapon !== null) {
      const weapon = typeof u.weapon === 'string' ? rules.weapons[u.weapon] : undefined;
      if (!weapon) err(`${path}.weapon`, `unknown weapon "${String(u.weapon)}"`);
      else if (klass && !klass.weaponTypes.includes(weapon.type)) err(`${path}.weapon`, `${klass.id} cannot wield ${weapon.type} ("${weapon.id}")`);
    }
    for (const key of ['stats', 'growths'] as const) {
      const s = u[key];
      if (s !== undefined && (!isObj(s) || !STAT_KEYS.every((k) => isInt(s[k])))) err(`${path}.${key}`, `must give integers for ${STAT_KEYS.join(', ')}`);
    }
    if (kind === 'enemy') {
      if (!AI_BEHAVIOURS.includes(u.ai as AiBehaviour)) err(`${path}.ai`, `must be one of ${AI_BEHAVIOURS.join(', ')}`);
      if (u.boss !== undefined && typeof u.boss !== 'boolean') err(`${path}.boss`, 'must be a boolean');
    } else if (u.lord !== undefined && typeof u.lord !== 'boolean') err(`${path}.lord`, 'must be a boolean');
  };

  // Party
  if (!Array.isArray(raw.party) || raw.party.length === 0) err('party', 'must be a non-empty array');
  else {
    raw.party.forEach((u, i) => checkUnit(`party[${i}]`, u, 'party'));
    if (raw.party.filter((u) => isObj(u) && u.lord === true).length !== 1) err('party', 'must contain exactly one lord');
  }

  // Player starts
  const starts: Array<Point | null> = Array.isArray(raw.playerStarts) ? raw.playerStarts.map((p, i) => checkTile(`playerStarts[${i}]`, p)) : [];
  if (!Array.isArray(raw.playerStarts) || starts.length === 0) err('playerStarts', 'must be a non-empty array of [x, y]');

  // Unit groups
  const groupTiles = new Map<string, Array<{ path: string; p: Point }>>();
  if (!isObj(raw.unitGroups)) err('unitGroups', 'must be an object of arrays');
  else {
    for (const [name, list] of Object.entries(raw.unitGroups)) {
      if (!Array.isArray(list)) {
        err(`unitGroups.${name}`, 'must be an array');
        continue;
      }
      const tiles: Array<{ path: string; p: Point }> = [];
      list.forEach((u, i) => {
        const path = `unitGroups.${name}[${i}]`;
        checkUnit(path, u, 'enemy');
        const p = checkTile(`${path}.at`, isObj(u) ? u.at : undefined);
        if (p) tiles.push({ path: `${path}.at`, p });
      });
      groupTiles.set(name, tiles);
    }
  }

  // Routes
  if (!isObj(raw.routes)) err('routes', 'must be an object with easy and hard');
  else {
    for (const route of ROUTES) {
      const r = raw.routes[route];
      const path = `routes.${route}`;
      if (!isObj(r)) {
        err(path, 'is missing');
        continue;
      }
      if (!isInt(r.enemyLevelBonus)) err(`${path}.enemyLevelBonus`, 'must be an integer');
      if (typeof r.aiOffenseBias !== 'number' || r.aiOffenseBias < 0) err(`${path}.aiOffenseBias`, 'must be a number >= 0');
      const partySize = Array.isArray(raw.party) ? raw.party.length : 0;
      if (!isInt(r.deploySlots) || r.deploySlots < 1 || r.deploySlots > starts.length || r.deploySlots > partySize) {
        err(`${path}.deploySlots`, `must be 1..min(party size ${partySize}, player starts ${starts.length})`);
      }
      if (!Array.isArray(r.unitGroups)) {
        err(`${path}.unitGroups`, 'must be an array of group names');
        continue;
      }
      // Every tile used on this route must be distinct.
      const used = new Map<string, string>();
      const claim = (p: Point | null, where: string) => {
        if (!p) return;
        const other = used.get(pointKey(p));
        if (other) err(where, `shares a tile with ${other}`);
        else used.set(pointKey(p), where);
      };
      starts.slice(0, isInt(r.deploySlots) ? r.deploySlots : 0).forEach((p, i) => claim(p, `playerStarts[${i}]`));
      for (const group of r.unitGroups) {
        const tiles = typeof group === 'string' ? groupTiles.get(group) : undefined;
        if (!tiles) err(`${path}.unitGroups`, `unknown group "${String(group)}"`);
        else for (const t of tiles) claim(t.p, t.path);
      }
    }
  }

  return errors.length === 0 ? { ok: true, chapter: raw as unknown as ChapterDef } : { ok: false, errors: [...new Set(errors)] };
}

/** Class bases plus floor((level - 1) * growth%) per stat: deterministic autolevel, no RNG. */
export function autoStats(rules: Rules, classId: string, level: number): Stats {
  const klass = rules.classes[classId];
  if (!klass) throw new Error(`unknown class ${classId}`);
  const out = {} as Stats;
  for (const key of STAT_KEYS) out[key] = klass.bases[key] + Math.floor(((level - 1) * klass.growths[key]) / 100);
  return out;
}

function makeUnit(rules: Rules, base: { id: string; name: string; class: string; level: number; weapon: string | null }, extra: Partial<Unit> & Pick<Unit, 'faction' | 'pos'>, stats?: Stats, growths?: Stats): Unit {
  const klass = rules.classes[base.class]!;
  const s = stats ? { ...stats } : autoStats(rules, base.class, base.level);
  return {
    id: base.id, name: base.name, classId: base.class, movementType: klass.movementType, level: base.level, exp: 0,
    hp: s.hp, stats: s, growths: { ...(growths ?? klass.growths) }, weaponId: base.weapon, lord: false, boss: false,
    status: 'active', moved: false, acted: false, ai: null, progressAtStart: null, wound: null, ...extra,
  };
}

/** Turns a validated chapter into a battle for the chosen route. */
export function buildBattleSetup(chapter: ChapterDef, route: Route, rules: Rules, seed: number): BattleSetup {
  const r = chapter.routes[route];
  const toPoint = ([x, y]: [number, number]): Point => ({ x, y });
  // Lord always deploys, then party order.
  const party = [...chapter.party].sort((a, b) => Number(b.lord === true) - Number(a.lord === true)).slice(0, r.deploySlots);
  const players = party.map((m, i) =>
    makeUnit(rules, m, { faction: 'player', pos: toPoint(chapter.playerStarts[i]!), lord: m.lord === true }, m.stats, m.growths),
  );
  const enemies = r.unitGroups.flatMap((group) => chapter.unitGroups[group] ?? []).map((e) => {
    const level = Math.min(20, e.level + r.enemyLevelBonus);
    return makeUnit(rules, { ...e, level }, { faction: 'enemy', pos: toPoint(e.at), ai: e.ai, boss: e.boss === true });
  });
  const objective: Objective = chapter.objective.type === 'seize' ? { type: 'seize', tile: toPoint(chapter.objective.tile) } : { type: 'rout' };
  const config: BattleConfig = {
    lordLossFails: chapter.rules?.lordLossFails ?? DEFAULT_CONFIG.lordLossFails,
    wound: { ...(chapter.rules?.wound ?? DEFAULT_CONFIG.wound) },
    ai: { offenseBias: r.aiOffenseBias },
  };
  return { grid: parseGrid(chapter.map.rows, chapter.map.legend), units: [...players, ...enemies], objective, seed, config };
}
