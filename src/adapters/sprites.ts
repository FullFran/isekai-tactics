import { mergeSpritePacks, rebaseSheets, spriteVariants, validateSpritePack, type SpritePack } from '../core/spritePack';

/** Grey laid over units that already acted this phase. */
export const DONE_TINT = '#6b6f7a';
/** The committed default pack (openly licensed, see CREDITS.md). */
export const DEFAULT_PACK_URL = './sprites/dawnlike/pack.json';
/** The optional private pack (git-ignored, never deployed). */
export const LOCAL_PACK_URL = './assets-local/pack.json';
/** Later packs win per item. */
export const PACK_URLS: readonly string[] = [DEFAULT_PACK_URL, LOCAL_PACK_URL];

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
 * Fetches and validates one manifest, with its sheets made absolute. A missing pack
 * (404, offline, or the dev server's HTML fallback) returns null without noise.
 */
async function fetchPack(packUrl: string, deps: LoaderDeps): Promise<SpritePack | null> {
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
    deps.warn(`sprite pack: invalid JSON in ${packUrl} (${(e as Error).message}); skipping it`);
    return null;
  }
  const result = validateSpritePack(raw);
  if (!result.ok) {
    deps.warn(`sprite pack: ${packUrl} is invalid; skipping it\n${result.errors.join('\n')}`);
    return null;
  }
  const base = new URL(packUrl, globalThis.location?.href ?? packUrl);
  return rebaseSheets(result.pack, (sheet) => new URL(sheet, base).href);
}

/**
 * Loads the sprite packs in order and layers them (a later pack wins per class, unit and
 * terrain id). Returns null when none exists; anything unmapped keeps the placeholder art.
 */
export async function loadSpritePack(packUrls: string | readonly string[] = PACK_URLS, deps: LoaderDeps = browserDeps()): Promise<LoadedSprites | null> {
  const urls = typeof packUrls === 'string' ? [packUrls] : packUrls;
  const packs = (await Promise.all(urls.map((url) => fetchPack(url, deps)))).filter((p): p is SpritePack => p !== null);
  if (packs.length === 0) return null;
  const pack = mergeSpritePacks(packs);

  const variants = spriteVariants(pack, DONE_TINT);
  const sources = new Map<string, CanvasImageSource>();
  await Promise.all(
    [...new Set(variants.map((v) => v.sheet))].map(async (sheet) => {
      try {
        sources.set(sheet, await deps.loadImage(sheet));
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
  return { pack, images };
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
