import { spriteVariants, validateSpritePack, type SpritePack } from '../core/spritePack';

/** Grey laid over units that already acted this phase. */
export const DONE_TINT = '#6b6f7a';
export const DEFAULT_PACK_URL = './assets-local/pack.json';

export interface LoadedSprites {
  pack: SpritePack;
  /** Keyed by `imageKey(sheet, tint)`; a missing key means that item falls back to placeholder art. */
  images: Map<string, CanvasImageSource>;
}

export const imageKey = (sheet: string, tint: string | null): string => (tint ? `${sheet}#${tint}` : sheet);

export interface LoaderDeps {
  fetch: typeof fetch;
  loadImage(url: string): Promise<CanvasImageSource>;
  tint(image: CanvasImageSource, colour: string): CanvasImageSource;
  warn(message: string): void;
}

/**
 * Loads a local sprite pack. No pack (404, offline, or the dev server's HTML
 * fallback) is the normal case and returns null without noise.
 */
export async function loadSpritePack(packUrl: string = DEFAULT_PACK_URL, deps: LoaderDeps = browserDeps()): Promise<LoadedSprites | null> {
  let response: Response;
  try {
    response = await deps.fetch(packUrl, { cache: 'no-store' });
  } catch {
    return null;
  }
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) return null;

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (e) {
    deps.warn(`sprite pack: invalid JSON in ${packUrl} (${(e as Error).message}); using placeholder art`);
    return null;
  }
  const result = validateSpritePack(raw);
  if (!result.ok) {
    deps.warn(`sprite pack: ${packUrl} is invalid; using placeholder art\n${result.errors.join('\n')}`);
    return null;
  }

  const base = new URL(packUrl, globalThis.location?.href ?? packUrl);
  const variants = spriteVariants(result.pack, DONE_TINT);
  const sources = new Map<string, CanvasImageSource>();
  await Promise.all(
    [...new Set(variants.map((v) => v.sheet))].map(async (sheet) => {
      try {
        sources.set(sheet, await deps.loadImage(new URL(sheet, base).href));
      } catch {
        deps.warn(`sprite pack: could not load ${sheet}; items using it keep placeholder art`);
      }
    }),
  );
  const images = new Map<string, CanvasImageSource>();
  for (const { sheet, tint } of variants) {
    const source = sources.get(sheet);
    if (source) images.set(imageKey(sheet, tint), tint ? deps.tint(source, tint) : source);
  }
  return { pack: result.pack, images };
}

function browserDeps(): LoaderDeps {
  return {
    fetch: (input, init) => fetch(input, init),
    loadImage: (url) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(url));
        image.src = url;
      }),
    tint: (image, colour) => {
      const { width, height } = image as HTMLImageElement;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = colour;
      ctx.fillRect(0, 0, width, height);
      return canvas;
    },
    warn: (message) => console.warn(message),
  };
}
