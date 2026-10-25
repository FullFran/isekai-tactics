import { cursorList, type ListItem } from '../adapters/ui/cursor-list';
import { h, mdWindow } from '../adapters/ui/window';
import { ROUTES, type ChapterDef, type Route } from '../core/chapter';
import { getLanguage, LANGUAGES, t } from '../i18n';
import { routeSummary } from './hud';
import { ANIMATION_SPEEDS, type Settings } from './settings';

/** Settings the screens read and change; `update` persists and applies at once. */
export interface SettingsAccess {
  get(): Settings;
  update(changes: Partial<Settings>): void;
}

const cycle = <T,>(values: readonly T[], current: T, delta: -1 | 1): T => values[(values.indexOf(current) + delta + values.length) % values.length]!;

/** Rows shared by the Settings screen and the pause menu; `refresh` rebuilds them after a change. */
export function settingItems(access: SettingsAccess, refresh: () => void): ListItem[] {
  const s = access.get();
  const row = (label: string, value: string, change: (delta: -1 | 1) => void): ListItem => ({
    label,
    value,
    onAdjust: (delta) => {
      change(delta);
      refresh();
    },
  });
  return [
    row(t('settings.language'), t(`settings.language.${s.language}`), (d) => access.update({ language: cycle(LANGUAGES, access.get().language, d) })),
    row(t('settings.speed'), t(`settings.speed.${s.speed}`), (d) => access.update({ speed: cycle(ANIMATION_SPEEDS, access.get().speed, d) })),
    row(t('settings.grid'), t(s.grid ? 'menu.on' : 'menu.off'), () => access.update({ grid: !access.get().grid })),
  ];
}

export const CONTROL_KEYS = ['move', 'confirm', 'cancel', 'mouse', 'next', 'endTurn', 'restart', 'language'] as const;

export function controlsWindow(): HTMLElement {
  return mdWindow({ title: t('controls.title'), className: 'controls' }, [h('ul', { className: 'control-list' }, CONTROL_KEYS.map((key) => h('li', { textContent: t(`controls.${key}`) })))]);
}

export interface Screens {
  root: HTMLElement;
  chapter: ChapterDef;
  settings: SettingsAccess;
  play(route: Route): void;
}

function show(root: HTMLElement, children: Node[]): void {
  root.replaceChildren(h('div', { className: 'screen' }, children));
}

export function titleScreen(s: Screens, initial = 0): void {
  const list = cursorList({
    initial,
    label: t('app.title'),
    items: [
      { label: t('title.play'), onConfirm: () => routeScreen(s) },
      { label: t('title.settings'), onConfirm: () => settingsScreen(s) },
      { label: t('title.credits'), onConfirm: () => creditsScreen(s) },
    ],
  });
  show(s.root, [
    h('header', { className: 'title-logo' }, [h('h1', { textContent: t('app.title') }), h('p', { className: 'title-alt', textContent: t('title.alt') })]),
    mdWindow({ className: 'title-menu' }, [list.element]),
    h('p', { className: 'hint', textContent: t('title.hint') }),
  ]);
}

export function routeScreen(s: Screens): void {
  const back = () => titleScreen(s, 0);
  const description = h('p', { className: 'route-desc' });
  const describe = (index: number) => {
    const route = ROUTES[index];
    description.textContent = route ? t(`route.${route}.desc`, routeSummary(s.chapter, route)) : '';
  };
  const list = cursorList({
    label: t('route.title'),
    onBack: back,
    onCursor: describe,
    items: [...ROUTES.map((route) => ({ label: t(`route.${route}`), onConfirm: () => s.play(route) })), { label: t('menu.back'), onConfirm: back }],
  });
  describe(list.index());
  show(s.root, [
    h('h1', { className: 'screen-title', textContent: t('route.title') }),
    mdWindow({ title: t('route.chapter', { title: s.chapter.title[getLanguage()] ?? s.chapter.id }), className: 'route' }, [list.element, description]),
    h('p', { className: 'hint', textContent: t('title.hint') }),
  ]);
}

export function settingsScreen(s: Screens): void {
  const back = () => titleScreen(s, 1);
  const list = cursorList({ items: [], onBack: back, label: t('title.settings') });
  let language = s.settings.get().language;
  const refresh = () => {
    // A language change rebuilds the whole screen so every label follows.
    if (s.settings.get().language !== language) {
      language = s.settings.get().language;
      list.dispose();
      return settingsScreen(s);
    }
    list.setItems([...settingItems(s.settings, refresh), { label: t('menu.back'), onConfirm: back }]);
  };
  refresh();
  show(s.root, [
    h('h1', { className: 'screen-title', textContent: t('title.settings') }),
    h('div', { className: 'screen-row' }, [mdWindow({ title: t('title.settings'), className: 'settings' }, [list.element]), controlsWindow()]),
    h('p', { className: 'hint', textContent: t('title.hint') }),
  ]);
}

export function creditsScreen(s: Screens): void {
  const back = () => titleScreen(s, 2);
  const list = cursorList({ items: [{ label: t('menu.back'), onConfirm: back }], onBack: back });
  show(s.root, [
    h('h1', { className: 'screen-title', textContent: t('credits.title') }),
    mdWindow({ title: t('credits.title'), className: 'credits' }, [
      ...(['game', 'art', 'font', 'ui', 'music'] as const).map((key) => h('p', { textContent: t(`credits.${key}`) })),
      list.element,
    ]),
  ]);
}
