import type { Faction } from './movement';

/**
 * Sprite pack manifest (`assets-local/pack.json`): maps classes, unit ids and
 * terrain to cells of sprite sheets. Anything not mapped keeps the placeholder art.
 */
export interface SpriteAnim {
  row: number;
  /** First column of the animation (default 0); frames run left to right. */
  col?: number;
  frames: number;
  frameMs: number;
  /** Play 0,1,2,1,0… instead of 0,1,2,0,1… */
  pingPong?: boolean;
}

export interface FactionLook {
  sheet?: string;
  /** `#rgb` or `#rrggbb` colour laid over the sprite. */
  tint?: string;
}

export interface UnitSpriteDef {
  sheet: string;
  frameWidth: number;
  frameHeight: number;
  idle: SpriteAnim;
  /** Played while the unit is selected or being moved; defaults to `idle`. */
  moving?: SpriteAnim;
  factions?: Partial<Record<Faction, FactionLook>>;
}

export interface TileSpriteDef {
  sheet: string;
  /** Cell position in units of `tileSize`. */
  col: number;
  row: number;
}

export interface SpritePack {
  version: 1;
  name?: string;
  /** Source pixel size of one map tile (and of a terrain cell). */
  tileSize: number;
  classes: Record<string, UnitSpriteDef>;
  units: Record<string, UnitSpriteDef>;
  terrain: Record<string, TileSpriteDef>;
}

export interface SpriteFrame {
  sheet: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  tint: string | null;
}

export const DEFAULT_ENEMY_TINT = '#e04848';
const FACTIONS: readonly Faction[] = ['player', 'enemy'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number): v is number => Number.isInteger(v) && (v as number) >= min;
const isColour = (v: unknown) => typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
const isRelativePath = (v: unknown) =>
  typeof v === 'string' && v !== '' && !v.startsWith('/') && !v.includes('\\') && !v.includes(':') && !v.split('/').includes('..');

export type SpritePackResult = { ok: true; pack: SpritePack } | { ok: false; errors: string[] };

export function validateSpritePack(raw: unknown): SpritePackResult {
  const errors: string[] = [];
  const err = (path: string, message: string) => errors.push(`${path}: ${message}`);
  if (!isObj(raw)) return { ok: false, errors: ['pack: must be an object'] };
  if (raw.version !== 1) err('version', 'must be 1');
  if (raw.name !== undefined && typeof raw.name !== 'string') err('name', 'must be a string');
  if (raw.tileSize !== undefined && !isInt(raw.tileSize, 1)) err('tileSize', 'must be an integer >= 1');

  const sheet = (path: string, v: unknown) => {
    if (!isRelativePath(v)) err(path, 'must be a relative path inside the pack folder (no "..", "/" prefix or URL)');
  };
  const anim = (path: string, v: unknown) => {
    if (!isObj(v)) return err(path, 'must be { row, frames, frameMs }');
    if (!isInt(v.row, 0)) err(`${path}.row`, 'must be an integer >= 0');
    if (v.col !== undefined && !isInt(v.col, 0)) err(`${path}.col`, 'must be an integer >= 0');
    if (!isInt(v.frames, 1)) err(`${path}.frames`, 'must be an integer >= 1');
    if (!isInt(v.frameMs, 1)) err(`${path}.frameMs`, 'must be an integer >= 1');
    if (v.pingPong !== undefined && typeof v.pingPong !== 'boolean') err(`${path}.pingPong`, 'must be a boolean');
  };
  const unitDef = (path: string, v: unknown) => {
    if (!isObj(v)) return err(path, 'must be an object');
    sheet(`${path}.sheet`, v.sheet);
    for (const key of ['frameWidth', 'frameHeight'] as const) if (!isInt(v[key], 1)) err(`${path}.${key}`, 'must be an integer >= 1');
    anim(`${path}.idle`, v.idle);
    if (v.moving !== undefined) anim(`${path}.moving`, v.moving);
    if (v.factions === undefined) return;
    if (!isObj(v.factions)) return err(`${path}.factions`, 'must be an object');
    for (const [faction, look] of Object.entries(v.factions)) {
      const p = `${path}.factions.${faction}`;
      if (!FACTIONS.includes(faction as Faction)) err(p, `unknown faction (use ${FACTIONS.join(', ')})`);
      else if (!isObj(look)) err(p, 'must be { sheet?, tint? }');
      else {
        if (look.sheet !== undefined) sheet(`${p}.sheet`, look.sheet);
        if (look.tint !== undefined && !isColour(look.tint)) err(`${p}.tint`, 'must be a #rgb or #rrggbb colour');
      }
    }
  };
  const tileDef = (path: string, v: unknown) => {
    if (!isObj(v)) return err(path, 'must be an object');
    sheet(`${path}.sheet`, v.sheet);
    for (const key of ['col', 'row'] as const) if (!isInt(v[key], 0)) err(`${path}.${key}`, 'must be an integer >= 0');
  };
  const section = (name: string, check: (path: string, v: unknown) => void) => {
    const v = raw[name];
    if (v === undefined) return;
    if (!isObj(v)) return err(name, 'must be an object');
    for (const [id, def] of Object.entries(v)) check(`${name}.${id}`, def);
  };
  section('classes', unitDef);
  section('units', unitDef);
  section('terrain', tileDef);

  if (errors.length > 0) return { ok: false, errors };
  const pack = raw as Partial<SpritePack>;
  return {
    ok: true,
    pack: {
      ...pack,
      version: 1,
      tileSize: pack.tileSize ?? 16,
      classes: pack.classes ?? {},
      units: pack.units ?? {},
      terrain: pack.terrain ?? {},
    },
  };
}

