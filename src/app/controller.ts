import { planEnemyTurn } from '../core/ai';
import { applyAction, activeUnits, createBattle, readyUnits, worldOf, type Action, type BattleState } from '../core/battle';
import { buildBattleSetup, validateChapter, type ChapterDef, type Route } from '../core/chapter';
import { forecastCombat, inWeaponRange, weaponOf, type CombatForecast } from '../core/combat';
import { pointKey, samePoint, type Point } from '../core/grid';
import { attackRange, moveRange } from '../core/movement';
import type { Unit } from '../core/unit';
import { RULES } from '../data/rules';

export type MenuOption = 'attack' | 'seize' | 'wait';

export type Mode =
  | { kind: 'idle' }
  | { kind: 'selected'; unitId: string }
  | { kind: 'menu'; unitId: string; to: Point }
  | { kind: 'target'; unitId: string; to: Point; targetIds: string[]; index: number }
  | { kind: 'enemy' }
  | { kind: 'over' };

/**
 * UI flow over the pure core, without DOM: selection, tentative move, action
 * menu, targeting with forecast, enemy-phase stepping. Adapters render it.
 */
export class Controller {
  readonly chapter: ChapterDef;
  route: Route;
  seed: number;
  state!: BattleState;
  mode: Mode = { kind: 'idle' };
  cursor: Point = { x: 0, y: 0 };
  private enemyQueue: Action[] = [];

  constructor(rawChapter: unknown, route: Route, seed: number) {
    const result = validateChapter(rawChapter, RULES);
    if (!result.ok) throw new Error(`invalid chapter:\n${result.errors.join('\n')}`);
    this.chapter = result.chapter;
    this.route = route;
    this.seed = seed;
    this.restart(route, seed);
  }

  restart(route: Route, seed: number): void {
    this.route = route;
    this.seed = seed;
    this.state = createBattle(buildBattleSetup(this.chapter, route, RULES, seed));
    this.mode = { kind: 'idle' };
    this.enemyQueue = [];
    const lord = this.state.units.find((u) => u.lord);
    if (lord) this.cursor = { ...lord.pos };
  }

  unitAt(p: Point): Unit | undefined {
    return activeUnits(this.state).find((u) => samePoint(u.pos, p));
  }

  unit(id: string): Unit {
    return this.state.units.find((u) => u.id === id)!;
  }

  /** Blue (move) and red (attack-only) tiles for the selected unit, or for a hovered unit when idle. */
  highlights(): { move: Point[]; attack: Point[] } {
    let unit: Unit | undefined;
    if (this.mode.kind === 'selected') unit = this.unit(this.mode.unitId);
    else if (this.mode.kind === 'idle') unit = this.unitAt(this.cursor);
    if (!unit) return { move: [], attack: [] };
    const world = worldOf(RULES, this.state);
    const move = unit.moved ? [unit.pos] : moveRange(world, unit).destinations;
    const weapon = weaponOf(RULES, unit);
    const blue = new Set(move.map(pointKey));
    const attack = weapon ? attackRange(world, move, weapon.minRange, weapon.maxRange).filter((p) => !blue.has(pointKey(p))) : [];
    return { move, attack };
  }

  /** Where the unit being commanded currently stands (tentative position included). */
  displayPos(unit: Unit): Point {
    if ((this.mode.kind === 'menu' || this.mode.kind === 'target') && this.mode.unitId === unit.id) return this.mode.to;
    return unit.pos;
  }

  private targetsFrom(unit: Unit, from: Point): Unit[] {
    const weapon = weaponOf(RULES, unit);
    return activeUnits(this.state).filter((u) => u.faction !== unit.faction && inWeaponRange(weapon, from, u.pos));
  }

  menuOptions(): MenuOption[] {
    if (this.mode.kind !== 'menu') return [];
    const unit = this.unit(this.mode.unitId);
    const options: MenuOption[] = [];
    if (this.targetsFrom(unit, this.mode.to).length > 0) options.push('attack');
    const objective = this.state.objective;
    if (unit.lord && objective.type === 'seize' && samePoint(objective.tile, this.mode.to)) options.push('seize');
    options.push('wait');
    return options;
  }

  forecast(): CombatForecast | null {
    if (this.mode.kind !== 'target') return null;
    const target = this.unit(this.mode.targetIds[this.mode.index]!);
    return forecastCombat(RULES, this.state.grid, this.unit(this.mode.unitId), this.mode.to, target);
  }

