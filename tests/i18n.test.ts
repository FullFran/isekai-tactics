import { describe, expect, it } from 'vitest';
import { catalog, LANGUAGES, setLanguage, t } from '../src/i18n';

describe('i18n catalogs', () => {
  const spanishKeys = Object.keys(catalog('es'));

  for (const language of LANGUAGES) {
    it(`"${language}" defines every key that Spanish defines and no extra ones`, () => {
      const keys = Object.keys(catalog(language));
      expect(spanishKeys.filter((key) => !keys.includes(key))).toEqual([]);
      expect(keys.filter((key) => !spanishKeys.includes(key))).toEqual([]);
    });

    it(`"${language}" has no empty strings`, () => {
      const empty = Object.entries(catalog(language)).filter(([, value]) => value.trim() === '');
      expect(empty).toEqual([]);
    });
  }
});

describe('t', () => {
  it('returns the current language, falls back to the key and fills placeholders', () => {
    setLanguage('en');
    expect(t('app.loading')).toBe('Loading…');
    setLanguage('es');
    expect(t('app.loading')).toBe('Cargando…');
    expect(t('does.not.exist')).toBe('does.not.exist');
    expect(t('x {n} y', { n: 3 })).toBe('x 3 y');
  });
});

describe('content names', () => {
  it('every class, weapon and terrain of the rule tables has a name in each language', async () => {
    const { RULES } = await import('../src/data/rules');
    const keys = [
      ...Object.keys(RULES.classes).map((id) => `class.${id}`),
      ...Object.keys(RULES.weapons).map((id) => `weapon.${id}`),
      ...Object.keys(RULES.terrains).map((id) => `terrain.${id}`),
    ];
    for (const language of LANGUAGES) expect(keys.filter((key) => !(key in catalog(language)))).toEqual([]);
  });
});
