import { inBounds, manhattan, neighbours, pointKey, terrainAt, type Grid, type MovementType, type Point, type Terrain } from './grid';

export type Faction = 'player' | 'enemy';

/** The part of a unit that movement needs. */
export interface Mover {
  id: string;
  faction: Faction;
  pos: Point;
  mov: number;
  movementType: MovementType;
}

export interface World {
  grid: Grid;
  terrains: Readonly<Record<string, Terrain>>;
  units: readonly Mover[];
}

export interface MoveRange {
  /** Movement spent to reach each tile, including tiles passed through but not stoppable (allies). */
  cost: Map<string, number>;
  /** Tiles the unit may end its move on, in deterministic (row, column) order. */
  destinations: Point[];
}

/**
 * Dijkstra over terrain costs. Enemies of the mover block; allies can be
 * passed through but not stopped on.
 */
export function moveRange(world: World, unit: Mover, budget = unit.mov): MoveRange {
  const occupant = new Map(world.units.filter((u) => u.id !== unit.id).map((u) => [pointKey(u.pos), u]));
  const cost = new Map<string, number>([[pointKey(unit.pos), 0]]);
  const frontier: Array<{ p: Point; c: number }> = [{ p: unit.pos, c: 0 }];
  while (frontier.length > 0) {
    frontier.sort((a, b) => a.c - b.c || a.p.y - b.p.y || a.p.x - b.p.x);
    const { p, c } = frontier.shift()!;
    if (c > (cost.get(pointKey(p)) ?? Infinity)) continue;
    for (const n of neighbours(world.grid, p)) {
      const step = terrainAt(world.grid, world.terrains, n).moveCost[unit.movementType];
      if (step === null) continue;
      const other = occupant.get(pointKey(n));
      if (other && other.faction !== unit.faction) continue;
      const next = c + step;
      if (next > budget || next >= (cost.get(pointKey(n)) ?? Infinity)) continue;
      cost.set(pointKey(n), next);
      frontier.push({ p: n, c: next });
    }
  }
  const destinations: Point[] = [];
  for (const key of cost.keys()) {
    if (occupant.has(key)) continue;
    const [x, y] = key.split(',').map(Number) as [number, number];
    destinations.push({ x, y });
  }
  destinations.sort((a, b) => a.y - b.y || a.x - b.x);
  return { cost, destinations };
}

/** Tiles at Manhattan distance minRange..maxRange from `from`, inside the map. */
export function tilesInRange(grid: Grid, from: Point, minRange: number, maxRange: number): Point[] {
  const out: Point[] = [];
  for (let dy = -maxRange; dy <= maxRange; dy++) {
    for (let dx = -maxRange; dx <= maxRange; dx++) {
      const p = { x: from.x + dx, y: from.y + dy };
      const d = manhattan(from, p);
      if (d >= minRange && d <= maxRange && inBounds(grid, p)) out.push(p);
    }
  }
  return out;
}

/** Every tile attackable from some destination with a weapon of the given range. */
export function attackRange(world: World, destinations: readonly Point[], minRange: number, maxRange: number): Point[] {
  const seen = new Map<string, Point>();
  for (const d of destinations) {
    for (const p of tilesInRange(world.grid, d, minRange, maxRange)) seen.set(pointKey(p), p);
  }
  return [...seen.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
