import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('layering', () => {
  for (const layer of ['src/core', 'src/data']) {
    it(`${layer} imports nothing from adapters, app or i18n`, () => {
      const offenders = sourceFiles(layer).filter((file) =>
        /from '(\.\.\/)+(adapters|app|i18n)/.test(readFileSync(file, 'utf8')),
      );
      expect(offenders).toEqual([]);
    });
  }
});
