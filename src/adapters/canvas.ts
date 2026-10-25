import type { Controller } from '../app/controller';
import type { FloatText, Frame, UnitView } from '../app/presenter';
import { worldOf } from '../core/battle';
import { pointKey, terrainAt, type Grid, type Point } from '../core/grid';
import { pathTo } from '../core/movement';
import { tileSprite, unitSprite } from '../core/spritePack';
import type { Unit } from '../core/unit';
import { RULES } from '../data/rules';
import { t } from '../i18n';
import { DONE_TINT, imageKey, type LoadedSprites } from './sprites';
import { canvasFont, PALETTE } from './ui/tokens';

export const TILE = 48;

/** Base colour and a darker / lighter shade per terrain, for the procedural tiles. */
const TERRAIN_COLOURS: Record<string, [string, string, string]> = {
  plain: ['#78a85a', '#5f8d45', '#93c46f'],
  road: ['#c9b07f', '#a88e5e', '#dcc79c'],
  forest: ['#4f8a45', '#2f5f2c', '#6aa55a'],
  hill: ['#a3925c', '#7a6a3e', '#c2b07a'],
  village: ['#78a85a', '#5f8d45', '#93c46f'],
  fort: ['#8f8f9c', '#5d5d69', '#b3b3bf'],
  gate: ['#a8925c', '#6e5a32', '#c9b17c'],
  river: ['#3f78b5', '#2a5a92', '#6fa3d8'],
  wall: ['#55555f', '#33333b', '#77777f'],
};

const CLASS_GLYPH: Record<string, string> = {
  lord: 'L', mercenary: 'M', myrmidon: 'S', soldier: 'P', knight: 'K', cavalier: 'C', fighter: 'F', brigand: 'B', archer: 'A', mage: 'm',
};

export interface RenderOptions {
  sprites: LoadedSprites | null;
  frame: Frame;
  /** Cursor position in tiles, eased by the caller. */
  cursor: { x: number; y: number };
  grid: boolean;
  timeMs: number;
  /** An animation is playing: no range highlights or path preview. */
  animating: boolean;
}

/** Deterministic per-tile noise in [0, 1). */
function noise(x: number, y: number, k: number): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function triangle(ctx: CanvasRenderingContext2D, cx: number, top: number, half: number, height: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx - half, top + height);
  ctx.lineTo(cx + half, top + height);
  ctx.closePath();
  ctx.fill();
}

