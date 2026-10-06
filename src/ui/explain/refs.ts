// ExplainRef builders for the P0 screens and the links between explanations (DESIGN §13.13). P0's refs are `live`
// (explain.cash, explain.netWorth), `ledger`, `tuning` and `history`; `report` refs resolve from the retained calc
// weeks; `input` refs arrive with the first player-set values in P1.
import { CASH_ON_HAND_ACCOUNTS } from '../../engine';
import type { ExplainRef, HistoryMetric, LedgerFilter } from '../../engine';

/** §11 11.2 cash on hand: the operating and reserve accounts (restricted cash is excluded), as the engine defines it. */
export { CASH_ON_HAND_ACCOUNTS };

export const cashRef: ExplainRef = { kind: 'live', explainer: 'cash', args: [] };
export const netWorthRef: ExplainRef = { kind: 'live', explainer: 'netWorth', args: ['scoring'] };

export function historyRef(metric: HistoryMetric, turn: number): ExplainRef {
  return { kind: 'history', metric, turn };
}

export function ledgerRef(filter: LedgerFilter): ExplainRef {
  return { kind: 'ledger', filter };
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

/** A stable key for a ref (React keys, equality of breadcrumbs). */
export function refKey(ref: ExplainRef): string {
  return JSON.stringify(ref);
}
