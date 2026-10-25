/** What a key does on the battle map (layout-independent `KeyboardEvent.code`). */
export type BattleCommand =
  | { type: 'cursor'; dx: number; dy: number }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'endTurn' }
  | { type: 'restart' }
  | { type: 'language' }
  | { type: 'nextUnit' };

const CURSOR: Record<string, [number, number]> = {
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};

const OTHER: Record<string, BattleCommand> = {
  Enter: { type: 'confirm' }, NumpadEnter: { type: 'confirm' }, Space: { type: 'confirm' }, KeyZ: { type: 'confirm' },
  Escape: { type: 'cancel' }, KeyX: { type: 'cancel' }, Backspace: { type: 'cancel' },
  KeyE: { type: 'endTurn' },
  KeyR: { type: 'restart' },
  KeyL: { type: 'language' },
  Tab: { type: 'nextUnit' },
};

export function battleCommand(code: string): BattleCommand | null {
  const move = CURSOR[code];
  if (move) return { type: 'cursor', dx: move[0], dy: move[1] };
  return OTHER[code] ?? null;
}