function drawTile(ctx: CanvasRenderingContext2D, id: string, tx: number, ty: number): void {
  const [base, dark, light] = TERRAIN_COLOURS[id] ?? ['#777', '#555', '#999'];
  const x = tx * TILE;
  const y = ty * TILE;
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  ctx.fillStyle = base;
  ctx.fillRect(x, y, TILE, TILE);
  // Speckles so flat terrain does not look like a flat fill.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? dark : light;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x + Math.floor(noise(tx, ty, i) * (TILE - 4)), y + Math.floor(noise(tx, ty, i + 9) * (TILE - 4)), 3, 2);
  }
  ctx.globalAlpha = 1;
  switch (id) {
    case 'plain':
    case 'village':
      ctx.fillStyle = dark;
      for (let i = 0; i < 3; i++) {
        const gx = x + 6 + Math.floor(noise(tx, ty, 20 + i) * (TILE - 12));
        const gy = y + 8 + Math.floor(noise(tx, ty, 30 + i) * (TILE - 14));
        ctx.fillRect(gx, gy, 2, 4);
        ctx.fillRect(gx + 3, gy + 1, 2, 3);
      }
      if (id === 'village') {
        ctx.fillStyle = '#d9a46c';
        ctx.fillRect(cx - 11, cy - 1, 22, 15);
        ctx.fillStyle = '#5b3a22';
        ctx.fillRect(cx - 3, cy + 6, 6, 8);
        ctx.fillStyle = '#9c3d2e';
        triangle(ctx, cx, cy - 15, 15, 14);
      }
      break;
    case 'road':
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, TILE, 2);
      ctx.fillRect(x, y + TILE - 2, TILE, 2);
      break;
    case 'forest':
      for (const [dx, dy] of [[-11, 2], [10, 5], [0, -8]] as const) {
        ctx.fillStyle = '#5b3a22';
        ctx.fillRect(cx + dx - 1, cy + dy + 6, 3, 5);
        ctx.fillStyle = '#244f24';
        triangle(ctx, cx + dx, cy + dy - 9, 9, 16);
        ctx.fillStyle = '#3c7a37';
        triangle(ctx, cx + dx, cy + dy - 9, 5, 10);
      }
      break;
    case 'hill':
      ctx.fillStyle = dark;
      triangle(ctx, cx - 4, y + 10, 18, TILE - 16);
      ctx.fillStyle = light;
      triangle(ctx, cx - 4, y + 10, 7, 12);
      ctx.fillStyle = dark;
      triangle(ctx, cx + 12, y + 22, 9, TILE - 28);
      break;
    case 'fort':
    case 'gate':
      ctx.fillStyle = dark;
      ctx.fillRect(x + 6, y + 10, TILE - 12, TILE - 16);
      ctx.fillStyle = light;
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * 10, y + 5, 6, 6);
      ctx.fillStyle = id === 'gate' ? '#5b4426' : '#2e2e38';
      ctx.fillRect(cx - 6, cy, 12, TILE / 2 - 6);
      break;
    case 'river':
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, TILE, 3);
      ctx.fillRect(x, y + TILE - 3, TILE, 3);
      break;
    case 'wall':
      ctx.fillStyle = dark;
      for (let row = 0; row < 4; row++) {
        ctx.fillRect(x, y + row * 12 + 11, TILE, 2);
        const off = row % 2 ? 12 : 0;
        for (let col = 0; col < 3; col++) ctx.fillRect(x + off + col * 24, y + row * 12, 2, 12);
      }
      break;
    default:
      break;
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, grid: Grid, sprites: LoadedSprites | null): void {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const id = terrainAt(grid, RULES.terrains, { x, y }).id;
      const tile = sprites && tileSprite(sprites.pack, id);
      const image = tile && sprites.images.get(imageKey(tile.sheet, null));
      if (tile && image) ctx.drawImage(image, tile.sx, tile.sy, tile.sw, tile.sh, x * TILE, y * TILE, TILE, TILE);
      else drawTile(ctx, id, x, y);
    }
  }
}

let terrainCache: { key: string; canvas: HTMLCanvasElement } | null = null;

/** The static terrain layer, drawn once per map and sprite pack (straight onto `ctx` where there is no DOM). */
function paintTerrain(ctx: CanvasRenderingContext2D, grid: Grid, sprites: LoadedSprites | null): void {
  if (typeof document === 'undefined') return drawTerrain(ctx, grid, sprites);
  const key = `${grid.width}|${grid.tiles.join(',')}|${sprites ? sprites.images.size : 0}`;
  if (terrainCache?.key !== key) {
    const canvas = document.createElement('canvas');
    canvas.width = grid.width * TILE;
    canvas.height = grid.height * TILE;
    const layer = canvas.getContext('2d')!;
    layer.imageSmoothingEnabled = false;
    drawTerrain(layer, grid, sprites);
    terrainCache = { key, canvas };
  }
  ctx.drawImage(terrainCache.canvas, 0, 0);
}

/** Moving glints on placeholder water. */
function drawWater(ctx: CanvasRenderingContext2D, grid: Grid, sprites: LoadedSprites | null, timeMs: number): void {
  if (sprites && tileSprite(sprites.pack, 'river')) return;
  ctx.strokeStyle = 'rgba(190, 225, 255, 0.55)';
  ctx.lineWidth = 2;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (terrainAt(grid, RULES.terrains, { x, y }).id !== 'river') continue;
      for (let i = 0; i < 2; i++) {
        const phase = (timeMs / 900 + noise(x, y, i) + i * 0.5) % 1;
        const wy = y * TILE + 12 + i * 18 + Math.sin(phase * Math.PI * 2) * 2;
        const wx = x * TILE + 6 + phase * 14;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 7, wy - 4, wx + 14, wy);
        ctx.stroke();
      }
    }
  }
}

