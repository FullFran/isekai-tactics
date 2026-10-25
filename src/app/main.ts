import { render, TILE } from '../adapters/canvas';
import { bindInput } from '../adapters/input';
import type { BattleEvent } from '../core/battle';
import { ROUTES, type Route } from '../core/chapter';
import type { CombatSide } from '../core/combat';
import { terrainAt } from '../core/grid';
import { STAT_KEYS, type Unit } from '../core/unit';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../data/chapters';
import { RULES } from '../data/rules';
import { getLanguage, setLanguage, t } from '../i18n';
import { Controller } from './controller';

const ENEMY_STEP_MS = 380;

const newSeed = () => Math.floor(Math.random() * 1_000_000);
const controller = new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', newSeed());

const root = document.getElementById('app')!;
root.textContent = '';
const canvas = document.createElement('canvas');
canvas.width = controller.state.grid.width * TILE;
canvas.height = controller.state.grid.height * TILE;
const panel = document.createElement('aside');
const overlay = document.createElement('div');
overlay.className = 'overlay';
const board = document.createElement('div');
board.className = 'board';
board.append(canvas, overlay);
root.append(board, panel);
const ctx = canvas.getContext('2d')!;

let logLines: string[] = [];
let seenEvents = 0;
let enemyTimer: number | null = null;

type Child = Node | string | null | false;
function el(tag: string, props: { class?: string; onclick?: () => void; title?: string } = {}, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.title) node.title = props.title;
  if (props.onclick) node.addEventListener('click', props.onclick);
  for (const child of children) if (child) node.append(child);
  return node;
}

const button = (label: string, onclick: () => void, cls = '') => el('button', { class: cls, onclick }, label);
const name = (id: string) => controller.unit(id).name;

function describeEvent(e: BattleEvent): string[] {
  switch (e.type) {
    case 'combat':
      return e.result.strikes.map((s) => {
        const params = { attacker: name(s.attackerId), target: name(s.targetId), damage: s.damage };
        return t(!s.hit ? 'log.miss' : s.crit ? 'log.crit' : 'log.hit', params);
      });
    case 'retreat':
      return [t('log.retreat', { name: name(e.unitId) })];
    case 'defeated':
      return [t('log.defeated', { name: name(e.unitId) })];
    case 'exp':
      return [t('log.exp', { name: name(e.unitId), amount: e.amount })];
    case 'levelUp': {
      const gains = STAT_KEYS.filter((k) => e.gains[k] > 0).map((k) => `${t(`stat.${k}`)}+${e.gains[k]}`).join(' ');
      return [t('log.levelUp', { name: name(e.unitId), level: e.level, gains })];
    }
    case 'phase':
      return [t('log.phase', { turn: e.turn, phase: t(`phase.${e.phase}`) })];
    case 'outcome':
      return [t(`screen.${e.outcome === 'victory' ? 'victory' : 'defeat'}`)];
  }
}

function collectLog(): void {
  const events = controller.state.events;
  for (; seenEvents < events.length; seenEvents++) logLines.push(...describeEvent(events[seenEvents]!));
  logLines = logLines.slice(-12);
}

function unitCard(u: Unit): HTMLElement {
  const weapon = u.weaponId ? t(`weapon.${u.weaponId}`) : t('weapon.none');
  const tags = [u.lord && t('unit.lord'), u.boss && t('unit.boss'), u.ai && t('unit.ai', { ai: t(`ai.${u.ai}`) })].filter(Boolean).join(' · ');
  const stats = el('div', { class: 'stats' }, ...STAT_KEYS.filter((k) => k !== 'hp').map((k) => el('span', {}, `${t(`stat.${k}`)} ${u.stats[k]}`)));
  return el(
    'section',
    { class: `card ${u.faction}` },
    el('h3', {}, `${u.name} — ${t(`class.${u.classId}`)}`),
    el('p', {}, `${t('unit.level', { level: u.level })} · ${t('unit.exp', { exp: u.exp })} · ${t('stat.hp')} ${u.hp}/${u.stats.hp}`),
    el('p', {}, weapon),
    tags && el('p', { class: 'dim' }, tags),
    stats,
  );
}

function forecastSide(side: CombatSide, u: Unit): HTMLElement {
  const rows = side.strikes === 0
    ? [el('p', { class: 'dim' }, t('forecast.noCounter'))]
    : [
        el('p', {}, `${t('forecast.damage')} ${side.damage}${side.strikes === 2 ? ' ×2' : ''}`),
        el('p', {}, `${t('forecast.hit')} ${side.hit} `, el('span', { class: 'dim' }, `(${t('forecast.trueHit', { value: side.trueHit.toFixed(1) })})`)),
        el('p', {}, `${t('forecast.crit')} ${side.crit}`),
      ];
  return el('div', { class: `side ${u.faction}` }, el('h4', {}, u.name), el('p', {}, `${t('forecast.hp')} ${side.hp}/${u.stats.hp}`), ...rows);
}

