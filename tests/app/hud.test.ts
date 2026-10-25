import { describe, expect, it } from 'vitest';
import { Controller } from '../../src/app/controller';
import { controlsHintKey, routeSummary } from '../../src/app/hud';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';

const make = () => new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', 42);

describe('routeSummary', () => {
  it('counts deployed party members and enemies per route', () => {
    const c = make();
    expect(routeSummary(c.chapter, 'easy')).toEqual({ units: 4, enemies: 6 });
    expect(routeSummary(c.chapter, 'hard')).toEqual({ units: 3, enemies: 7 });
  });
});

describe('controlsHintKey', () => {
  it('follows the controller mode and the animation state', () => {
    const c = make();
    expect(controlsHintKey(c.mode, false)).toBe('hint.idle');
    c.clickTile({ x: 2, y: 9 });
    expect(controlsHintKey(c.mode, false)).toBe('hint.selected');
    c.clickTile({ x: 2, y: 7 });
    expect(controlsHintKey(c.mode, false)).toBe('hint.menu');
    expect(controlsHintKey(c.mode, true)).toBe('hint.animating');
    expect(controlsHintKey({ kind: 'target', unitId: 'aren', to: { x: 0, y: 0 }, targetIds: ['x'], index: 0 }, false)).toBe('hint.target');
    expect(controlsHintKey({ kind: 'enemy' }, false)).toBe('hint.enemy');
    expect(controlsHintKey({ kind: 'over' }, false)).toBe('hint.over');
  });
});