function tileFill(ctx: CanvasRenderingContext2D, p: Point, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(p.x * TILE + 1, p.y * TILE + 1, TILE - 2, TILE - 2);
}

function drawToken(ctx: CanvasRenderingContext2D, u: Unit, cx: number, cy: number, done: boolean): void {
  const [light, dark] = done ? [PALETTE.done, PALETTE.doneDark] : u.faction === 'player' ? [PALETTE.player, PALETTE.playerDark] : [PALETTE.enemy, PALETTE.enemyDark];
  const r = 16;
  ctx.beginPath();
  if (u.faction === 'player') ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else ctx.roundRect(cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2, 6);
  const gradient = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = u.boss ? '#1b0b0b' : PALETTE.ink;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = u.lord ? PALETTE.cursor : u.boss ? '#c06bff' : 'rgba(255,255,255,0.55)';
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = canvasFont(22, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CLASS_GLYPH[u.classId] ?? '?', cx, cy + 1);
  if (u.lord) {
    // Crown
    ctx.fillStyle = PALETTE.cursor;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - r + 1);
    ctx.lineTo(cx - 8, cy - r - 7);
    ctx.lineTo(cx - 4, cy - r - 3);
    ctx.lineTo(cx, cy - r - 9);
    ctx.lineTo(cx + 4, cy - r - 3);
    ctx.lineTo(cx + 8, cy - r - 7);
    ctx.lineTo(cx + 8, cy - r + 1);
    ctx.closePath();
    ctx.fill();
  }
  if (u.boss) {
    ctx.fillStyle = '#c06bff';
    ctx.font = canvasFont(11, true);
    ctx.fillText('★', cx + r - 2, cy - r + 2);
  }
}

/** Draws a sprite cell scaled by the pack's tile size, centred and standing on the tile's bottom edge. */
function drawUnitSprite(ctx: CanvasRenderingContext2D, sprites: LoadedSprites, u: Unit, px: number, py: number, motion: 'idle' | 'moving', done: boolean, timeMs: number): boolean {
  const frame = unitSprite(sprites.pack, u, motion, timeMs);
  const image = frame && sprites.images.get(imageKey(frame.sheet, done ? DONE_TINT : frame.tint));
  if (!frame || !image) return false;
  const scale = TILE / sprites.pack.tileSize;
  const w = frame.sw * scale;
  const h = frame.sh * scale;
  ctx.drawImage(image, frame.sx, frame.sy, frame.sw, frame.sh, px + (TILE - w) / 2, py + TILE - h, w, h);
  return true;
}

function drawHpBar(ctx: CanvasRenderingContext2D, px: number, py: number, hp: number, max: number): void {
  const ratio = Math.max(0, Math.min(1, hp / max));
  const w = TILE - 12;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(px + 5, py + TILE - 8, w + 2, 6);
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(px + 6, py + TILE - 7, w, 4);
  ctx.fillStyle = ratio > 0.5 ? PALETTE.hp : ratio > 0.25 ? PALETTE.hpMid : PALETTE.hpLow;
  ctx.fillRect(px + 6, py + TILE - 7, Math.round(w * ratio), 4);
}

