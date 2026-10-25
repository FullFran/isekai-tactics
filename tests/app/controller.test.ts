import { describe, expect, it } from 'vitest';
import { Controller } from '../../src/app/controller';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';

const make = () => new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', 42);

describe('UI controller', () => {
  it('selects a ready unit and exposes its move and attack ranges', () => {
    const c = make();
    c.clickTile({ x: 2, y: 9 }); // Aren
    expect(c.mode.kind).toBe('selected');
    expect(c.highlights().move.length).toBeGreaterThan(1);
    expect(c.highlights().attack.length).toBeGreaterThan(0);
    c.cancel();
    expect(c.mode.kind).toBe('idle');
  });

  it('moves tentatively, opens the action menu and commits move + wait', () => {
    const c = make();
    c.clickTile({ x: 2, y: 9 });
    c.clickTile({ x: 2, y: 7 });
    expect(c.mode.kind).toBe('menu');
    expect(c.menuOptions()).toEqual(['wait']);
    c.cancel();
    expect(c.mode.kind).toBe('selected');
    c.clickTile({ x: 2, y: 7 });
    c.choose('wait');
    expect(c.state.log).toEqual([
      { type: 'move', unitId: 'aren', to: { x: 2, y: 7 } },
      { type: 'wait', unitId: 'aren' },
    ]);
    expect(c.mode.kind).toBe('idle');
  });

  it('shows a forecast for the hovered target and commits the attack on confirm', () => {
    const c = make();
    c.state.units.find((u) => u.id === 'raider-2')!.pos = { x: 3, y: 6 };
    c.clickTile({ x: 3, y: 8 }); // Lio
    c.clickTile({ x: 3, y: 7 });
    expect(c.menuOptions()).toContain('attack');
    c.choose('attack');
    expect(c.mode.kind).toBe('target');
    expect(c.forecast()?.defender.unitId).toBe('raider-2');
    c.confirm();
    expect(c.state.log.map((a) => a.type)).toEqual(['move', 'attack']);
    expect(c.state.events.some((e) => e.type === 'combat')).toBe(true);
  });

  it('ends the turn, plays the enemy phase step by step and hands control back', () => {
    const c = make();
    c.endTurn();
    expect(c.mode.kind).toBe('enemy');
    let guard = 0;
    while (c.mode.kind === 'enemy' && guard++ < 100) c.stepEnemy();
    expect(c.state.phase).toBe('player');
    expect(c.state.turn).toBe(2);
    expect(c.mode.kind).toBe('idle');
  });

  it('restarts with another route', () => {
    const c = make();
    c.restart('hard', 7);
    expect(c.route).toBe('hard');
    expect(c.state.units.filter((u) => u.faction === 'player')).toHaveLength(3);
  });
});

describe('next ready unit', () => {
  it('cycles the cursor over the units that can still act', () => {
    const c = make();
    const ready = c.state.units.filter((u) => u.faction === 'player' && u.status === 'active').map((u) => `${u.pos.x},${u.pos.y}`);
    const seen = new Set<string>();
    for (let i = 0; i < ready.length; i++) {
      c.nextReadyUnit();
      seen.add(`${c.cursor.x},${c.cursor.y}`);
    }
    expect([...seen].sort()).toEqual([...ready].sort());
  });
});
