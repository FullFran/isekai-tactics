import { describe, expect, it, vi } from 'vitest';
import { render, type RenderOptions } from '../../src/adapters/canvas';
import { imageKey, loadSpritePack, type LoaderDeps, type LoadedSprites } from '../../src/adapters/sprites';
import { Controller } from '../../src/app/controller';
import { baseViews, frameAt } from '../../src/app/presenter';
import { validateSpritePack } from '../../src/core/spritePack';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';

const manifest = {
  version: 1,
  classes: { lord: { sheet: 'lord.png', frameWidth: 16, frameHeight: 16, idle: { row: 0, frames: 1, frameMs: 100 } } },
  terrain: { plain: { sheet: 'tiles.png', col: 0, row: 0 }, forest: { sheet: 'missing.png', col: 1, row: 0 } },
};

function response(body: string, status = 200, type = 'application/json'): Response {
  return new Response(body, { status, headers: { 'content-type': type } });
}

function deps(fetchImpl: () => Promise<Response>): LoaderDeps & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    loadImage: async (url) => {
      if (url.endsWith('missing.png')) throw new Error('404');
      return { url } as unknown as CanvasImageSource;
    },
    tint: (image, colour) => ({ ...(image as object), colour }) as unknown as CanvasImageSource,
    warn: (m) => warnings.push(m),
  };
}

describe('loadSpritePack', () => {
  const url = 'http://localhost/assets-local/pack.json';

  it('returns null silently when there is no pack', async () => {
    for (const make of [() => Promise.resolve(response('', 404)), () => Promise.reject(new Error('offline')), () => Promise.resolve(response('<!doctype html>', 200, 'text/html'))]) {
      const d = deps(make);
      expect(await loadSpritePack(url, d)).toBeNull();
      expect(d.warnings).toEqual([]);
    }
  });

  it('warns and returns null for an invalid manifest', async () => {
    const d = deps(() => Promise.resolve(response(JSON.stringify({ version: 9 }))));
    expect(await loadSpritePack(url, d)).toBeNull();
    expect(d.warnings.join('\n')).toMatch(/version/);
  });

  it('loads sheets relative to the manifest, tints variants and skips sheets that fail', async () => {
    const d = deps(() => Promise.resolve(response(JSON.stringify(manifest))));
    const loaded = await loadSpritePack(url, d);
    const lord = 'http://localhost/assets-local/lord.png';
    expect(loaded?.images.get(imageKey(lord, null))).toEqual({ url: lord });
    expect(loaded?.images.get(imageKey(lord, '#e04848'))).toMatchObject({ colour: '#e04848' });
    expect(loaded?.images.has(imageKey('http://localhost/assets-local/missing.png', null))).toBe(false);
    expect(d.warnings.join('\n')).toMatch(/missing\.png/);
  });

  describe('with a default pack and a local pack', () => {
    const defaultUrl = 'http://localhost/sprites/dawnlike/pack.json';
    const defaultPack = {
      version: 1,
      classes: { lord: { sheet: 'units.png', frameWidth: 16, frameHeight: 16, idle: { row: 0, frames: 1, frameMs: 100 } }, mage: { sheet: 'units.png', frameWidth: 16, frameHeight: 16, idle: { row: 1, frames: 1, frameMs: 100 } } },
      terrain: { plain: { sheet: 'terrain.png', col: 0, row: 0 }, river: { sheet: 'terrain.png', col: 7, row: 0 } },
    };
    const serve = (packs: Record<string, unknown>) => (input: unknown) => {
      const body = packs[String(input)];
      return Promise.resolve(body === undefined ? response('<!doctype html>', 200, 'text/html') : response(JSON.stringify(body)));
    };

    it('merges the local pack over the default one per item, each sheet relative to its own manifest', async () => {
      const d = deps(serve({ [defaultUrl]: defaultPack, [url]: manifest }) as never);
      const loaded = await loadSpritePack([defaultUrl, url], d);
      expect(loaded?.pack.classes.lord?.sheet).toBe('http://localhost/assets-local/lord.png');
      expect(loaded?.pack.classes.mage?.sheet).toBe('http://localhost/sprites/dawnlike/units.png');
      expect(loaded?.pack.terrain.plain?.sheet).toBe('http://localhost/assets-local/tiles.png');
      expect(loaded?.pack.terrain.river?.sheet).toBe('http://localhost/sprites/dawnlike/terrain.png');
      expect(loaded?.images.get(imageKey('http://localhost/sprites/dawnlike/units.png', null))).toEqual({ url: 'http://localhost/sprites/dawnlike/units.png' });
    });

    it('uses the default pack alone, silently, when there is no local pack', async () => {
      const d = deps(serve({ [defaultUrl]: defaultPack }) as never);
      const loaded = await loadSpritePack([defaultUrl, url], d);
      expect(loaded?.pack.classes.lord?.sheet).toBe('http://localhost/sprites/dawnlike/units.png');
      expect(d.warnings).toEqual([]);
    });

    it('skips an invalid pack with a warning and keeps the valid one', async () => {
      const d = deps(serve({ [defaultUrl]: defaultPack, [url]: { version: 9 } }) as never);
      const loaded = await loadSpritePack([defaultUrl, url], d);
      expect(loaded?.pack.classes.lord?.sheet).toBe('http://localhost/sprites/dawnlike/units.png');
      expect(d.warnings.join('\n')).toMatch(/assets-local.*version/s);
    });

    it('returns null when neither pack exists', async () => {
      const d = deps(serve({}) as never);
      expect(await loadSpritePack([defaultUrl, url], d)).toBeNull();
    });
  });
});

function recordingContext() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop === 'canvas') return { width: 1000, height: 1000 };
      if (prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop in target) return target[prop];
      return (...args: unknown[]) => calls.push({ method: String(prop), args });
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('render with a sprite pack', () => {
  const controller = () => new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', 1);
  const options = (c: Controller, sprites: LoadedSprites | null): RenderOptions => ({
    sprites,
    frame: frameAt(baseViews(c.state, (id) => c.unit(id).pos), [], 0),
    cursor: c.cursor,
    grid: true,
    timeMs: 0,
    animating: false,
  });

  it('draws only placeholder shapes without a pack', () => {
    const { ctx, calls } = recordingContext();
    const c = controller();
    render(ctx, c, options(c, null));
    expect(calls.filter((c) => c.method === 'drawImage')).toEqual([]);
    expect(calls.filter((c) => c.method === 'arc')).toHaveLength(4);
  });

  it('draws mapped classes and terrain from the pack and falls back per item', () => {
    const result = validateSpritePack(manifest);
    if (!result.ok) throw new Error(result.errors.join());
    const lord = { name: 'lord' };
    const tiles = { name: 'tiles' };
    const sprites: LoadedSprites = { pack: result.pack, images: new Map<string, CanvasImageSource>([[imageKey('lord.png', null), lord as never], [imageKey('tiles.png', null), tiles as never]]) };
    const c = controller();
    const { ctx, calls } = recordingContext();
    render(ctx, c, options(c, sprites));
    const drawn = calls.filter((x) => x.method === 'drawImage').map((x) => x.args[0]);
    const plains = c.state.grid.tiles.filter((t) => t === 'plain').length;
    expect(drawn.filter((img) => img === tiles)).toHaveLength(plains);
    expect(drawn.filter((img) => img === lord)).toHaveLength(1);
    // Three non-lord party members keep the circle placeholder; forest has no loaded sheet and keeps its colour.
    expect(calls.filter((x) => x.method === 'arc')).toHaveLength(3);
  });
});
