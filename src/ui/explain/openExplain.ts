// `ui/openExplain` (DESIGN §13.21): open an explanation in the popover or the drawer. A `report` ref whose week is no
// longer retained (beyond ui.calcRetentionWeeks in memory, or after a reload when the persisted week was skipped
// above ui.persistReportMaxKb) answers `EXPLAIN_EXPIRED` and offers its fallbacks, the weekly history value and that
// week's ledger postings (13.13, T26); the surface still opens and shows the same choice.
import type { ExplainRef } from '../../engine';
import type { UiStore } from '../store/store';
import { explainFallbacks } from './refs';
import { resolveExplain } from './resolve';

export type OpenExplainResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'EXPLAIN_EXPIRED'; readonly fallbacks: readonly ExplainRef[] };

export interface OpenExplainOptions {
  /** The number that asked: positions the popover and takes focus back on close. */
  readonly anchor?: HTMLElement | null;
  /** A label for the popover when the explanation has none. */
  readonly label?: string;
  /** Default `popover`; `drawer` opens the full tree at once. */
  readonly surface?: 'popover' | 'drawer';
}

export function openExplain(store: UiStore, ref: ExplainRef, options: OpenExplainOptions = {}): OpenExplainResult {
  const st = store.getState();
  const anchor = options.anchor ?? null;
  if (options.surface === 'drawer') st.openDrawer(ref, anchor);
  else st.openPopover(options.label === undefined ? { ref, anchor } : { ref, anchor, label: options.label });
  const resolved = resolveExplain(ref, { state: st.game.state, calcReports: st.game.calcReports, reveal: false });
  if (resolved.kind === 'unavailable' && resolved.reason === 'EXPLAIN_EXPIRED') {
    return { ok: false, code: 'EXPLAIN_EXPIRED', fallbacks: explainFallbacks(ref) };
  }
  return { ok: true };
}
