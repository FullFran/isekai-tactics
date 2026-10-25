import type { Controller } from '../app/controller';
import { tileFromEvent } from './canvas';

export interface InputHooks {
  changed(): void;
  endTurn(): void;
  restart(): void;
  toggleLanguage(): void;
}

/** Keyboard and mouse bindings onto the controller. */
export function bindInput(canvas: HTMLCanvasElement, c: Controller, hooks: InputHooks): void {
  const inBounds = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < c.state.grid.width && p.y < c.state.grid.height;
  canvas.addEventListener('click', (e) => {
    const p = tileFromEvent(canvas, e);
    if (inBounds(p)) c.clickTile(p);
    hooks.changed();
  });
  canvas.addEventListener('mousemove', (e) => {
    const p = tileFromEvent(canvas, e);
    if (inBounds(p) && (p.x !== c.cursor.x || p.y !== c.cursor.y)) {
      c.hover(p);
      hooks.changed();
    }
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    c.cancel();
    hooks.changed();
  });
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const move = moves[e.key];
    if (move) c.moveCursor(...move);
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') c.confirm();
    else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'Backspace') c.cancel();
    else if (e.key === 'a' || e.key === 'A') c.choose('attack');
    else if (e.key === 'w' || e.key === 'W') c.choose('wait');
    else if (e.key === 's' || e.key === 'S') c.choose('seize');
    else if (e.key === 'e' || e.key === 'E') return hooks.endTurn();
    else if (e.key === 'r' || e.key === 'R') return hooks.restart();
    else if (e.key === 'l' || e.key === 'L') return hooks.toggleLanguage();
    else return;
    e.preventDefault();
    hooks.changed();
  });
}
