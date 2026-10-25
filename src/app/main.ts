import { loadSpritePack, type LoadedSprites } from '../adapters/sprites';
import { applyTokens, FONT } from '../adapters/ui/tokens';
import type { Route } from '../core/chapter';
import { CHAPTERS, SAMPLE_CHAPTER_ID } from '../data/chapters';
import { setLanguage, t, type Language } from '../i18n';
import { battleScreen } from './battle-screen';
import { Controller } from './controller';
import { titleScreen, type Screens, type SettingsAccess } from './screens';
import { browserStore, loadSettings, saveSettings, type Settings } from './settings';

/** Page flow: title (Play → route select, Settings, Credits) → battle → result → title. */
const store = browserStore();
const browserLanguage: Language = navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
let settings: Settings = loadSettings(store, browserLanguage);

function applyLanguage(language: Language): void {
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('app.title');
}

const access: SettingsAccess = {
  get: () => settings,
  update(changes) {
    settings = { ...settings, ...changes };
    saveSettings(store, settings);
    applyLanguage(settings.language);
  },
};

applyTokens(document.documentElement);
applyLanguage(settings.language);
void document.fonts?.load(`22px "${FONT.family}"`);

const root = document.getElementById('app')!;
const controller = new Controller(CHAPTERS[SAMPLE_CHAPTER_ID], 'easy', 1);

// Optional local sprite pack (git-ignored assets-local/); without one the procedural art stays.
let sprites: LoadedSprites | null = null;
void loadSpritePack().then((loaded) => {
  sprites = loaded;
});

const screens: Screens = {
  root,
  chapter: controller.chapter,
  settings: access,
  play(route: Route) {
    battleScreen({ root, controller, settings: access, sprites: () => sprites, quit: () => titleScreen(screens, 0) }, route);
  },
};

// `?route=easy|hard` opens the battle directly (handy for links and smoke checks).
const deepLink = new URLSearchParams(location.search).get('route');
if (deepLink === 'easy' || deepLink === 'hard') screens.play(deepLink);
else titleScreen(screens);
