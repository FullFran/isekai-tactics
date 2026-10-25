/**
 * Pure cursor navigation for the menus (a ▶ cursor
 * that moves over a list, wraps at the ends and skips what cannot be picked).
 * The DOM component in cursor-list.ts only renders and routes keys here.
 */
export interface NavItem {
  /** Shown greyed out; the cursor skips it. */
  disabled?: boolean;
  /** A section label inside the list; never selectable. */
  header?: boolean;
}

export const selectable = (item: NavItem): boolean => !item.disabled && !item.header;

/** First selectable index at or after `from`, wrapping round; -1 when nothing is selectable. */
export function firstSelectable(items: readonly NavItem[], from = 0): number {
  const n = items.length;
  for (let k = 0; k < n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (selectable(items[i]!)) return i;
  }
  return -1;
}

/** The next selectable index in `delta` direction from `index`, wrapping; `index` itself when it is the only one. */
export function moveCursor(items: readonly NavItem[], index: number, delta: 1 | -1): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (((index + delta * k) % n) + n) % n;
    if (selectable(items[i]!)) return i;
  }
  return -1;
}

/** Cursor after the items changed: the same index while it is still selectable, else the next selectable one. */
export function restoreCursor(items: readonly NavItem[], index: number): number {
  if (index >= 0 && index < items.length && selectable(items[index]!)) return index;
  return firstSelectable(items, index < items.length ? index : 0);
}

export type NavAction = 'prev' | 'next' | 'left' | 'right' | 'confirm' | 'back';
export type NavLayout = 'vertical' | 'horizontal';

const KEYS: Record<string, NavAction> = {
  ArrowUp: 'prev',
  KeyW: 'prev',
  ArrowDown: 'next',
  KeyS: 'next',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  KeyZ: 'confirm',
  Escape: 'back',
  KeyX: 'back',
  Backspace: 'back',
};

/** What a key code does in a menu. In a horizontal list (cards) left and right move the cursor. */
export function navAction(code: string, layout: NavLayout = 'vertical'): NavAction | null {
  const action = KEYS[code] ?? null;
  if (layout === 'horizontal' && action === 'left') return 'prev';
  if (layout === 'horizontal' && action === 'right') return 'next';
  return action;
}

