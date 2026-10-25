import { describe, expect, it } from 'vitest';
import { firstSelectable, moveCursor, navAction, restoreCursor, selectable } from '../../src/adapters/ui/nav';

const items = (...flags: ('ok' | 'off' | 'head')[]) => flags.map((f) => ({ disabled: f === 'off', header: f === 'head' }));

describe('cursor navigation', () => {
  it('only plain items are selectable (disabled items and headers are not)', () => {
    expect(items('ok', 'off', 'head').map(selectable)).toEqual([true, false, false]);
  });

  it('moves down and up, wrapping at both ends', () => {
    const list = items('ok', 'ok', 'ok');
    expect(moveCursor(list, 0, 1)).toBe(1);
    expect(moveCursor(list, 2, 1)).toBe(0);
    expect(moveCursor(list, 0, -1)).toBe(2);
  });

  it('skips disabled items and headers in both directions, wrapping past them', () => {
    const list = items('head', 'ok', 'off', 'ok', 'head', 'off');
    expect(moveCursor(list, 1, 1)).toBe(3);
    expect(moveCursor(list, 3, 1)).toBe(1);
    expect(moveCursor(list, 1, -1)).toBe(3);
    expect(moveCursor(list, 3, -1)).toBe(1);
  });

  it('stays put when nothing else is selectable, and reports -1 when nothing is', () => {
    expect(moveCursor(items('off', 'ok', 'off'), 1, 1)).toBe(1);
    expect(moveCursor(items('off', 'head'), 0, 1)).toBe(-1);
    expect(moveCursor([], 0, -1)).toBe(-1);
  });

  it('starts on the first selectable item at or after a start index', () => {
    expect(firstSelectable(items('head', 'off', 'ok', 'ok'))).toBe(2);
    expect(firstSelectable(items('ok', 'off', 'ok'), 1)).toBe(2);
    expect(firstSelectable(items('ok', 'off', 'off'), 1)).toBe(0);
    expect(firstSelectable(items('off'))).toBe(-1);
  });

  it('keeps the cursor on re-render while its item is still selectable, else moves to the next one', () => {
    expect(restoreCursor(items('ok', 'ok', 'ok'), 2)).toBe(2);
    expect(restoreCursor(items('ok', 'off', 'ok'), 1)).toBe(2);
    expect(restoreCursor(items('ok', 'ok'), 5)).toBe(0);
  });
});

describe('menu keys', () => {
  it('maps arrows and W/S to the cursor, A/D and left/right to adjusting, Enter/Space/Z to confirm, Esc/X/Backspace to back', () => {
    expect(['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].map((c) => navAction(c))).toEqual(['prev', 'prev', 'next', 'next']);
    expect(['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].map((c) => navAction(c))).toEqual(['left', 'left', 'right', 'right']);
    expect(['Enter', 'NumpadEnter', 'Space', 'KeyZ'].map((c) => navAction(c))).toEqual(['confirm', 'confirm', 'confirm', 'confirm']);
    expect(['Escape', 'KeyX', 'Backspace'].map((c) => navAction(c))).toEqual(['back', 'back', 'back']);
    expect(navAction('KeyQ')).toBeNull();
  });

  it('a horizontal list moves with left/right and A/D', () => {
    expect(['ArrowLeft', 'KeyD'].map((c) => navAction(c, 'horizontal'))).toEqual(['prev', 'next']);
  });
});