function drawUnit(ctx: CanvasRenderingContext2D, c: Controller, view: UnitView, o: RenderOptions): void {
  if (view.alpha <= 0) return;
  const u = c.unit(view.id);
  const index = c.state.units.indexOf(u);
  const done = u.faction === c.state.phase && u.acted;
  const commanded = 'unitId' in c.mode && c.mode.unitId === u.id;
  const bob = done ? 0 : Math.round(Math.sin(o.timeMs / (commanded ? 140 : 420) + index * 1.7) * (commanded ? 2 : 1));
  const px = (view.x + view.dx) * TILE;
  const py = (view.y + view.dy) * TILE;
  ctx.save();
  ctx.globalAlpha = view.alpha;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 10, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const moving = commanded || view.dx !== 0 || view.x % 1 !== 0 || view.y % 1 !== 0;
  if (!o.sprites || !drawUnitSprite(ctx, o.sprites, u, px, py + bob, moving ? 'moving' : 'idle', done, o.timeMs)) {
    drawToken(ctx, u, px + TILE / 2, py + TILE / 2 - 4 + bob, done);
  }
  if (view.flash > 0) {
    ctx.globalAlpha = view.alpha * view.flash * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2 - 4, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = view.alpha;
  }
  drawHpBar(ctx, px, py, view.hp, u.stats.hp);
  ctx.restore();
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string): void {
  ctx.lineWidth = 4;
  ctx.strokeStyle = PALETTE.ink;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawText(ctx: CanvasRenderingContext2D, text: FloatText): void {
  const x = text.x * TILE + TILE / 2;
  const y = text.y * TILE + 6 - text.age * 26;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - text.age * text.age);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  switch (text.kind) {
    case 'damage':
      ctx.font = canvasFont(22, true);
      outlinedText(ctx, String(text.value), x, y, PALETTE.text);
      break;
    case 'crit':
      ctx.font = canvasFont(33, true);
      outlinedText(ctx, String(text.value), x, y, PALETTE.cursor);
      ctx.font = canvasFont(16, true);
      outlinedText(ctx, t('float.crit'), x, y - 22, PALETTE.danger);
      break;
    case 'miss':
      ctx.font = canvasFont(22, true);
      outlinedText(ctx, t('float.miss'), x, y, PALETTE.textDim);
      break;
    case 'levelUp':
      ctx.font = canvasFont(22, true);
      outlinedText(ctx, t('float.levelUp', { level: text.value }), x, y - 10, PALETTE.good);
      break;
    case 'exp':
      ctx.font = canvasFont(16, true);
      outlinedText(ctx, t('float.exp', { amount: text.value }), x, y + 4, PALETTE.xp);
      break;
  }
  ctx.restore();
}