function renderPanel(): void {
  const c = controller;
  const s = c.state;
  const routeSelect = el('select') as HTMLSelectElement;
  for (const route of ROUTES) {
    const option = el('option', {}, t(`route.${route}`)) as HTMLOptionElement;
    option.value = route;
    option.selected = route === c.route;
    routeSelect.append(option);
  }
  routeSelect.addEventListener('change', () => restart(routeSelect.value as Route));

  const header = el(
    'section',
    { class: 'card' },
    el('h2', {}, c.chapter.title[getLanguage()] ?? c.chapter.id),
    el('p', {}, `${t('hud.turn', { n: s.turn })} · ${t(`phase.${s.phase}`)}`),
    el('p', { class: 'dim' }, t(`objective.${s.objective.type}`)),
    el('div', { class: 'row' }, el('label', {}, `${t('route.label')} `, routeSelect), el('span', { class: 'dim' }, t('hud.seed', { seed: c.seed }))),
    el(
      'div',
      { class: 'row' },
      button(t('action.endTurn'), endTurn, s.phase === 'player' && c.mode.kind !== 'over' ? '' : 'disabled'),
      button(t('action.restart'), () => restart(c.route)),
      button(t('lang.toggle'), toggleLanguage),
    ),
  );

  const sections: Child[] = [header];
  if (c.mode.kind === 'menu') {
    sections.push(
      el('section', { class: 'card' }, el('div', { class: 'row' }, ...c.menuOptions().map((o) => button(t(`action.${o}`), () => (c.choose(o), changed()))), button(t('action.cancel'), () => (c.cancel(), changed())))),
    );
  }
  const f = c.forecast();
  if (f) {
    sections.push(
      el(
        'section',
        { class: 'card forecast' },
        el('h3', {}, t('forecast.title')),
        el('div', { class: 'sides' }, forecastSide(f.attacker, c.unit(f.attacker.unitId)), forecastSide(f.defender, c.unit(f.defender.unitId))),
        el('div', { class: 'row' }, button(t('action.confirm'), () => (c.confirm(), changed())), button(t('action.cancel'), () => (c.cancel(), changed()))),
      ),
    );
  }
  const focus = c.mode.kind === 'selected' || c.mode.kind === 'menu' || c.mode.kind === 'target' ? c.unit(c.mode.unitId) : c.unitAt(c.cursor);
  if (focus) sections.push(unitCard(focus));
  const terrain = terrainAt(s.grid, RULES.terrains, c.cursor);
  sections.push(el('p', { class: 'dim' }, t('terrain.label', { name: t(`terrain.${terrain.id}`), avoid: terrain.avoid, def: terrain.def })));
  sections.push(el('section', { class: 'card log' }, el('h3', {}, t('log.title')), ...logLines.map((line) => el('p', {}, line))));
  sections.push(el('p', { class: 'dim help' }, t('help.controls')));
  panel.replaceChildren(...sections.filter((x): x is Node => x instanceof Node));

  if (s.outcome === 'ongoing') {
    overlay.hidden = true;
  } else {
    overlay.hidden = false;
    const retreated = s.units.filter((u) => u.faction === 'player' && u.status === 'retreated').length;
    const lordLost = s.units.some((u) => u.lord && u.status !== 'active');
    overlay.replaceChildren(
      el(
        'div',
        { class: `screen ${s.outcome}` },
        el('h1', {}, t(s.outcome === 'victory' ? 'screen.victory' : 'screen.defeat')),
        s.outcome === 'defeat' && lordLost && el('p', {}, t('screen.defeatLord')),
        el('p', {}, t('screen.turns', { n: s.turn })),
        el('p', {}, t('screen.retreated', { n: retreated })),
        button(t('action.restart'), () => restart(c.route)),
        el('p', { class: 'dim' }, t('screen.restartHint')),
      ),
    );
  }
}

function changed(): void {
  collectLog();
  render(ctx, controller);
  renderPanel();
  if (controller.mode.kind === 'enemy' && enemyTimer === null) {
    enemyTimer = window.setTimeout(() => {
      enemyTimer = null;
      controller.stepEnemy();
      changed();
    }, ENEMY_STEP_MS);
  }
}

function endTurn(): void {
  controller.endTurn();
  changed();
}

function restart(route: Route): void {
  if (enemyTimer !== null) window.clearTimeout(enemyTimer);
  enemyTimer = null;
  controller.restart(route, newSeed());
  logLines = [];
  seenEvents = 0;
  changed();
}

function toggleLanguage(): void {
  setLanguage(getLanguage() === 'es' ? 'en' : 'es');
  document.documentElement.lang = getLanguage();
  document.title = t('app.title');
  logLines = [];
  seenEvents = 0;
  changed();
}

bindInput(canvas, controller, { changed, endTurn, restart: () => restart(controller.route), toggleLanguage });
document.title = t('app.title');
changed();
