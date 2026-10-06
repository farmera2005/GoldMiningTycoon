// The T8 harness skeleton (DESIGN §13.27 T8, §13.13; S13-12): render a screen for a state S and for S′ with every
// hidden field scrambled, and require identical DOM text and attribute values (dev reveal off). The scrambler is
// passed in: it lives in sim/bots/scramble.ts (D-2.58), which UI code may not import, so the test that runs T8 hands
// it over. `ui-gates` completes this harness over every P1 screen with the committed P1 fixtures.
import { act, cleanup } from '@testing-library/react';
import type { GameState, WeekReport } from '../../engine';
import type { KnownRoute } from '../app/router';
import { renderScreen } from './render';

/** Volatile attributes that differ between two renders of the same thing (React's generated ids). */
const VOLATILE_ATTRS = new Set([
  'id',
  'aria-labelledby',
  'aria-describedby',
  'aria-controls',
  'aria-activedescendant',
  'for',
]);

/** A stable serialization of a DOM subtree: tag, non-volatile attributes in name order, text; one line per node. */
export function domSnapshot(root: Element): string {
  const lines: string[] = [];
  const visit = (node: Node, depth: number): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text !== '') lines.push(`${'  '.repeat(depth)}"${text}"`);
      return;
    }
    if (!(node instanceof Element)) return;
    const attrs = [...node.attributes]
      .filter((a) => !VOLATILE_ATTRS.has(a.name))
      .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
      .sort();
    lines.push(
      `${'  '.repeat(depth)}<${node.tagName.toLowerCase()}${attrs.length === 0 ? '' : ` ${attrs.join(' ')}`}>`,
    );
    for (const child of node.childNodes) visit(child, depth + 1);
  };
  visit(root, 0);
  return lines.join('\n');
}

export interface ScrambledPair {
  readonly state: GameState;
  readonly scrambled: GameState;
  /** Retained reports for each side (S13-12: scrambleReportHidden for S′). */
  readonly reports?: readonly WeekReport[];
  readonly scrambledReports?: readonly WeekReport[];
}

/**
 * The DOM of `route` rendered for each side of the pair; T8 asserts the two strings are equal. Each render is cleaned
 * up before the next.
 */
export function renderBothSides(
  route: KnownRoute | string,
  pair: ScrambledPair,
): { readonly a: string; readonly b: string } {
  const side = (state: GameState, reports: readonly WeekReport[] | undefined): string => {
    const r = renderScreen(route, { state });
    if (reports !== undefined) act(() => r.harness.store.getState().setGame({ calcReports: [...reports] }));
    const snap = domSnapshot(r.container);
    cleanup();
    return snap;
  };
  return { a: side(pair.state, pair.reports), b: side(pair.scrambled, pair.scrambledReports) };
}
