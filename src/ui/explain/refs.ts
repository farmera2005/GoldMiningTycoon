// ExplainRef builders and the links between explanations (DESIGN §13.13). `live` refs name an engine explainer
// (any owner's, S13-5), `report` refs a calc tree in a retained WeekReport under the owner's calc key (S13-6: the UI
// builds report keys only through the engine's `reportCalcKey`), `ledger`, `history` and `tuning` refs their stores,
// and `input` refs a player-set value's editor.
import {
  CASH_ON_HAND_ACCOUNTS,
  HISTORY_METRIC_INFO,
  parseReportCalcKey,
  reportCalcKey,
  type ExplainRef,
  type ExplainerName,
  type HistoryMetric,
  type LedgerFilter,
  type SystemFolder,
} from '../../engine';

/** §11 11.2 cash on hand: the operating and reserve accounts (restricted cash is excluded), as the engine defines it. */
export { CASH_ON_HAND_ACCOUNTS };

export const cashRef: ExplainRef = { kind: 'live', explainer: 'cash', args: [] };
export const netWorthRef: ExplainRef = { kind: 'live', explainer: 'netWorth', args: ['scoring'] };

/** A `live` ref to any owner's explainer (`explain.<name>(state, ...args)`). */
export function liveRef(explainer: ExplainerName, ...args: readonly unknown[]): ExplainRef {
  return { kind: 'live', explainer, args };
}

export function historyRef(metric: HistoryMetric, turn: number): ExplainRef {
  return { kind: 'history', metric, turn };
}

export function ledgerRef(filter: LedgerFilter): ExplainRef {
  return { kind: 'ledger', filter };
}

/**
 * A `report` ref to the calc tree an owner wrote for `turn` under `<folder>/<metric>/<entityId>[/<lineId>]`
 * (`ops/directCostPerBcy/clm_000012/L1`), then down the tree by child labels.
 */
export function reportRef(
  turn: number,
  key: { readonly folder: SystemFolder; readonly metric: string; readonly entityId: string; readonly lineId?: string },
  ...childLabels: readonly string[]
): ExplainRef {
  const calcKey =
    key.lineId === undefined
      ? reportCalcKey(key.folder, key.metric, key.entityId)
      : reportCalcKey(key.folder, key.metric, key.entityId, key.lineId);
  return { kind: 'report', turn, path: [calcKey, ...childLabels] };
}

/** The company's cash postings dated `turn`: the week's cash movement. */
export function cashPostingsRef(turn: number): ExplainRef {
  return ledgerRef({ book: 'company', accounts: [...CASH_ON_HAND_ACCOUNTS], fromTurn: turn, toTurn: turn });
}

/** The ledger an explanation rests on, offered as `Open ledger` in the drawer, or null. */
export function relatedLedger(ref: ExplainRef): ExplainRef | null {
  switch (ref.kind) {
    case 'live':
      return ref.explainer === 'cash' ? ledgerRef({ book: 'company', accounts: [...CASH_ON_HAND_ACCOUNTS] }) : null;
    case 'history':
      return ref.metric === 'cashCents' ? cashPostingsRef(ref.turn) : null;
    case 'report':
    case 'ledger':
    case 'tuning':
    case 'input':
      return null;
  }
}

function isHistoryMetric(name: string): name is HistoryMetric {
  return Object.hasOwn(HISTORY_METRIC_INFO, name);
}

/**
 * Where an expired `report` ref falls back (13.13 retention, 13.21 `EXPLAIN_EXPIRED`, T26): the weekly history value
 * of the same metric when §2's snapshot keeps one (a report keyed `ops/payWashedBcy/…` → `payWashedBcy`), else the
 * week's cash, and the week's ledger postings. Empty for any other ref.
 */
export function explainFallbacks(ref: ExplainRef): ExplainRef[] {
  if (ref.kind !== 'report') return [];
  const parts = parseReportCalcKey(ref.path[0] ?? '');
  const metric: HistoryMetric = parts !== null && isHistoryMetric(parts.metric) ? parts.metric : 'cashCents';
  return [historyRef(metric, ref.turn), cashPostingsRef(ref.turn)];
}

/** A stable key for a ref (React keys, equality of breadcrumbs). */
export function refKey(ref: ExplainRef): string {
  return JSON.stringify(ref);
}
