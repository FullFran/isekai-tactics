import { worldOf, type BattleState } from '../core/battle';
import { samePoint, type Point } from '../core/grid';
import { pathTo, type Faction } from '../core/movement';
import type { Rules } from '../core/unit';

/**
 * Battle animation as pure data. The core resolves an action at once; the
 * presenter turns the difference between two states into timed steps (walk,
 * lunge and impact, fade-out, phase banner, popups) and samples them into a
 * frame the canvas draws. Times are in ms at speed 1.
 */
export const ANIM = {
  moveTileMs: 90,
  strikeMs: 440,
  fadeMs: 380,
  bannerMs: 1100,
  popupMs: 260,
  numberLifeMs: 850,
  /** How far the attacker lunges towards the target, in tiles. */
  lungeTiles: 0.32,
  shakePx: 5,
  shakeMs: 260,
} as const;

export interface UnitView {
  id: string;
  /** Tile coordinates, fractional while walking. */
  x: number;
  y: number;
  hp: number;
  alpha: number;
  /** Hit flash, 0..1. */
  flash: number;
  /** Lunge offset in tiles. */
  dx: number;
  dy: number;
}

export type Step =
  | { kind: 'move'; unitId: string; path: Point[]; ms: number }
  | { kind: 'strike'; attackerId: string; targetId: string; hit: boolean; crit: boolean; damage: number; ms: number }
  | { kind: 'fade'; unitId: string; ms: number }
  | { kind: 'banner'; phase: Faction; turn: number; ms: number }
  | { kind: 'popup'; unitId: string; text: 'levelUp' | 'exp'; value: number; ms: number };

export interface FloatText {
  kind: 'damage' | 'crit' | 'miss' | 'levelUp' | 'exp';
  value: number;
  x: number;
  y: number;
  /** 0 when it appears, 1 when it is gone. */
  age: number;
}

export interface Frame {
  units: UnitView[];
  texts: FloatText[];
  banner: { phase: Faction; turn: number; progress: number } | null;
  shake: { x: number; y: number };
}

const scaled = (ms: number, scale: number) => Math.round(ms * scale);

export function baseViews(state: BattleState, shown: (id: string) => Point): Map<string, UnitView> {
  const views = new Map<string, UnitView>();
  for (const u of state.units) {
    if (u.status !== 'active') continue;
    const p = shown(u.id);
    views.set(u.id, { id: u.id, x: p.x, y: p.y, hp: u.hp, alpha: 1, flash: 0, dx: 0, dy: 0 });
  }
  return views;
}

function walk(rules: Rules, state: BattleState, unitId: string, to: Point, scale: number): Step[] {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || scale === 0) return [];
  const path = pathTo(worldOf(rules, state), unit, to);
  if (path.length < 2) return [];
  return [{ kind: 'move', unitId, path, ms: scaled(ANIM.moveTileMs * (path.length - 1), scale) }];
}

/** The walk shown when a destination is picked, before the move is committed. */
export function tentativeMove(rules: Rules, state: BattleState, unitId: string, to: Point, scale: number): Step[] {
  return walk(rules, state, unitId, to, scale);
}

/**
 * Steps that take the screen from `before` to `after`: new moves first (skipped
 * when `shown` already has the unit on its destination), then the new events.
 */
