import es from './es.json';
import en from './en.json';

/**
 * Tiny key-value i18n. Spanish is the source language: every key must exist
 * in `es`, and other languages are checked against it by a test.
 */
export type Language = 'es' | 'en';
export type MessageKey = keyof typeof es;

const catalogs: Record<Language, Record<string, string>> = { es, en };

export const LANGUAGES: readonly Language[] = ['es', 'en'];

let current: Language = 'es';

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

/**
 * Looks a key up in the current language, falling back to Spanish, then the key itself.
 * `{name}` placeholders are replaced from `params`.
 */
export function t(key: MessageKey | (string & {}), params: Record<string, string | number> = {}): string {
  const text = catalogs[current][key] ?? catalogs.es[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function catalog(language: Language): Readonly<Record<string, string>> {
  return catalogs[language];
}
