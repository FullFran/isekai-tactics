import { describe, expect, it } from 'vitest';
import { validateContent, validateRules } from '../../src/core/content';
import type { Rules } from '../../src/core/unit';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../../src/data/chapters';
import { RULES } from '../../src/data/rules';
import { catalog } from '../../src/i18n';

const rules = (): Rules => JSON.parse(JSON.stringify(RULES)) as Rules;
const sample = () => structuredClone(CHAPTERS[SAMPLE_CHAPTER_ID]) as Record<string, any>;
const messages = { es: catalog('es'), en: catalog('en') };

describe('validateRules', () => {
  it('accepts the shipped rule tables', () => {
    expect(validateRules(RULES)).toEqual([]);
  });

  it('reports rule-table problems with a path', () => {
    const r = rules() as any;
    r.classes.knight.id = 'paladin';
    r.classes.mage.weaponTypes = ['staff'];
    delete r.classes.archer.bases.spd;
    r.weapons.javelin.minRange = 3;
    r.weapons.ironBow.effectiveAgainst = ['dragon'];
    r.terrains.forest.moveCost = { foot: 2 };
    const errors = validateRules(r).join('\n');
    expect(errors).toMatch(/rules\.classes\.knight\.id: .*"paladin"/);
    expect(errors).toMatch(/rules\.classes\.mage\.weaponTypes.*staff/);
    expect(errors).toMatch(/rules\.classes\.archer\.bases\.spd/);
    expect(errors).toMatch(/rules\.weapons\.javelin.*range/);
    expect(errors).toMatch(/rules\.weapons\.ironBow\.effectiveAgainst.*dragon/);
    expect(errors).toMatch(/rules\.terrains\.forest\.moveCost\.armor/);
  });
});

describe('validateContent', () => {
  const file = 'src/data/chapters/sample.json';

  it('accepts the shipped content', () => {
    expect(validateContent({ rules: RULES, chapters: [{ path: file, raw: sample() }], registeredIds: [SAMPLE_CHAPTER_ID], messages })).toEqual([]);
  });

  it('prefixes chapter errors with the file path', () => {
    const c = sample();
    c.unitGroups.main[0].class = 'dragon';
    const errors = validateContent({ rules: RULES, chapters: [{ path: file, raw: c }], registeredIds: [SAMPLE_CHAPTER_ID], messages });
    expect(errors).toContain(`${file}: unitGroups.main[0].class: unknown class "dragon"`);
  });

  it('reports duplicate ids, unregistered chapters and missing title languages', () => {
    const c = sample();
    delete c.title.en;
    const errors = validateContent({
      rules: RULES,
      chapters: [{ path: 'a.json', raw: c }, { path: 'b.json', raw: sample() }],
      registeredIds: [],
      messages,
    }).join('\n');
    expect(errors).toMatch(/b\.json: id: duplicate chapter id "sample-01" \(also in a\.json\)/);
    expect(errors).toMatch(/a\.json: id: "sample-01" is not registered/);
    expect(errors).toMatch(/a\.json: title: missing language "en"/);
  });

  it('reports rules ids without UI strings', () => {
    const r = rules() as any;
    r.classes.paladin = { ...r.classes.cavalier, id: 'paladin' };
    const errors = validateContent({ rules: r, chapters: [], registeredIds: [], messages }).join('\n');
    expect(errors).toMatch(/i18n\.es: missing "class\.paladin"/);
    expect(errors).toMatch(/i18n\.en: missing "class\.paladin"/);
  });
});
