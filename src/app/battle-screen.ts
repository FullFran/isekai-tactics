import { render, TILE } from '../adapters/canvas';
import { bindBattleInput } from '../adapters/input';
import type { BattleCommand } from '../adapters/keys';
import type { LoadedSprites } from '../adapters/sprites';
import { cursorList, type CursorList } from '../adapters/ui/cursor-list';
import { h, mdWindow, statLine, type Child } from '../adapters/ui/window';
import type { BattleEvent } from '../core/battle';
import type { Route } from '../core/chapter';
import type { CombatSide } from '../core/combat';
import { terrainAt, type Point } from '../core/grid';
import { STAT_KEYS, type Unit } from '../core/unit';
import { RULES } from '../data/rules';
import { getLanguage, LANGUAGES, t } from '../i18n';
import type { Controller, MenuOption } from './controller';
import { controlsHintKey } from './hud';
import { ANIM, baseViews, durationMs, frameAt, stepsBetween, tentativeMove, type Step, type UnitView } from './presenter';
import { settingItems, type SettingsAccess } from './screens';
import { animationScale } from './settings';

export interface BattleDeps {
  root: HTMLElement;
  controller: Controller;
  settings: SettingsAccess;
  sprites(): LoadedSprites | null;
  /** Back to the title screen. */
  quit(): void;
}

interface Playing {
  base: Map<string, UnitView>;
  steps: Step[];
  start: number;
  total: number;
}

const ENEMY_PAUSE_MS = 260;

