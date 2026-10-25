import type { Controller } from '../app/controller';
import { terrainAt, type Point } from '../core/grid';
import { RULES } from '../data/rules';

export const TILE = 44;

const TERRAIN_COLOURS: Record<string, string> = {
  plain: '#7aa35a', road: '#c2ab7f', forest: '#3f7a3d', hill: '#9b8a57', village: '#7aa35a',
  fort: '#8a8a94', gate: '#a8925c', river: '#3f78b5', wall: '#4a4a52',
};

const CLASS_GLYPH: Record<string, string> = {
  lord: 'L', mercenary: 'M', myrmidon: 'S', soldier: 'P', knight: 'K', cavalier: 'C', fighter: 'F', brigand: 'B', archer: 'A', mage: 'm',
};

function tileRect(ctx: CanvasRenderingContext2D, p: Point, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(p.x * TILE, p.y * TILE, TILE, TILE);
}

function drawTerrainDetail(ctx: CanvasRenderingContext2D, id: string, x: number, y: number): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  ctx.save();
  switch (id) {
    case 'forest':
      ctx.fillStyle = '#245a27';
      for (const [dx, dy] of [[-9, 4], [8, 6], [0, -6]] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + dx, cy + dy - 10);
        ctx.lineTo(cx + dx - 7, cy + dy + 5);
        ctx.lineTo(cx + dx + 7, cy + dy + 5);
        ctx.fill();
      }
      break;
    case 'hill':
      ctx.fillStyle = '#7d6e42';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + TILE - 6);
      ctx.lineTo(cx, y + 10);
      ctx.lineTo(x + TILE - 4, y + TILE - 6);
      ctx.fill();
      break;
    case 'village':
      ctx.fillStyle = '#c9895a';
      ctx.fillRect(cx - 10, cy - 2, 20, 14);
      ctx.fillStyle = '#8c3b2e';
      ctx.beginPath();
      ctx.moveTo(cx - 13, cy - 2);
      ctx.lineTo(cx, cy - 14);
      ctx.lineTo(cx + 13, cy - 2);
      ctx.fill();
      break;
    case 'fort':
    case 'gate':
      ctx.strokeStyle = '#3b3b44';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
      if (id === 'gate') {
        ctx.fillStyle = '#5b4426';
        ctx.fillRect(cx - 6, cy - 4, 12, 15);
      }
      break;
    case 'river':
      ctx.strokeStyle = '#6fa3d8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, cy - 4);
      ctx.quadraticCurveTo(cx, cy - 10, x + TILE - 6, cy - 4);
      ctx.moveTo(x + 6, cy + 6);
      ctx.quadraticCurveTo(cx, cy, x + TILE - 6, cy + 6);
      ctx.stroke();
      break;
    case 'road':
      ctx.strokeStyle = '#8f7a52';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      break;
    default:
      break;
  }
  ctx.restore();
}

export function render(ctx: CanvasRenderingContext2D, c: Controller): void {
  const { grid } = c.state;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const id = terrainAt(grid, RULES.terrains, { x, y }).id;
      tileRect(ctx, { x, y }, TERRAIN_COLOURS[id] ?? '#777');
      drawTerrainDetail(ctx, id, x * TILE, y * TILE);
    }
  }

  const objective = c.state.objective;
  if (objective.type === 'seize') {
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(objective.tile.x * TILE + 3, objective.tile.y * TILE + 3, TILE - 6, TILE - 6);
    ctx.setLineDash([]);
  }

  const { move, attack } = c.highlights();
  for (const p of move) tileRect(ctx, p, 'rgba(70, 130, 255, 0.45)');
  for (const p of attack) tileRect(ctx, p, 'rgba(235, 60, 60, 0.4)');
  if (c.mode.kind === 'target') {
    for (const id of c.mode.targetIds) tileRect(ctx, c.unit(id).pos, 'rgba(235, 60, 60, 0.55)');
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= grid.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * TILE + 0.5, 0);
    ctx.lineTo(x * TILE + 0.5, grid.height * TILE);
    ctx.stroke();
  }
  for (let y = 0; y <= grid.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * TILE + 0.5);
    ctx.lineTo(grid.width * TILE, y * TILE + 0.5);
    ctx.stroke();
  }

  for (const u of c.state.units) {
    if (u.status !== 'active') continue;
    const p = c.displayPos(u);
    const cx = p.x * TILE + TILE / 2;
    const cy = p.y * TILE + TILE / 2 - 3;
    const done = u.faction === c.state.phase && u.acted;
    ctx.fillStyle = done ? '#6b6f7a' : u.faction === 'player' ? '#2f6fe0' : '#d2413a';
    ctx.beginPath();
    if (u.faction === 'player') ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    else ctx.rect(cx - 13, cy - 13, 26, 26);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = u.lord ? '#ffd34d' : u.boss ? '#1b0b0b' : 'rgba(255,255,255,0.75)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CLASS_GLYPH[u.classId] ?? '?', cx, cy + 1);
    // HP bar
    const ratio = Math.max(0, u.hp / u.stats.hp);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(p.x * TILE + 6, p.y * TILE + TILE - 7, TILE - 12, 4);
    ctx.fillStyle = ratio > 0.5 ? '#5fd35f' : ratio > 0.25 ? '#f0c040' : '#f05050';
    ctx.fillRect(p.x * TILE + 6, p.y * TILE + TILE - 7, (TILE - 12) * ratio, 4);
  }

  ctx.strokeStyle = '#ffe36e';
  ctx.lineWidth = 3;
  ctx.strokeRect(c.cursor.x * TILE + 2, c.cursor.y * TILE + 2, TILE - 4, TILE - 4);
}

export function tileFromEvent(canvas: HTMLCanvasElement, event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return { x: Math.floor(((event.clientX - rect.left) * scale) / TILE), y: Math.floor(((event.clientY - rect.top) * scale) / TILE) };
}
