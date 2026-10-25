import { describe, expect, it } from 'vitest';
import { parseGrid, type Terrain } from '../../src/core/grid';
import { attackRange, moveRange, type Mover } from '../../src/core/movement';

const terrains: Record<string, Terrain> = {
  plain: { id: 'plain', avoid: 0, def: 0, healPct: 0, moveCost: { foot: 1, armor: 1, mounted: 1, flier: 1 } },
  forest: { id: 'forest', avoid: 20, def: 1, healPct: 0, moveCost: { foot: 2, armor: 2, mounted: 3, flier: 1 } },
  wall: { id: 'wall', avoid: 0, def: 0, healPct: 0, moveCost: { foot: null, armor: null, mounted: null, flier: null } },
};
const legend = { '.': 'plain', F: 'forest', '#': 'wall' };

function mover(over: Partial<Mover> = {}): Mover {
  return { id: 'a', faction: 'player', pos: { x: 0, y: 0 }, mov: 3, movementType: 'foot', ...over };
}

const keys = (tiles: Iterable<{ x: number; y: number }>) => [...tiles].map((p) => `${p.x},${p.y}`).sort();

describe('parseGrid', () => {
  it('maps legend characters to terrain ids row by row', () => {
    const grid = parseGrid(['.F', '#.'], legend);
    expect(grid.width).toBe(2);
    expect(grid.height).toBe(2);
    expect(grid.tiles).toEqual(['plain', 'forest', 'wall', 'plain']);
  });
});

describe('moveRange', () => {
  it('spends movement by terrain cost (Dijkstra) and never enters impassable tiles', () => {
    const grid = parseGrid(['.F..', '.#..', '....'], legend);
    const range = moveRange({ grid, terrains, units: [] }, mover({ mov: 2 }));
    expect(keys(range.destinations)).toEqual(['0,0', '0,1', '0,2', '1,0'].sort());
    expect(range.cost.get('1,0')).toBe(2);
    expect(range.cost.has('1,1')).toBe(false);
  });

  it('uses the movement type: mounted units pay more in forest', () => {
    const grid = parseGrid(['.F.'], legend);
    const foot = moveRange({ grid, terrains, units: [] }, mover({ mov: 3 }));
    const horse = moveRange({ grid, terrains, units: [] }, mover({ mov: 3, movementType: 'mounted' }));
    expect(foot.cost.get('2,0')).toBe(3);
    expect(horse.cost.has('2,0')).toBe(false);
  });

  it('lets units pass through allies but not stop on them, and enemies block the path', () => {
    const grid = parseGrid(['.....'], legend);
    const ally = mover({ id: 'ally', pos: { x: 1, y: 0 } });
    const throughAlly = moveRange({ grid, terrains, units: [ally] }, mover({ mov: 3 }));
    expect(keys(throughAlly.destinations)).toEqual(['0,0', '2,0', '3,0']);

    const foe = mover({ id: 'foe', faction: 'enemy', pos: { x: 1, y: 0 } });
    const blocked = moveRange({ grid, terrains, units: [foe] }, mover({ mov: 3 }));
    expect(keys(blocked.destinations)).toEqual(['0,0']);
  });
});

describe('attackRange', () => {
  it('adds every tile within weapon min..max range of any destination', () => {
    const grid = parseGrid(['.....', '.....', '.....'], legend);
    const world = { grid, terrains, units: [] };
    const unit = mover({ mov: 0, pos: { x: 2, y: 1 } });
    const melee = attackRange(world, moveRange(world, unit).destinations, 1, 1);
    expect(keys(melee)).toEqual(['1,1', '2,0', '2,2', '3,1']);
    const bow = attackRange(world, moveRange(world, unit).destinations, 2, 2);
    expect(keys(bow)).toEqual(['0,1', '1,0', '1,2', '3,0', '3,2', '4,1']);
  });
});
