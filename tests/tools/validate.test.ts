import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS_DIR, validateProject } from '../../tools/validate-project';

const sampleJson = () => JSON.parse(readFileSync(join(CHAPTERS_DIR, 'sample.json'), 'utf8')) as Record<string, any>;

function tempChapters(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'isekai-chapters-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe('validateProject', () => {
  it('passes on the repository content', () => {
    const report = validateProject();
    expect(report.errors).toEqual([]);
    expect(report.chapterCount).toBeGreaterThan(0);
  });

  it('reads every JSON file in the chapters folder and locates errors by file and path', () => {
    const broken = sampleJson();
    broken.party[0].weapon = 'fire';
    const dir = tempChapters({ 'broken.json': JSON.stringify(broken), 'notes.txt': 'ignored' });
    const { errors } = validateProject({ chaptersDir: dir, registeredIds: ['sample-01'] });
    expect(errors).toEqual([`${join(dir, 'broken.json')}: party[0].weapon: lord cannot wield anima ("fire")`]);
  });

  it('reports malformed JSON with its file', () => {
    const dir = tempChapters({ 'bad.json': '{ "id": ' });
    const { errors } = validateProject({ chaptersDir: dir, registeredIds: [] });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/bad\.json: invalid JSON/);
  });
});

describe('npm run validate', () => {
  const run = (env: Record<string, string> = {}) =>
    spawnSync('npx', ['vite-node', 'tools/validate.ts'], { encoding: 'utf8', env: { ...process.env, ...env } });

  it('exits 0 and reports a summary on clean content', () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/content ok/);
  }, 30_000);

  it('exits non-zero and prints located errors on a broken chapter', () => {
    const dir = tempChapters({ 'sample.json': readFileSync(join(CHAPTERS_DIR, 'sample.json'), 'utf8').replace('"class": "knight"', '"class": "dragon"') });
    const result = run({ VALIDATE_CHAPTERS_DIR: dir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${join(dir, 'sample.json')}: unitGroups.main[5].class: unknown class "dragon"`);
  }, 30_000);
});