export function stepsBetween(rules: Rules, before: BattleState, after: BattleState, shown: (id: string) => Point, scale: number): Step[] {
  if (scale === 0) return [];
  const steps: Step[] = [];
  for (const action of after.log.slice(before.log.length)) {
    if (action.type === 'move' && !samePoint(shown(action.unitId), action.to)) steps.push(...walk(rules, before, action.unitId, action.to, scale));
  }
  for (const event of after.events.slice(before.events.length)) {
    switch (event.type) {
      case 'combat':
        for (const s of event.result.strikes) {
          steps.push({ kind: 'strike', attackerId: s.attackerId, targetId: s.targetId, hit: s.hit, crit: s.crit, damage: s.damage, ms: scaled(ANIM.strikeMs, scale) });
        }
        break;
      case 'defeated':
      case 'retreat':
        steps.push({ kind: 'fade', unitId: event.unitId, ms: scaled(ANIM.fadeMs, scale) });
        break;
      case 'levelUp':
        steps.push({ kind: 'popup', unitId: event.unitId, text: 'levelUp', value: event.level, ms: scaled(ANIM.popupMs * 2, scale) });
        break;
      case 'exp':
        steps.push({ kind: 'popup', unitId: event.unitId, text: 'exp', value: event.amount, ms: scaled(ANIM.popupMs, scale) });
        break;
      case 'phase':
        steps.push({ kind: 'banner', phase: event.phase, turn: event.turn, ms: scaled(ANIM.bannerMs, scale) });
        break;
      case 'outcome':
        break;
    }
  }
  return steps;
}

export const durationMs = (steps: readonly Step[]): number => steps.reduce((sum, s) => sum + s.ms, 0);

/** Samples the steps at `t` ms after they started. Past the end it is the final picture (numbers still fading). */
export function frameAt(base: ReadonlyMap<string, UnitView>, steps: readonly Step[], t: number): Frame {
  const units = new Map([...base].map(([id, v]) => [id, { ...v }]));
  const texts: FloatText[] = [];
  let banner: Frame['banner'] = null;
  const shake = { x: 0, y: 0 };
  let start = 0;
  for (const step of steps) {
    if (t < start) break;
    const end = start + step.ms;
    const p = step.ms === 0 ? 1 : Math.min(1, (t - start) / step.ms);
    switch (step.kind) {
      case 'move': {
        const view = units.get(step.unitId);
        if (!view) break;
        const segments = step.path.length - 1;
        const f = Math.min(p * segments, segments);
        const i = Math.min(Math.floor(f), segments - 1);
        const a = step.path[i]!;
        const b = step.path[i + 1]!;
        view.x = a.x + (b.x - a.x) * (f - i);
        view.y = a.y + (b.y - a.y) * (f - i);
        break;
      }
      case 'strike': {
        const attacker = units.get(step.attackerId);
        const target = units.get(step.targetId);
        if (!attacker || !target) break;
        if (p < 1) {
          const vx = target.x - attacker.x;
          const vy = target.y - attacker.y;
          const length = Math.hypot(vx, vy) || 1;
          const k = Math.sin(Math.PI * p) * ANIM.lungeTiles;
          attacker.dx = (vx / length) * k;
          attacker.dy = (vy / length) * k;
        } else {
          attacker.dx = 0;
          attacker.dy = 0;
        }
        const impact = start + step.ms / 2;
        if (t >= impact) {
          target.hp = Math.max(0, target.hp - step.damage);
          target.flash = step.hit && p < 1 ? 1 - (p - 0.5) * 2 : 0;
          const age = (t - impact) / ANIM.numberLifeMs;
          if (age < 1) texts.push({ kind: !step.hit ? 'miss' : step.crit ? 'crit' : 'damage', value: step.damage, x: target.x, y: target.y, age });
          const since = t - impact;
          if (step.crit && since < ANIM.shakeMs) {
            const amplitude = ANIM.shakePx * (1 - since / ANIM.shakeMs);
            shake.x = Math.sin(since * 0.9) * amplitude;
            shake.y = Math.cos(since * 1.3) * amplitude;
          }
        }
        break;
      }
      case 'fade': {
        const view = units.get(step.unitId);
        if (view) view.alpha = 1 - p;
        break;
      }
      case 'banner':
        if (t < end) banner = { phase: step.phase, turn: step.turn, progress: p };
        break;
      case 'popup': {
        const view = units.get(step.unitId);
        const age = (t - start) / ANIM.numberLifeMs;
        if (view && age < 1) texts.push({ kind: step.text, value: step.value, x: view.x, y: view.y, age });
        break;
      }
    }
    start = end;
  }
  return { units: [...units.values()], texts, banner, shake };
}
