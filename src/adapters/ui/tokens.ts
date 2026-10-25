/**
 * Design tokens, the one place colours, the font and sizes are defined
 * (window style ported from Mazmorra Sombría). The DOM gets them as CSS custom
 * properties (`applyTokens`, read by index.html); the canvas imports them.
 */
export const PALETTE = {
  ink: '#05060d',
  windowTop: '#2b4b93',
  windowBottom: '#0f1a45',
  border: '#e9eefc',
  borderShade: '#6f86c6',
  text: '#f5f7ff',
  textDim: '#aab6dc',
  disabled: '#5e6890',
  cursor: '#ffd447',
  /** Title accent. */
  accent: '#3fd0c9',
  danger: '#ff6b5e',
  good: '#7fe08a',
  hp: '#5fd36a',
  hpMid: '#f0c040',
  hpLow: '#ff5a4f',
  xp: '#7fd8ff',
  barBack: '#1a1f3c',
  player: '#3f7ff0',
  playerDark: '#1d3f8f',
  enemy: '#e0473f',
  enemyDark: '#7a1a1a',
  done: '#6b6f7a',
  doneDark: '#383a42',
} as const;

/** Pixelify Sans (SIL OFL 1.1, public/fonts). Its pixel is about 1/11 em. */
export const FONT = {
  family: 'Pixelify Sans',
  stack: '"Pixelify Sans", ui-monospace, monospace',
  bodyPx: 22,
  smallPx: 16,
  headingPx: 33,
  titlePx: 66,
} as const;

export const canvasFont = (px: number, bold = false): string => `${bold ? '700 ' : ''}${px}px "${FONT.family}", monospace`;

export const MOTION = { openMs: 120, bobMs: 600 } as const;

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(PALETTE)) vars[`--md-${kebab(name)}`] = value;
  vars['--md-font'] = FONT.stack;
  vars['--md-body'] = `${FONT.bodyPx}px`;
  vars['--md-small'] = `${FONT.smallPx}px`;
  vars['--md-heading'] = `${FONT.headingPx}px`;
  vars['--md-title'] = `${FONT.titlePx}px`;
  vars['--md-open-ms'] = `${MOTION.openMs}ms`;
  vars['--md-bob-ms'] = `${MOTION.bobMs}ms`;
  return vars;
}

export function applyTokens(target: HTMLElement): void {
  for (const [name, value] of Object.entries(cssVariables())) target.style.setProperty(name, value);
}