  clickTile(p: Point): void {
    this.cursor = { ...p };
    const mode = this.mode;
    switch (mode.kind) {
      case 'idle': {
        const unit = this.unitAt(p);
        if (unit && readyUnits(this.state).some((u) => u.id === unit.id) && this.state.phase === 'player') {
          this.mode = { kind: 'selected', unitId: unit.id };
        }
        return;
      }
      case 'selected': {
        const unit = this.unit(mode.unitId);
        if (this.highlights().move.some((d) => samePoint(d, p))) this.mode = { kind: 'menu', unitId: unit.id, to: { ...p } };
        else if (!samePoint(p, unit.pos)) this.mode = { kind: 'idle' };
        return;
      }
      case 'target': {
        const index = mode.targetIds.findIndex((id) => samePoint(this.unit(id).pos, p));
        if (index === mode.index) this.confirm();
        else if (index >= 0) this.mode = { ...mode, index };
        return;
      }
      default:
        return;
    }
  }

  /** Hovering: move the cursor and, while targeting, focus the hovered target. */
  hover(p: Point): void {
    this.cursor = { ...p };
    if (this.mode.kind === 'target') {
      const index = this.mode.targetIds.findIndex((id) => samePoint(this.unit(id).pos, p));
      if (index >= 0) this.mode = { ...this.mode, index };
    }
  }

  moveCursor(dx: number, dy: number): void {
    if (this.mode.kind === 'target') {
      const n = this.mode.targetIds.length;
      this.mode = { ...this.mode, index: (this.mode.index + (dx + dy > 0 ? 1 : n - 1)) % n };
      this.cursor = { ...this.unit(this.mode.targetIds[this.mode.index]!).pos };
      return;
    }
    const { width, height } = this.state.grid;
    this.cursor = { x: Math.max(0, Math.min(width - 1, this.cursor.x + dx)), y: Math.max(0, Math.min(height - 1, this.cursor.y + dy)) };
  }

  confirm(): void {
    if (this.mode.kind === 'target') {
      const { unitId, to } = this.mode;
      this.commit(unitId, to, { type: 'attack', unitId, targetId: this.mode.targetIds[this.mode.index]! });
      return;
    }
    if (this.mode.kind === 'menu') return this.choose(this.menuOptions()[0]!);
    this.clickTile(this.cursor);
  }

  choose(option: MenuOption): void {
    if (this.mode.kind !== 'menu' || !this.menuOptions().includes(option)) return;
    const { unitId, to } = this.mode;
    if (option === 'attack') {
      const targetIds = this.targetsFrom(this.unit(unitId), to).map((u) => u.id);
      this.mode = { kind: 'target', unitId, to, targetIds, index: 0 };
      this.cursor = { ...this.unit(targetIds[0]!).pos };
      return;
    }
    this.commit(unitId, to, option === 'seize' ? { type: 'seize', unitId } : { type: 'wait', unitId });
  }

  cancel(): void {
    const mode = this.mode;
    if (mode.kind === 'target') {
      this.mode = { kind: 'menu', unitId: mode.unitId, to: mode.to };
      this.cursor = { ...mode.to };
    } else if (mode.kind === 'menu') {
      this.mode = { kind: 'selected', unitId: mode.unitId };
      this.cursor = { ...this.unit(mode.unitId).pos };
    } else if (mode.kind === 'selected') this.mode = { kind: 'idle' };
  }

  private apply(action: Action): void {
    this.state = applyAction(RULES, this.state, action);
    if (this.state.outcome !== 'ongoing') this.mode = { kind: 'over' };
  }

  private commit(unitId: string, to: Point, action: Action): void {
    if (!samePoint(this.unit(unitId).pos, to)) this.apply({ type: 'move', unitId, to });
    if (this.state.outcome === 'ongoing') this.apply(action);
    if (this.mode.kind !== 'over') this.mode = { kind: 'idle' };
    if (this.mode.kind === 'idle' && readyUnits(this.state).length === 0) this.endTurn();
  }

  endTurn(): void {
    if (this.state.phase !== 'player' || this.state.outcome !== 'ongoing' || this.mode.kind === 'enemy') return;
    this.apply({ type: 'endPhase' });
    if (this.state.outcome === 'ongoing') this.mode = { kind: 'enemy' };
  }

  /** Applies one enemy action. Returns false once control is back with the player (or the battle ended). */
  stepEnemy(): boolean {
    if (this.mode.kind !== 'enemy') return false;
    if (this.enemyQueue.length === 0) this.enemyQueue = planEnemyTurn(RULES, this.state);
    const action = this.enemyQueue.shift()!;
    this.apply(action);
    if (action.type === 'move') this.cursor = { ...action.to };
    if (this.state.outcome !== 'ongoing') return false;
    if (this.state.phase === 'player') {
      this.enemyQueue = [];
      this.mode = { kind: 'idle' };
      return false;
    }
    return true;
  }
}
