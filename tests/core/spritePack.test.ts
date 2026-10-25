import { describe, expect, it } from 'vitest';
import { DEFAULT_ENEMY_TINT, frameIndex, spriteVariants, tileSprite, unitSprite, validateSpritePack, type SpritePack } from '../../src/core/spritePack';

const manifest = () => ({
  version: 1,
  tileSize: 16,
  classes: {
    lord: { sheet: 'units/lord.png', frameWidth: 16, frameHeight: 16, idle: { row: 0, frames: 3, frameMs: 200 }, moving: { row: 1, frames: 4, frameMs: 100 } },
    knight: { sheet: 'units/knight.png', frameWidth: 32, frameHeight: 32, idle: { row: 0, frames: 2, frameMs: 300 }, factions: { enemy: { sheet: 'units/knight-red.png' }, player: { tint: '#3060ff' } } },
  },
  units: { aren: { sheet: 'units/aren.png', frameWidth: 16, frameHeight: 16, idle: { row: 2, col: 1, frames: 1, frameMs: 500 } } },
  terrain: { forest: { sheet: 'tiles.png', col: 3, row: 1 } },
});

function pack(): SpritePack {
  const result = validateSpritePack(manifest());
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.pack;
}

describe('validateSpritePack', () => {
  it('accepts a full manifest and defaults missing sections', () => {
    expect(pack().classes.lord?.sheet).toBe('units/lord.png');
    const minimal = validateSpritePack({ version: 1 });
    expect(minimal).toEqual({ ok: true, pack: { version: 1, tileSize: 16, classes: {}, units: {}, terrain: {} } });
  });

  it('reports problems with a path', () => {
    const m = manifest() as any;
    m.version = 2;
    m.classes.lord.frameWidth = 0;
    m.classes.lord.idle.frames = 'three';
    m.classes.knight.factions.enemy = { tint: 'red' };
    m.classes.knight.factions.ally = { tint: '#fff' };
    m.units.aren.sheet = '../secret.png';
    m.terrain.forest.col = -1;
    const result = validateSpritePack(m);
    expect(result.ok).toBe(false);
    const errors = result.ok ? '' : result.errors.join('\n');
    expect(errors).toMatch(/^version: must be 1/m);
    expect(errors).toMatch(/classes\.lord\.frameWidth/);
    expect(errors).toMatch(/classes\.lord\.idle\.frames/);
    expect(errors).toMatch(/classes\.knight\.factions\.enemy\.tint/);
    expect(errors).toMatch(/classes\.knight\.factions\.ally/);
    expect(errors).toMatch(/units\.aren\.sheet.*relative/);
    expect(errors).toMatch(/terrain\.forest\.col/);
  });

  it('only accepts relative sheet paths inside the pack', () => {
    for (const sheet of ['/etc/x.png', 'https://example.com/a.png', 'a/../../b.png', 'C:\\x.png', '']) {
      const m = manifest() as any;
      m.terrain.forest.sheet = sheet;
      expect(validateSpritePack(m).ok, sheet).toBe(false);
    }
  });
});

describe('frameIndex', () => {
  it('loops through frames, or ping-pongs when asked', () => {
    const anim = { row: 0, frames: 3, frameMs: 100 };
    expect([0, 99, 100, 250, 300, 650].map((t) => frameIndex(anim, t))).toEqual([0, 0, 1, 2, 0, 0]);
    const pingPong = { ...anim, pingPong: true };
    expect([0, 100, 200, 300, 400].map((t) => frameIndex(pingPong, t))).toEqual([0, 1, 2, 1, 0]);
  });
});

describe('unitSprite', () => {
  it('maps the class, picks the frame from the animation and falls back to null when unmapped', () => {
    const p = pack();
    expect(unitSprite(p, { id: 'lio', classId: 'lord', faction: 'player' }, 'idle', 450)).toEqual({ sheet: 'units/lord.png', sx: 32, sy: 0, sw: 16, sh: 16, tint: null });
    expect(unitSprite(p, { id: 'lio', classId: 'lord', faction: 'player' }, 'moving', 150)).toMatchObject({ sx: 16, sy: 16 });
    expect(unitSprite(p, { id: 'x', classId: 'mage', faction: 'player' }, 'idle', 0)).toBeNull();
  });

  it('uses idle frames when no moving animation is given', () => {
    expect(unitSprite(pack(), { id: 'x', classId: 'knight', faction: 'player' }, 'moving', 0)).toMatchObject({ sy: 0, sw: 32 });
  });

  it('lets a unit id override its class', () => {
    expect(unitSprite(pack(), { id: 'aren', classId: 'lord', faction: 'player' }, 'idle', 0)).toMatchObject({ sheet: 'units/aren.png', sx: 16, sy: 32 });
  });

  it('applies faction sheets and tints, tinting enemies red by default', () => {
    const p = pack();
    expect(unitSprite(p, { id: 'w', classId: 'knight', faction: 'enemy' }, 'idle', 0)).toMatchObject({ sheet: 'units/knight-red.png', tint: null });
    expect(unitSprite(p, { id: 'k', classId: 'knight', faction: 'player' }, 'idle', 0)).toMatchObject({ sheet: 'units/knight.png', tint: '#3060ff' });
    expect(unitSprite(p, { id: 'b', classId: 'lord', faction: 'enemy' }, 'idle', 0)).toMatchObject({ sheet: 'units/lord.png', tint: DEFAULT_ENEMY_TINT });
  });
});

describe('tileSprite and spriteVariants', () => {
  it('maps terrain tiles by tile size and falls back to null', () => {
    expect(tileSprite(pack(), 'forest')).toEqual({ sheet: 'tiles.png', sx: 48, sy: 16, sw: 16, sh: 16, tint: null });
    expect(tileSprite(pack(), 'plain')).toBeNull();
  });

  it('lists every sheet and tint the renderer can ask for', () => {
    const keys = spriteVariants(pack(), '#777777').map((v) => `${v.sheet}#${v.tint ?? ''}`).sort();
    expect(keys).toEqual([
      'tiles.png#',
      'units/aren.png#', 'units/aren.png##777777', `units/aren.png#${DEFAULT_ENEMY_TINT}`,
      'units/knight-red.png#', 'units/knight-red.png##777777',
      'units/knight.png##3060ff', 'units/knight.png##777777',
      'units/lord.png#', 'units/lord.png##777777', `units/lord.png#${DEFAULT_ENEMY_TINT}`,
    ].sort());
  });
});

describe('docs/sprite-pack.example.json', () => {
  it('is a valid manifest', async () => {
    const { readFileSync } = await import('node:fs');
    const result = validateSpritePack(JSON.parse(readFileSync('docs/sprite-pack.example.json', 'utf8')));
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
