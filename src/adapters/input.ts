import type { Point } from '../core/grid';
import { tileFromEvent } from './canvas';
import { battleCommand, type BattleCommand } from './keys';
import { listHasKeyboard } from './ui/cursor-list';

export interface BattleInput {
  /** Map size, to ignore clicks on the canvas border. */
  size(): { width: number; height: number };
  command(command: BattleCommand): void;
  click(p: Point): void;
  hover(p: Point): void;
  /** Right click. */
  cancel(): void;
}

/**
 * Keyboard and mouse on the battle map. Keys an open cursor menu handles (the
 * action menu, the pause menu) never reach the map. Returns the unbinding.
 */
export function bindBattleInput(canvas: HTMLCanvasElement, input: BattleInput): () => void {
  const inside = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < input.size().width && p.y < input.size().height;
  const onClick = (e: MouseEvent) => {
    const p = tileFromEvent(canvas, e);
    if (inside(p)) input.click(p);
  };
  const onMove = (e: MouseEvent) => {
    const p = tileFromEvent(canvas, e);
    if (inside(p)) input.hover(p);
  };
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    input.cancel();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey || listHasKeyboard()) return;
    const command = battleCommand(e.code);
    if (!command) return;
    if (command.type === 'confirm' && e.repeat) return e.preventDefault();
    e.preventDefault();
    input.command(command);
  };
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKey);
  return () => {
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('contextmenu', onContext);
    window.removeEventListener('keydown', onKey);
  };
}
