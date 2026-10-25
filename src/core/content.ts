import { validateChapter } from './chapter';
import { MOVEMENT_TYPES } from './grid';
import { STAT_KEYS, WEAPON_TYPES, type Rules } from './unit';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Checks the rule tables (terrain, classes, weapons) so a hand edit cannot break the engine silently. */
export function validateRules(rules: Rules): string[] {
  const errors: string[] = [];
  const err = (path: string, message: string) => errors.push(`${path}: ${message}`);
  const table = (name: keyof Rules, check: (path: string, entry: Obj) => void) => {
    for (const [id, entry] of Object.entries(rules[name] as Record<string, unknown>)) {
      const path = `rules.${name}.${id}`;
      if (!isObj(entry)) {
        err(path, 'must be an object');
        continue;
      }
      if (entry.id !== id) err(`${path}.id`, `must equal its key "${id}", found "${String(entry.id)}"`);
      check(path, entry);
    }
  };

  table('terrains', (path, t) => {
    for (const key of ['avoid', 'def', 'healPct'] as const) if (!isInt(t[key])) err(`${path}.${key}`, 'must be an integer');
    const cost = isObj(t.moveCost) ? t.moveCost : {};
    for (const m of MOVEMENT_TYPES) {
      const c = cost[m];
      if (c !== null && !(isInt(c) && c >= 1)) err(`${path}.moveCost.${m}`, 'must be an integer >= 1 or null (impassable)');
    }
  });

  table('classes', (path, k) => {
    if (!MOVEMENT_TYPES.includes(k.movementType as never)) err(`${path}.movementType`, `must be one of ${MOVEMENT_TYPES.join(', ')}`);
    if (!isInt(k.critBonus)) err(`${path}.critBonus`, 'must be an integer');
    for (const key of ['bases', 'growths'] as const) {
      const s = isObj(k[key]) ? k[key] : {};
      for (const stat of STAT_KEYS) if (!isInt(s[stat])) err(`${path}.${key}.${stat}`, 'must be an integer');
    }
    if (!Array.isArray(k.weaponTypes) || k.weaponTypes.length === 0) err(`${path}.weaponTypes`, 'must be a non-empty array');
    else for (const w of k.weaponTypes) if (!WEAPON_TYPES.includes(w)) err(`${path}.weaponTypes`, `unknown weapon type "${String(w)}" (use ${WEAPON_TYPES.join(', ')})`);
  });

  table('weapons', (path, w) => {
    if (!WEAPON_TYPES.includes(w.type as never)) err(`${path}.type`, `must be one of ${WEAPON_TYPES.join(', ')}`);
    for (const key of ['might', 'hit', 'crit', 'weight'] as const) if (!isNum(w[key])) err(`${path}.${key}`, 'must be a number');
    if (!isInt(w.minRange) || !isInt(w.maxRange) || w.minRange < 1 || w.maxRange < w.minRange) err(path, 'range must satisfy 1 <= minRange <= maxRange');
    if (!Array.isArray(w.effectiveAgainst)) err(`${path}.effectiveAgainst`, 'must be an array');
    else for (const m of w.effectiveAgainst) if (!MOVEMENT_TYPES.includes(m)) err(`${path}.effectiveAgainst`, `unknown movement type "${String(m)}"`);
  });

  return errors;
}

export interface ContentInput {
  rules: Rules;
  /** Raw chapter JSON with the file it came from, used to locate errors. */
  chapters: ReadonlyArray<{ path: string; raw: unknown }>;
  /** Chapter ids the game actually loads. */
  registeredIds: readonly string[];
  /** UI catalogs by language; every class, weapon and terrain needs a name in each. */
  messages: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** Validates all content together; every error starts with the file (or table) it belongs to. */
export function validateContent(input: ContentInput): string[] {
  const errors = validateRules(input.rules);
  const languages = Object.keys(input.messages);

  for (const [lang, messages] of Object.entries(input.messages)) {
    for (const [prefix, table] of [['terrain', input.rules.terrains], ['class', input.rules.classes], ['weapon', input.rules.weapons]] as const) {
      for (const id of Object.keys(table)) if (!(`${prefix}.${id}` in messages)) errors.push(`i18n.${lang}: missing "${prefix}.${id}"`);
    }
  }

  const seen = new Map<string, string>();
  for (const { path, raw } of input.chapters) {
    const result = validateChapter(raw, input.rules);
    if (!result.ok) {
      errors.push(...result.errors.map((e) => `${path}: ${e}`));
      continue;
    }
    const { id, title } = result.chapter;
    const other = seen.get(id);
    if (other) errors.push(`${path}: id: duplicate chapter id "${id}" (also in ${other})`);
    else seen.set(id, path);
    if (!input.registeredIds.includes(id)) errors.push(`${path}: id: "${id}" is not registered in src/data/chapters/index.ts`);
    for (const lang of languages) if (!(lang in title)) errors.push(`${path}: title: missing language "${lang}"`);
  }
  return errors;
}
