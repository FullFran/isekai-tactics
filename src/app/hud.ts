import type { ChapterDef, Route } from '../core/chapter';
import type { Mode } from './controller';

/** Party members deployed and enemies fielded on a route, for the route select screen. */
export function routeSummary(chapter: ChapterDef, route: Route): { units: number; enemies: number } {
  const config = chapter.routes[route];
  const enemies = config.unitGroups.reduce((n, group) => n + (chapter.unitGroups[group]?.length ?? 0), 0);
  return { units: Math.min(config.deploySlots, chapter.party.length), enemies };
}

/** i18n key of the on-screen controls hint for the current mode. */
export function controlsHintKey(mode: Mode, animating: boolean): string {
  if (animating) return 'hint.animating';
  return `hint.${mode.kind}`;
}