function drawBanner(ctx: CanvasRenderingContext2D, banner: NonNullable<Frame['banner']>): void {
  const { width, height } = ctx.canvas;
  const p = banner.progress;
  const slide = p < 0.18 ? 1 - p / 0.18 : p > 0.82 ? -(p - 0.82) / 0.18 : 0;
  const ease = Math.sign(slide) * slide * slide;
  const bandH = 76;
  const y = height / 2 - bandH / 2;
  const colour = banner.phase === 'player' ? PALETTE.player : PALETTE.enemy;
  ctx.save();
  ctx.globalAlpha = 1 - Math.abs(ease) * 0.6;
  ctx.fillStyle = 'rgba(5, 6, 13, 0.78)';
  ctx.fillRect(0, y, width, bandH);
  ctx.fillStyle = colour;
  ctx.fillRect(0, y, width, 4);
  ctx.fillRect(0, y + bandH - 4, width, 4);
  ctx.translate(ease * width, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = canvasFont(33, true);
  outlinedText(ctx, t(`phase.${banner.phase}`), width / 2, y + bandH / 2 - 8, PALETTE.text);
  ctx.font = canvasFont(16);
  outlinedText(ctx, t('hud.turn', { n: banner.turn }), width / 2, y + bandH / 2 + 22, PALETTE.textDim);
  ctx.restore();
}

function drawCursor(ctx: CanvasRenderingContext2D, cursor: { x: number; y: number }, timeMs: number): void {
  const pulse = Math.round((Math.sin(timeMs / 160) + 1) * 1.5);
  const x = cursor.x * TILE - pulse;
  const y = cursor.y * TILE - pulse;
  const s = TILE + pulse * 2;
  const arm = 12;
  ctx.save();
  for (const [colour, width] of [[PALETTE.ink, 6], [PALETTE.cursor, 3]] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + s, y, -1, 1], [x, y + s, 1, -1], [x + s, y + s, -1, -1]] as const) {
      ctx.moveTo(cx, cy + sy * arm);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * arm, cy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPath(ctx: CanvasRenderingContext2D, path: Point[]): void {
  if (path.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [colour, width] of [['rgba(5, 6, 13, 0.6)', 10], ['rgba(255, 244, 200, 0.95)', 5]] as const) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2) : ctx.lineTo(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2)));
    ctx.stroke();
  }
  const end = path.at(-1)!;
  ctx.fillStyle = 'rgba(255, 244, 200, 0.95)';
  ctx.beginPath();
  ctx.arc(end.x * TILE + TILE / 2, end.y * TILE + TILE / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Renders one frame of the battle; with a sprite pack, mapped units and terrain use it and the rest keep the procedural art. */
export function render(ctx: CanvasRenderingContext2D, c: Controller, o: RenderOptions): void {
  const { grid } = c.state;
  ctx.save();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.translate(Math.round(o.frame.shake.x), Math.round(o.frame.shake.y));
  ctx.imageSmoothingEnabled = false;
  paintTerrain(ctx, grid, o.sprites);
  drawWater(ctx, grid, o.sprites, o.timeMs);

  const objective = c.state.objective;
  if (objective.type === 'seize') {
    ctx.strokeStyle = PALETTE.cursor;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -o.timeMs / 60;
    ctx.strokeRect(objective.tile.x * TILE + 4, objective.tile.y * TILE + 4, TILE - 8, TILE - 8);
    ctx.setLineDash([]);
  }

  if (!o.animating) {
    const pulse = 0.38 + Math.sin(o.timeMs / 300) * 0.06;
    const { move, attack } = c.highlights();
    for (const p of move) tileFill(ctx, p, `rgba(80, 140, 255, ${pulse})`);
    for (const p of attack) tileFill(ctx, p, `rgba(240, 70, 60, ${pulse})`);
    if (c.mode.kind === 'target') for (const id of c.mode.targetIds) tileFill(ctx, c.unit(id).pos, `rgba(240, 70, 60, ${pulse + 0.2})`);
    if (c.mode.kind === 'selected') {
      const unit = c.unit(c.mode.unitId);
      if (move.some((p) => pointKey(p) === pointKey(c.cursor))) drawPath(ctx, pathTo(worldOf(RULES, c.state), unit, c.cursor));
    }
  }

  if (o.grid) {
    ctx.strokeStyle = 'rgba(5, 6, 13, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= grid.width; x++) {
      ctx.moveTo(x * TILE + 0.5, 0);
      ctx.lineTo(x * TILE + 0.5, grid.height * TILE);
    }
    for (let y = 0; y <= grid.height; y++) {
      ctx.moveTo(0, y * TILE + 0.5);
      ctx.lineTo(grid.width * TILE, y * TILE + 0.5);
    }
    ctx.stroke();
  }

  [...o.frame.units].sort((a, b) => a.y - b.y).forEach((view) => drawUnit(ctx, c, view, o));
  if (c.mode.kind !== 'enemy' && c.mode.kind !== 'over') drawCursor(ctx, o.cursor, o.timeMs);
  for (const text of o.frame.texts) drawText(ctx, text);
  ctx.restore();
  if (o.frame.banner) drawBanner(ctx, o.frame.banner);
}

export function tileFromEvent(canvas: HTMLCanvasElement, event: MouseEvent): Point {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  return { x: Math.floor(((event.clientX - rect.left) * scale) / TILE), y: Math.floor(((event.clientY - rect.top) * scale) / TILE) };
}
