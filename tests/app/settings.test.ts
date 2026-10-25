import { describe, expect, it } from 'vitest';
import { animationScale, defaultSettings, loadSettings, saveSettings, type KeyValueStore } from '../../src/app/settings';

const memory = (initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, get: (k) => data[k] ?? null, set: (k, v) => void (data[k] = v) };
};

describe('settings', () => {
  it('starts from the defaults when nothing (or garbage) is stored', () => {
    expect(loadSettings(memory(), 'en')).toEqual(defaultSettings('en'));
    expect(loadSettings(memory({ 'isekai-tactics.settings': '{not json' }), 'es')).toEqual(defaultSettings('es'));
  });

  it('round-trips through the store and drops invalid fields', () => {
    const store = memory();
    saveSettings(store, { ...defaultSettings('es'), language: 'en', speed: 'fast', grid: false });
    expect(loadSettings(store, 'es')).toEqual({ language: 'en', speed: 'fast', grid: false });
    store.data['isekai-tactics.settings'] = JSON.stringify({ language: 'fr', speed: 'warp', grid: 'yes' });
    expect(loadSettings(store, 'es')).toEqual(defaultSettings('es'));
  });

  it('survives a store that throws', () => {
    const broken: KeyValueStore = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); } };
    expect(loadSettings(broken, 'es')).toEqual(defaultSettings('es'));
    expect(() => saveSettings(broken, defaultSettings('es'))).not.toThrow();
  });

  it('maps the animation speed to a time scale (0 = no animation)', () => {
    expect(animationScale('normal')).toBe(1);
    expect(animationScale('fast')).toBe(0.5);
    expect(animationScale('off')).toBe(0);
  });
});
