import { LANGUAGES, type Language } from '../i18n';

export type AnimationSpeed = 'normal' | 'fast' | 'off';
export const ANIMATION_SPEEDS: readonly AnimationSpeed[] = ['normal', 'fast', 'off'];

/** Player settings remembered in this browser. */
export interface Settings {
  language: Language;
  speed: AnimationSpeed;
  /** Grid lines over the map. */
  grid: boolean;
}

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEY = 'isekai-tactics.settings';

export const defaultSettings = (language: Language): Settings => ({ language, speed: 'normal', grid: true });

export function loadSettings(store: KeyValueStore, fallbackLanguage: Language): Settings {
  const settings = defaultSettings(fallbackLanguage);
  let raw: unknown;
  try {
    raw = JSON.parse(store.get(KEY) ?? 'null');
  } catch {
    return settings;
  }
  if (!raw || typeof raw !== 'object') return settings;
  const r = raw as Record<string, unknown>;
  if (LANGUAGES.includes(r.language as Language)) settings.language = r.language as Language;
  if (ANIMATION_SPEEDS.includes(r.speed as AnimationSpeed)) settings.speed = r.speed as AnimationSpeed;
  if (typeof r.grid === 'boolean') settings.grid = r.grid;
  return settings;
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  try {
    store.set(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: the settings just do not persist.
  }
}

/** Time scale of the battle animations; 0 skips them. */
export const animationScale = (speed: AnimationSpeed): number => ({ normal: 1, fast: 0.5, off: 0 })[speed];

/** localStorage, or a no-op store where it is unavailable. */
export function browserStore(): KeyValueStore {
  return {
    get: (key) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set: (key, value) => {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // ignored, see saveSettings
      }
    },
  };
}
