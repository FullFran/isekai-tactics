import { describe, expect, it } from 'vitest';
import { runEnemyPhase } from '../../src/core/ai';
import { applyAction, createBattle } from '../../src/core/battle';
import { buildBattleSetup, validateChapter, type ChapterDef } from '../../src/core/chapter';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';
import { RULES } from '../../src/data/rules';

const raw = () => structuredClone(CHAPTERS[SAMPLE_CHAPTER_ID]) as Record<string, any>;

function errorsOf(mutate: (c: Record<string, any>) => void): string[] {
  const c = raw();
  mutate(c);
  const result = validateChapter(c, RULES);
  return result.ok ? [] : result.errors;
}

function sample(): ChapterDef {
  const result = validateChapter(raw(), RULES);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.chapter;
}

describe('validateChapter', () => {
  it('accepts the sample chapter', () => {
    expect(errorsOf(() => {})).toEqual([]);
  });

  it('rejects non-objects and missing sections', () => {
    expect(validateChapter(null, RULES).ok).toBe(false);
    expect(errorsOf((c) => delete c.map).join()).toMatch(/map/);
    expect(errorsOf((c) => delete c.routes.hard).join()).toMatch(/routes\.hard/);
  });

  it('reports map problems', () => {
    expect(errorsOf((c) => (c.map.rows[2] = '...')).join()).toMatch(/map\.rows\[2\].*length/);
    expect(errorsOf((c) => (c.map.rows[0] = 'X' + c.map.rows[0].slice(1))).join()).toMatch(/"X"/);
    expect(errorsOf((c) => (c.map.legend['.'] = 'lava')).join()).toMatch(/lava/);
  });

  it('reports unit problems with a path', () => {
    expect(errorsOf((c) => (c.unitGroups.main[0].class = 'dragon')).join()).toMatch(/unitGroups\.main\[0\]\.class.*dragon/);
    expect(errorsOf((c) => (c.unitGroups.main[0].weapon = 'fire')).join()).toMatch(/cannot wield/);
    expect(errorsOf((c) => (c.unitGroups.main[0].at = [40, 0])).join()).toMatch(/outside the map/);
    expect(errorsOf((c) => (c.unitGroups.main[0].at = [10, 0])).join()).toMatch(/impassable/);
    expect(errorsOf((c) => (c.unitGroups.main[1].at = c.unitGroups.main[0].at)).join()).toMatch(/shares a tile/);
    expect(errorsOf((c) => (c.unitGroups.main[0].ai = 'berserk')).join()).toMatch(/ai/);
    expect(errorsOf((c) => (c.unitGroups.main[1].id = c.unitGroups.main[0].id)).join()).toMatch(/duplicate unit id/);
    expect(errorsOf((c) => (c.party[0].lord = false)).join()).toMatch(/exactly one lord/);
  });

  it('reports objective and route problems', () => {
    expect(errorsOf((c) => (c.objective = { type: 'seize', tile: [99, 99] })).join()).toMatch(/objective\.tile/);
    expect(errorsOf((c) => (c.objective = { type: 'escape' })).join()).toMatch(/objective\.type/);
    expect(errorsOf((c) => (c.routes.easy.deploySlots = 9)).join()).toMatch(/deploySlots/);
    expect(errorsOf((c) => c.routes.hard.unitGroups.push('ghosts')).join()).toMatch(/ghosts/);
  });
});

describe('buildBattleSetup', () => {
  it('deploys the first party members up to the route deploy slots, lord first', () => {
    const easy = buildBattleSetup(sample(), 'easy', RULES, 1);
    const hard = buildBattleSetup(sample(), 'hard', RULES, 1);
    const players = (s: typeof easy) => s.units.filter((u) => u.faction === 'player').map((u) => u.id);
    expect(players(easy)).toEqual(['aren', 'lio', 'mira', 'tobe']);
    expect(players(hard)).toEqual(['aren', 'lio', 'mira']);
    expect(easy.units[0]).toMatchObject({ id: 'aren', lord: true, pos: { x: 2, y: 9 }, stats: { str: 6 } });
  });

  it('switching route changes enemy levels, stats, count and AI bias per config', () => {
    const easy = buildBattleSetup(sample(), 'easy', RULES, 1);
    const hard = buildBattleSetup(sample(), 'hard', RULES, 1);
    const enemy = (s: typeof easy, id: string) => s.units.find((u) => u.id === id)!;
    expect(enemy(hard, 'axeman').level).toBe(enemy(easy, 'axeman').level + 1);
    expect(enemy(hard, 'axeman').stats.hp).toBeGreaterThan(enemy(easy, 'axeman').stats.hp);
    expect(easy.units.filter((u) => u.faction === 'enemy')).toHaveLength(6);
    expect(hard.units.filter((u) => u.faction === 'enemy')).toHaveLength(7);
    expect(easy.config?.ai.offenseBias).toBe(0.5);
    expect(hard.config?.ai.offenseBias).toBe(3);
  });

  it('derives unit stats from class bases plus fixed growth per level', () => {
    const setup = buildBattleSetup(sample(), 'easy', RULES, 1);
    const warden = setup.units.find((u) => u.id === 'warden')!;
    const knight = RULES.classes.knight!;
    expect(warden.stats.hp).toBe(knight.bases.hp + Math.floor(((warden.level - 1) * knight.growths.hp) / 100));
    expect(warden).toMatchObject({ level: 3, boss: true, ai: 'guard', hp: warden.stats.hp, faction: 'enemy' });
  });

  it('the sample chapter plays deterministically from a seed', () => {
    const run = (seed: number) => {
      let s = createBattle(buildBattleSetup(sample(), 'hard', RULES, seed));
      for (let i = 0; i < 4 && s.outcome === 'ongoing'; i++) s = runEnemyPhase(RULES, applyAction(RULES, s, { type: 'endPhase' }));
      return s;
    };
    expect(run(77)).toEqual(run(77));
    expect(run(77).turn).toBeGreaterThan(1);
  });
});