export function frameIndex(anim: SpriteAnim, timeMs: number): number {
  const step = Math.floor(Math.max(0, timeMs) / anim.frameMs);
  if (!anim.pingPong || anim.frames < 3) return step % anim.frames;
  const period = 2 * anim.frames - 2;
  const i = step % period;
  return i < anim.frames ? i : period - i;
}

function look(def: UnitSpriteDef, faction: Faction): { sheet: string; tint: string | null } {
  const f = def.factions?.[faction];
  if (f) return { sheet: f.sheet ?? def.sheet, tint: f.tint ?? null };
  return { sheet: def.sheet, tint: faction === 'enemy' ? DEFAULT_ENEMY_TINT : null };
}

/** The sprite cell for a unit, or null when the pack maps neither its id nor its class. */
export function unitSprite(
  pack: SpritePack,
  unit: { id: string; classId: string; faction: Faction },
  motion: 'idle' | 'moving',
  timeMs: number,
): SpriteFrame | null {
  const def = pack.units[unit.id] ?? pack.classes[unit.classId];
  if (!def) return null;
  const anim = (motion === 'moving' && def.moving) || def.idle;
  const col = (anim.col ?? 0) + frameIndex(anim, timeMs);
  return { ...look(def, unit.faction), sx: col * def.frameWidth, sy: anim.row * def.frameHeight, sw: def.frameWidth, sh: def.frameHeight };
}

export function tileSprite(pack: SpritePack, terrainId: string): SpriteFrame | null {
  const def = pack.terrain[terrainId];
  if (!def) return null;
  const size = pack.tileSize;
  return { sheet: def.sheet, sx: def.col * size, sy: def.row * size, sw: size, sh: size, tint: null };
}

/** Every (sheet, tint) image the renderer may request; `doneTint` greys out units that have acted. */
export function spriteVariants(pack: SpritePack, doneTint: string): Array<{ sheet: string; tint: string | null }> {
  const seen = new Map<string, { sheet: string; tint: string | null }>();
  const add = (sheet: string, tint: string | null) => seen.set(`${sheet}#${tint ?? ''}`, { sheet, tint });
  for (const def of [...Object.values(pack.classes), ...Object.values(pack.units)]) {
    for (const faction of FACTIONS) {
      const l = look(def, faction);
      add(l.sheet, l.tint);
      add(l.sheet, doneTint);
    }
  }
  for (const def of Object.values(pack.terrain)) add(def.sheet, null);
  return [...seen.values()];
}
