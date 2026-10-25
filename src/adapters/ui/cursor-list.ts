import { moveCursor, navAction, restoreCursor, selectable, type NavItem, type NavLayout } from './nav';
import { h, type Child } from './window';

/**
 * The ▶ cursor menu (ported from Mazmorra Sombría). Keyboard: up/down or W/S
 * move, left/right adjust a value row, Enter/Space/Z confirm, Esc/X go back.
 * Mouse: hovering moves the cursor, a click confirms, the ◀ ▶ arrows of a
 * value row adjust it. Only the most recently opened list on the page takes
 * keys, and it marks the keys it uses (`preventDefault`) so the battle map
 * ignores them.
 */
export interface ListItem extends NavItem {
  label: Child;
  /** Right-aligned value (settings rows). */
  value?: Child;
  onAdjust?(delta: -1 | 1): void;
  onConfirm?(): void;
  className?: string;
}

export interface CursorListOptions {
  items: ListItem[];
  layout?: NavLayout;
  initial?: number;
  onBack?(): void;
  onCursor?(index: number): void;
  label?: string;
  className?: string;
}

export interface CursorList {
  element: HTMLElement;
  index(): number;
  setItems(items: ListItem[]): void;
  dispose(): void;
}

interface Registered {
  element: HTMLElement;
  handle(e: KeyboardEvent): void;
}
const stack: Registered[] = [];
let listening = false;

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i]!.element.isConnected) stack.splice(i, 1);
  }
  stack.at(-1)?.handle(e);
}

/** True while a connected cursor list takes the keyboard (the battle map then leaves keys alone). */
export function listHasKeyboard(): boolean {
  return stack.some((r) => r.element.isConnected);
}

export function cursorList(options: CursorListOptions): CursorList {
  const layout = options.layout ?? 'vertical';
  const element = h('div', { className: ['md-list', layout, options.className ?? ''].filter(Boolean).join(' ') });
  element.setAttribute('role', 'menu');
  if (options.label) element.setAttribute('aria-label', options.label);
  let items: ListItem[] = [];
  let rows: HTMLElement[] = [];
  let index = -1;

  function paint(): void {
    rows.forEach((row, i) => {
      row.classList.toggle('is-active', i === index);
      if (i === index) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
  }

  function setIndex(next: number, fromKeyboard: boolean): void {
    if (next < 0 || next === index) return;
    index = next;
    paint();
    options.onCursor?.(index);
    if (fromKeyboard) rows[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function adjust(item: ListItem, delta: -1 | 1): void {
    if (item.onAdjust && selectable(item)) item.onAdjust(delta);
  }

  function rowFor(item: ListItem, i: number): HTMLElement {
    if (item.header) return h('div', { className: 'md-list-header' }, [item.label]);
    const children: Child[] = [h('span', { className: 'md-cursor', textContent: '▶' }), h('span', { className: 'md-label' }, [item.label])];
    if (item.value !== undefined) {
      const value = h('span', { className: 'md-value' }, [item.value]);
      if (item.onAdjust) {
        const arrow = (text: string, delta: -1 | 1) => {
          const node = h('span', { className: 'md-arrow', textContent: text });
          node.setAttribute('aria-hidden', 'true');
          node.addEventListener('click', (e) => {
            e.stopPropagation();
            setIndex(i, false);
            adjust(item, delta);
          });
          return node;
        };
        value.prepend(arrow('◀', -1));
        value.append(arrow('▶', 1));
      }
      children.push(value);
    }
    const row = h('button', { type: 'button', className: ['md-item', item.className ?? '', item.disabled ? 'is-disabled' : ''].filter(Boolean).join(' ') }, children);
    row.tabIndex = -1;
    row.setAttribute('role', 'menuitem');
    if (item.disabled) row.setAttribute('aria-disabled', 'true');
    row.addEventListener('pointerenter', () => {
      if (selectable(item)) setIndex(i, false);
    });
    row.addEventListener('click', () => {
      if (!selectable(item)) return;
      setIndex(i, false);
      if (item.onConfirm) item.onConfirm();
      else adjust(item, 1);
    });
    return row;
  }

  function setItems(next: ListItem[]): void {
    const keep = items.length === 0 ? (options.initial ?? 0) : index;
    items = next;
    rows = items.map(rowFor);
    element.replaceChildren(...rows);
    index = restoreCursor(items, keep);
    paint();
  }

  function handle(e: KeyboardEvent): void {
    const action = navAction(e.code, layout);
    if (!action) return;
    const item = items[index];
    if (action === 'prev' || action === 'next') setIndex(moveCursor(items, index, action === 'prev' ? -1 : 1), true);
    else if (action === 'left' || action === 'right') {
      if (item) adjust(item, action === 'left' ? -1 : 1);
    } else if (action === 'confirm') {
      if (e.repeat || !item || !selectable(item)) return e.preventDefault();
      rows[index]?.click();
    } else if (action === 'back') {
      if (!options.onBack) return;
      options.onBack();
    }
    e.preventDefault();
  }

  setItems(options.items);
  const registered: Registered = { element, handle };
  stack.push(registered);
  if (!listening) {
    window.addEventListener('keydown', onKey);
    listening = true;
  }
  return {
    element,
    index: () => index,
    setItems,
    dispose() {
      const at = stack.indexOf(registered);
      if (at >= 0) stack.splice(at, 1);
    },
  };
}
