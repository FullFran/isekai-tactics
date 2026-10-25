/**
 * DOM building blocks of the UI: `h` creates elements, `mdWindow` the dialog
 * window every screen is made of (rounded pale border, dark blue gradient,
 * inner highlight; it opens with a short scale and fade, see index.html).
 */
export type Child = Node | string | null | undefined | false;

/** Creates an element with plain properties (className, textContent, type...) and children; falsy children are skipped. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, children: Child[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) if (child) node.append(child);
  return node;
}

export interface WindowOptions {
  /** Title tab at the top of the window. */
  title?: string;
  /** Extra classes: `wide`, `narrow`, `danger`, `gold`... */
  className?: string;
  /** Skip the open animation (windows rebuilt in place, e.g. on a language change). */
  still?: boolean;
}

export function mdWindow(options: WindowOptions, children: Child[]): HTMLElement {
  const classes = ['md-window', options.className ?? '', options.still ? 'still' : ''].filter(Boolean).join(' ');
  return h('section', { className: classes }, [
    options.title ? h('h2', { className: 'md-window-title', textContent: options.title }) : null,
    h('div', { className: 'md-window-body' }, children),
  ]);
}

/** A labelled line inside a window: "Semilla ........ 12345". */
export function statLine(label: string, value: string): HTMLElement {
  return h('div', { className: 'md-stat' }, [h('span', { textContent: label }), h('span', { className: 'md-stat-value', textContent: value })]);
}
