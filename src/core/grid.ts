export type MovementType = 'foot' | 'armor' | 'mounted' | 'flier';
export const MOVEMENT_TYPES: readonly MovementType[] = ['foot', 'armor', 'mounted', 'flier'];

export interface Point {
  x: number;
  y: number;
}

/** Terrain bonuses and per-movement-type cost; `null` means impassable. */
export interface Terrain {
  id: string;
  avoid: number;
  def: number;
  /** Percentage of max HP healed at the start of the owner's phase. */
  healPct: number;
  moveCost: Record<MovementType, number | null>;
}

/** Rectangular map of terrain ids, row-major. */
export interface Grid {
  width: number;
  height: number;
  tiles: string[];
}

export const pointKey = (p: Point): string => `${p.x},${p.y}`;
export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export const manhattan = (a: Point, b: Point): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function parseGrid(rows: readonly string[], legend: Readonly<Record<string, string>>): Grid {
  const width = rows[0]?.length ?? 0;
  const tiles: string[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`map row ${y} has length ${row.length}, expected ${width}`);
    for (const char of row) {
      const id = legend[char];
      if (id === undefined) throw new Error(`map character "${char}" is not in the legend`);
      tiles.push(id);
    }
  });
  return { width, height: rows.length, tiles };
}

export function inBounds(grid: Grid, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height;
}

export function terrainAt(grid: Grid, terrains: Readonly<Record<string, Terrain>>, p: Point): Terrain {
  const id = grid.tiles[p.y * grid.width + p.x];
  const terrain = id === undefined ? undefined : terrains[id];
  if (!terrain) throw new Error(`no terrain at ${pointKey(p)}`);
  return terrain;
}

export function neighbours(grid: Grid, p: Point): Point[] {
  return [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ].filter((n) => inBounds(grid, n));
}