/** The battle screen: board, side windows, action menu, pause menu and result window. */
export function battleScreen(d: BattleDeps, route: Route): void {
  const c = d.controller;
  c.restart(route, Math.floor(Math.random() * 1_000_000));

  const canvas = h('canvas', { className: 'board-canvas' });
  canvas.width = c.state.grid.width * TILE;
  canvas.height = c.state.grid.height * TILE;
  const ctx = canvas.getContext('2d')!;
  const menuLayer = h('div', { className: 'menu-layer' });
  const board = h('div', { className: 'board' }, [canvas, menuLayer]);
  const hint = h('p', { className: 'hint' });
  const aside = h('aside', { className: 'side' });
  const overlay = h('div', { className: 'overlay' });
  overlay.hidden = true;
  d.root.replaceChildren(h('div', { className: 'battle' }, [h('div', { className: 'board-column' }, [board, hint]), aside]), overlay);

  let playing: Playing | null = null;
  let lingering: Playing | null = null;
  let enemyTimer: number | null = null;
  let menu: { key: string; list: CursorList } | null = null;
  let modal: CursorList | null = null;
  let resultShown = false;
  let alive = true;
  let seenEvents = 0;
  let logLines: string[] = [];
  let forecastKey = '';
  const cursorView = { ...c.cursor };

  const now = () => performance.now();
  const animating = () => playing !== null && now() - playing.start < playing.total;
  const scale = () => animationScale(d.settings.get().speed);

  /** Runs a controller change and queues the animation that shows it. */
  function act(change: () => void): void {
    if (playing) skip();
    const before = c.state;
    const beforeMode = c.mode;
    const shown = new Map(before.units.map((u) => [u.id, { ...c.displayPos(u) }]));
    const shownPos = (id: string) => shown.get(id)!;
    change();
    let steps: Step[] = [];
    if (c.state !== before) steps = stepsBetween(RULES, before, c.state, shownPos, scale());
    else if (c.mode.kind === 'menu' && beforeMode.kind === 'selected') steps = tentativeMove(RULES, before, c.mode.unitId, c.mode.to, scale());
    if (steps.length > 0) {
      playing = { base: baseViews(before, shownPos), steps, start: now(), total: durationMs(steps) };
      lingering = playing;
    }
    refresh();
  }

  function skip(): void {
    if (playing) playing.start = now() - playing.total;
  }

  function animationEnded(): void {
    playing = null;
    refresh();
  }

  function command(cmd: BattleCommand): void {
    if (!alive || modal) return;
    if (animating()) {
      if (cmd.type === 'confirm') skip();
      return;
    }
    if (c.mode.kind === 'over') return;
    switch (cmd.type) {
      case 'cursor':
        return act(() => c.moveCursor(cmd.dx, cmd.dy));
      case 'confirm':
        if (c.mode.kind === 'enemy') return;
        return act(() => c.confirm());
      case 'cancel':
        if (c.mode.kind === 'idle') return openPause();
        return act(() => c.cancel());
      case 'endTurn':
        return act(() => c.endTurn());
      case 'restart':
        return restart();
      case 'language': {
        const language = LANGUAGES[(LANGUAGES.indexOf(getLanguage()) + 1) % LANGUAGES.length]!;
        d.settings.update({ language });
        logLines = [];
        seenEvents = 0;
        dropMenu();
        return refresh();
      }
      case 'nextUnit':
        return act(() => c.nextReadyUnit());
    }
  }

  function restart(): void {
    if (enemyTimer !== null) window.clearTimeout(enemyTimer);
    enemyTimer = null;
    playing = null;
    lingering = null;
    resultShown = false;
    closeModal();
    c.restart(c.route, Math.floor(Math.random() * 1_000_000));
    logLines = [];
    seenEvents = 0;
    Object.assign(cursorView, c.cursor);
    openingBanner();
    refresh();
  }

  /** The "Player phase, turn 1" banner when a chapter starts. */
  function openingBanner(): void {
    const ms = Math.round(ANIM.bannerMs * scale());
    if (ms === 0) return;
    const steps: Step[] = [{ kind: 'banner', phase: c.state.phase, turn: c.state.turn, ms }];
    playing = { base: baseViews(c.state, (id) => c.displayPos(c.unit(id))), steps, start: now(), total: ms };
  }

  const unbind = bindBattleInput(canvas, {
    size: () => c.state.grid,
    command,
    click: (p) => {
      if (modal || !alive) return;
      if (animating()) return skip();
      if (c.mode.kind === 'menu') return act(() => c.cancel());
      act(() => c.clickTile(p));
    },
    hover: (p) => {
      if (modal || animating() || (p.x === c.cursor.x && p.y === c.cursor.y)) return;
      if (c.mode.kind === 'menu' || c.mode.kind === 'enemy' || c.mode.kind === 'over') return;
      act(() => c.hover(p));
    },
    cancel: () => command({ type: 'cancel' }),
  });

  function leave(): void {
    alive = false;
    if (enemyTimer !== null) window.clearTimeout(enemyTimer);
    unbind();
    menu?.list.dispose();
    closeModal();
    d.quit();
  }

  // ---- side windows ----

  const name = (id: string) => c.unit(id).name;

  function describeEvent(e: BattleEvent): string[] {
    switch (e.type) {
      case 'combat':
        return e.result.strikes.map((s) => t(!s.hit ? 'log.miss' : s.crit ? 'log.crit' : 'log.hit', { attacker: name(s.attackerId), target: name(s.targetId), damage: s.damage }));
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

  function hpBar(hp: number, max: number): HTMLElement {
    const ratio = Math.max(0, Math.min(1, hp / max));
    const fill = h('i', { className: ratio > 0.5 ? 'hp-high' : ratio > 0.25 ? 'hp-mid' : 'hp-low' });
    fill.style.width = `${Math.round(ratio * 100)}%`;
    return h('div', { className: 'hp-row' }, [h('span', { textContent: `${t('stat.hp')} ${hp}/${max}` }), h('span', { className: 'hp-bar' }, [fill])]);
  }

  function unitWindow(u: Unit, hp: number): HTMLElement {
    const weapon = u.weaponId ? t(`weapon.${u.weaponId}`) : t('weapon.none');
    const tags = [u.lord && t('unit.lord'), u.boss && t('unit.boss'), u.ai && t('unit.ai', { ai: t(`ai.${u.ai}`) })].filter(Boolean).join(' · ');
    const stats = h('div', { className: 'stats' }, STAT_KEYS.filter((k) => k !== 'hp').map((k) => h('span', {}, [`${t(`stat.${k}`)} `, h('b', { textContent: String(u.stats[k]) })])));
    return mdWindow({ title: t('panel.unit'), className: `unit-window ${u.faction}`, still: true }, [
      h('p', { className: 'unit-name' }, [h('strong', { textContent: u.name }), h('span', { className: 'dim', textContent: ` ${t(`class.${u.classId}`)}` })]),
      h('p', { textContent: `${t('unit.level', { level: u.level })} · ${t('unit.exp', { exp: u.exp })}` }),
      hpBar(hp, u.stats.hp),
      h('p', { textContent: weapon }),
      tags ? h('p', { className: 'dim', textContent: tags }) : null,
      stats,
    ]);
  }

  function terrainWindow(p: Point): HTMLElement {
    const terrain = terrainAt(c.state.grid, RULES.terrains, p);
    const impassable = Object.values(terrain.moveCost).every((cost) => cost === null);
    return mdWindow({ title: t('panel.terrain'), className: 'terrain-window', still: true }, [
      h('p', { className: 'terrain-name', textContent: t(`terrain.${terrain.id}`) }),
      impassable
        ? h('p', { className: 'dim', textContent: t('terrain.impassable') })
        : h('div', {}, [
            statLine(t('terrain.avoid'), `+${terrain.avoid}`),
            statLine(t('terrain.def'), `+${terrain.def}`),
            terrain.healPct > 0 ? statLine(t('terrain.heal'), `${terrain.healPct} %`) : null,
          ]),
    ]);
  }

  function forecastSide(side: CombatSide, u: Unit): HTMLElement {
    const rows: Child[] =
      side.strikes === 0
        ? [h('p', { className: 'dim', textContent: t('forecast.noCounter') })]
        : [
            statLine(t('forecast.damage'), `${side.damage}${side.strikes === 2 ? ' ×2' : ''}`),
            statLine(t('forecast.hit'), String(side.hit)),
            h('p', { className: 'dim true-hit', textContent: t('forecast.trueHit', { value: side.trueHit.toFixed(1) }) }),
            statLine(t('forecast.crit'), String(side.crit)),
          ];
    return h('div', { className: `side-col ${u.faction}` }, [h('h4', { textContent: u.name }), hpBar(side.hp, u.stats.hp), ...rows]);
  }

  /** Forgets the action menu so the next refresh rebuilds it (e.g. in another language). */
  function dropMenu(): void {
    menu?.list.dispose();
    menu = null;
    menuLayer.replaceChildren();
  }

  function refreshMenu(): void {
    const mode = c.mode;
    const key = mode.kind === 'menu' && !animating() ? `${mode.unitId}@${mode.to.x},${mode.to.y}` : '';
    if (menu && menu.key === key) return;
    menu?.list.dispose();
    menu = null;
    menuLayer.replaceChildren();
    if (!key || mode.kind !== 'menu') return;
    const list = cursorList({
      label: t('panel.actions'),
      onBack: () => act(() => c.cancel()),
      items: c.menuOptions().map((o: MenuOption) => ({ label: t(`action.${o}`), onConfirm: () => act(() => c.choose(o)) })),
    });
    menu = { key, list };
    const { width, height } = c.state.grid;
    const win = mdWindow({ className: 'action-menu' }, [list.element]);
    const left = mode.to.x < width / 2;
    win.style.left = left ? `${((mode.to.x + 1.2) / width) * 100}%` : '';
    win.style.right = left ? '' : `${((width - mode.to.x + 0.2) / width) * 100}%`;
    win.style.top = `${(Math.min(mode.to.y, height - 3) / height) * 100}%`;
    menuLayer.append(win);
  }

  function refresh(): void {
    if (!alive) return;
    const s = c.state;
    const events = s.events;
    for (; seenEvents < events.length; seenEvents++) logLines.push(...describeEvent(events[seenEvents]!));
    logLines = logLines.slice(-5);
    const busy = animating();
    hint.textContent = t(controlsHintKey(c.mode, busy));
    refreshMenu();

    const windows: Child[] = [
      mdWindow({ title: c.chapter.title[getLanguage()] ?? c.chapter.id, className: 'hud-window', still: true }, [
        h('p', { className: `phase ${s.phase}`, textContent: `${t('hud.turn', { n: s.turn })} · ${t(`phase.${s.phase}`)}` }),
        h('p', { className: 'dim', textContent: t(`objective.${s.objective.type}`) }),
        statLine(t('screen.route'), t(`route.${c.route}`)),
      ]),
    ];
    const f = busy ? null : c.forecast();
    if (f) {
      const key = `${f.attacker.unitId}>${f.defender.unitId}`;
      windows.push(
        mdWindow({ title: t('forecast.title'), className: 'forecast', still: key === forecastKey }, [
          h('div', { className: 'sides' }, [forecastSide(f.attacker, c.unit(f.attacker.unitId)), forecastSide(f.defender, c.unit(f.defender.unitId))]),
        ]),
      );
      forecastKey = key;
    } else {
      forecastKey = '';
      const focus = 'unitId' in c.mode ? c.unit(c.mode.unitId) : c.unitAt(c.cursor);
      if (focus) windows.push(unitWindow(focus, focus.hp));
    }
    windows.push(terrainWindow(c.cursor));
    windows.push(mdWindow({ title: t('log.title'), className: 'log', still: true }, logLines.length ? logLines.map((line) => h('p', { textContent: line })) : [h('p', { className: 'dim', textContent: '—' })]));
    aside.replaceChildren(...windows.filter((x): x is HTMLElement => x instanceof HTMLElement));

    if (!busy && c.mode.kind === 'enemy' && enemyTimer === null) {
      enemyTimer = window.setTimeout(() => {
        enemyTimer = null;
        if (alive && !modal) act(() => c.stepEnemy());
        else refresh();
      }, Math.max(80, ENEMY_PAUSE_MS * scale()));
    }
    if (!busy && s.outcome !== 'ongoing' && !resultShown) showResult();
  }

  // ---- overlays ----

  function closeModal(): void {
    modal?.dispose();
    modal = null;
    overlay.hidden = true;
    overlay.replaceChildren();
  }

  function openPause(view: 'main' | 'settings' = 'main'): void {
    closeModal();
    const resume = () => {
      closeModal();
      refresh();
    };
    const list = cursorList({ items: [], onBack: view === 'main' ? resume : () => openPause('main'), label: t('pause.title') });
    modal = list;
    if (view === 'main') {
      list.setItems([
        { label: t('pause.resume'), onConfirm: resume },
        { label: t('pause.endTurn'), disabled: c.state.phase !== 'player', onConfirm: () => (closeModal(), act(() => c.endTurn())) },
        { label: t('pause.restart'), onConfirm: restart },
        { label: t('pause.settings'), onConfirm: () => openPause('settings') },
        { label: t('pause.quit'), onConfirm: leave },
      ]);
    } else {
      let language = d.settings.get().language;
      const again = () => {
        if (d.settings.get().language !== language) {
          language = d.settings.get().language;
          logLines = [];
          seenEvents = 0;
          dropMenu();
          refresh();
          return openPause('settings');
        }
        list.setItems([...settingItems(d.settings, again), { label: t('menu.back'), onConfirm: () => openPause('main') }]);
      };
      again();
    }
    overlay.replaceChildren(mdWindow({ title: t(view === 'main' ? 'pause.title' : 'pause.settings'), className: view === 'main' ? 'pause-menu' : 'settings' }, [list.element]));
    overlay.hidden = false;
  }

  function showResult(): void {
    resultShown = true;
    closeModal();
    const s = c.state;
    const victory = s.outcome === 'victory';
    const retreated = s.units.filter((u) => u.faction === 'player' && u.status === 'retreated').length;
    const lordLost = s.units.some((u) => u.lord && u.status !== 'active');
    const list = cursorList({
      onBack: leave,
      items: [
        { label: t('screen.toTitle'), onConfirm: leave },
        { label: t('screen.retry'), onConfirm: restart },
      ],
    });
    modal = list;
    overlay.replaceChildren(
      mdWindow({ className: `result ${victory ? 'victory' : 'defeat'}` }, [
        h('h1', { textContent: t(victory ? 'screen.victory' : 'screen.defeat') }),
        !victory && lordLost ? h('p', { textContent: t('screen.defeatLord') }) : null,
        statLine(t('screen.route'), t(`route.${c.route}`)),
        statLine(t('screen.turns'), String(s.turn)),
        statLine(t('screen.retreated'), String(retreated)),
        h('div', { className: 'result-actions' }, [list.element]),
      ]),
    );
    overlay.hidden = false;
  }

  // ---- frame loop ----

  function loop(time: number): void {
    if (!alive) return;
    if (playing && time - playing.start >= playing.total) animationEnded();
    let frame;
    if (playing) frame = frameAt(playing.base, playing.steps, time - playing.start);
    else {
      frame = frameAt(baseViews(c.state, (id) => c.displayPos(c.unit(id))), [], 0);
      if (lingering) {
        const age = time - lingering.start;
        if (age < lingering.total + ANIM.numberLifeMs) frame.texts = frameAt(lingering.base, lingering.steps, age).texts;
        else lingering = null;
      }
    }
    cursorView.x += (c.cursor.x - cursorView.x) * 0.35;
    cursorView.y += (c.cursor.y - cursorView.y) * 0.35;
    render(ctx, c, { sprites: d.sprites(), frame, cursor: cursorView, grid: d.settings.get().grid, timeMs: time, animating: playing !== null });
    requestAnimationFrame(loop);
  }

  Object.assign(cursorView, c.cursor);
  openingBanner();
  refresh();
  requestAnimationFrame(loop);
}
