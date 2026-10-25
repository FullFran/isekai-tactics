import { describe, expect, it } from 'vitest';
import { battleCommand } from '../../src/adapters/keys';

describe('battleCommand', () => {
  it('moves the cursor with WASD and the arrows', () => {
    expect(battleCommand('KeyW')).toEqual({ type: 'cursor', dx: 0, dy: -1 });
    expect(battleCommand('ArrowUp')).toEqual({ type: 'cursor', dx: 0, dy: -1 });
    expect(battleCommand('KeyS')).toEqual({ type: 'cursor', dx: 0, dy: 1 });
    expect(battleCommand('ArrowDown')).toEqual({ type: 'cursor', dx: 0, dy: 1 });
    expect(battleCommand('KeyA')).toEqual({ type: 'cursor', dx: -1, dy: 0 });
    expect(battleCommand('ArrowLeft')).toEqual({ type: 'cursor', dx: -1, dy: 0 });
    expect(battleCommand('KeyD')).toEqual({ type: 'cursor', dx: 1, dy: 0 });
    expect(battleCommand('ArrowRight')).toEqual({ type: 'cursor', dx: 1, dy: 0 });
  });

  it('confirms with Enter, Space and Z; cancels with Esc, X and Backspace', () => {
    for (const code of ['Enter', 'NumpadEnter', 'Space', 'KeyZ']) expect(battleCommand(code)).toEqual({ type: 'confirm' });
    for (const code of ['Escape', 'KeyX', 'Backspace']) expect(battleCommand(code)).toEqual({ type: 'cancel' });
  });

  it('keeps the shortcuts that do not clash with WASD', () => {
    expect(battleCommand('KeyE')).toEqual({ type: 'endTurn' });
    expect(battleCommand('KeyR')).toEqual({ type: 'restart' });
    expect(battleCommand('KeyL')).toEqual({ type: 'language' });
    expect(battleCommand('Tab')).toEqual({ type: 'nextUnit' });
    expect(battleCommand('KeyQ')).toBeNull();
  });
});
