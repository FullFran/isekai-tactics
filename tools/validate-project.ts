import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '../src/core/content';
import { CHAPTERS } from '../src/data/chapters';
import { RULES } from '../src/data/rules';
import { catalog, LANGUAGES } from '../src/i18n';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CHAPTERS_DIR = join(ROOT, 'src/data/chapters');

export interface ProjectReport {
  errors: string[];
  chapterCount: number;
}

/** Reads every `*.json` in the chapters folder and validates it with the rules and UI catalogs. */
export function validateProject(options: { chaptersDir?: string; registeredIds?: readonly string[] } = {}): ProjectReport {
  const dir = options.chaptersDir ?? CHAPTERS_DIR;
  const errors: string[] = [];
  const chapters: Array<{ path: string; raw: unknown }> = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const file = join(dir, name);
    const path = file.startsWith(ROOT) ? relative(ROOT, file) : file;
    try {
      chapters.push({ path, raw: JSON.parse(readFileSync(file, 'utf8')) });
    } catch (e) {
      errors.push(`${path}: invalid JSON (${(e as Error).message})`);
    }
  }
  const messages = Object.fromEntries(LANGUAGES.map((lang) => [lang, catalog(lang)]));
  errors.push(...validateContent({ rules: RULES, chapters, registeredIds: options.registeredIds ?? Object.keys(CHAPTERS), messages }));
  return { errors, chapterCount: chapters.length };
}
