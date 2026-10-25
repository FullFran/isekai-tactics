import { describe, expect, it } from 'vitest';
import { Controller } from '../../src/app/controller';
import { ANIM, baseViews, durationMs, frameAt, stepsBetween, tentativeMove } from '../../src/app/presenter';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';
import { RULES } from '../../src/data/rules';
import type { BattleState } from '../../src/core/battle';

const make = () => new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', 42);
const posOf = (s: BattleState) => (id: string) => s.units.find((u) => u.id === id)!.pos;

describe('presenter: movement', () => {
  it('walks a tentative move tile by tile and ends on the destination', () => {
    const c = make();
    const steps = tentativeMove(RULES, c.state, 'aren', { x: 2, y: 7 }, 1);
    expect(steps).toHaveLength(1);
    const base = baseViews(c.state, posOf(c.state));
    expect(durationMs(steps)).toBe(2 * ANIM.moveTileMs);
    const mid = frameAt(base, steps, ANIM.moveTileMs / 2).units.find((u) => u.id === 'aren')!;
    expect(mid.x).toBe(2);
    expect(mid.y).toBeCloseTo(8.5);
    const end = frameAt(base, steps, durationMs(steps)).units.find((u) => u.id === 'aren')!;
    expect([end.x, end.y]).toEqual([2, 7]);
  });

  it('plays nothing at animation speed 0', () => {
    const c = make();
    expect(tentativeMove(RULES, c.state, 'aren', { x: 2, y: 7 }, 0)).toEqual([]);
  });
});

describe('presenter: combat', () => {
  function attack() {
    const c = make();
    c.state.units.find((u) => u.id === 'raider-2')!.pos = { x: 3, y: 6 };
    c.clickTile({ x: 3, y: 8 });
    c.clickTile({ x: 3, y: 7 });
    c.choose('attack');
    const shown = (id: string) => c.displayPos(c.unit(id));
    const before = c.state;
    const shownBefore = new Map(before.units.map((u) => [u.id, { ...shown(u.id) }]));
    c.confirm();
    return { before, after: c.state, shown: (id: string) => shownBefore.get(id)! };
  }

  it('skips the walk already shown, lunges once per strike and lands on the final HP', () => {
    const { before, after, shown } = attack();
    const steps = stepsBetween(RULES, before, after, shown, 1);
    expect(steps.some((s) => s.kind === 'move')).toBe(false);
    const combat = after.events.find((e) => e.type === 'combat');
    if (combat?.type !== 'combat') throw new Error('no combat');
    expect(steps.filter((s) => s.kind === 'strike')).toHaveLength(combat.result.strikes.length);
    const end = frameAt(baseViews(before, shown), steps, durationMs(steps));
    for (const id of ['lio', 'raider-2']) {
      expect(end.units.find((u) => u.id === id)!.hp).toBe(after.units.find((u) => u.id === id)!.hp);
    }
  });

  it('floats a damage number or a miss at each impact', () => {
    const { before, after, shown } = attack();
    const steps = stepsBetween(RULES, before, after, shown, 1);
    const base = baseViews(before, shown);
    const firstImpact = ANIM.strikeMs / 2 + 1;
    const texts = frameAt(base, steps, firstImpact).texts;
    expect(texts).toHaveLength(1);
    expect(['damage', 'crit', 'miss']).toContain(texts[0]!.kind);
  });

  it('fades a defeated unit out and shows the phase banner', () => {
    const c = make();
    const before = c.state;
    const raider = before.units.find((u) => u.id === 'raider-1')!;
    const after: BattleState = {
      ...before,
      units: before.units.map((u) => (u.id === 'raider-1' ? { ...u, hp: 0, status: 'defeated' } : u)),
      events: [...before.events, { type: 'defeated', unitId: 'raider-1' }, { type: 'phase', phase: 'enemy', turn: 1 }],
    };
    const steps = stepsBetween(RULES, before, after, posOf(before), 1);
    expect(steps.map((s) => s.kind)).toEqual(['fade', 'banner']);
    const base = baseViews(before, posOf(before));
    expect(frameAt(base, steps, ANIM.fadeMs).units.find((u) => u.id === raider.id)!.alpha).toBe(0);
    const banner = frameAt(base, steps, ANIM.fadeMs + ANIM.bannerMs / 2).banner;
    expect(banner).toMatchObject({ phase: 'enemy', turn: 1 });
    expect(frameAt(base, steps, durationMs(steps) + 1).banner).toBeNull();
  });
});
