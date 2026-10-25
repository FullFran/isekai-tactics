// `npm run validate`: checks every chapter, the rule tables and their UI names; exits 1 on any problem.
import { RULES } from '../src/data/rules';
import { validateProject } from './validate-project';

const { errors, chapterCount } = validateProject({ chaptersDir: process.env.VALIDATE_CHAPTERS_DIR || undefined });

if (errors.length > 0) {
  for (const line of errors) console.error(line);
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}
const count = (t: object) => Object.keys(t).length;
console.log(`content ok: ${chapterCount} chapter(s), ${count(RULES.classes)} classes, ${count(RULES.weapons)} weapons, ${count(RULES.terrains)} terrains.`);
