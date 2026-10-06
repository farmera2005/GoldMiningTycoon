// §11 reports (DESIGN §11.19, §11.20; s02 #14; S11-15, S11-19; P1 contract §4.11): the ledger query, cost per ounce,
// per-claim P&L, the income statement, spend by category, the payroll summary and period net income. Period net
// income is real (the company journal's detail; compaction and the monthly summaries ship with §11's package); the
// rest return empty reports until then (the UI keeps ui/explain/ledger.ts until `queryLedger` lands).
import type { ClaimId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { periodTotals } from './periods';
import type {
  ClaimPnLRow,
  CostPerOunce,
  FinancePeriod,
  LedgerFilter,
  LedgerPage,
  PayCategory,
  PayrollRegisterLine,
  StatementLine,
} from './types';

/** Company net income of turns fromTurn … toTurn inclusive. */
export function periodNetIncome(state: GameState, fromTurn: number, toTurn: number): Cents {
  return periodTotals(state.finance, fromTurn, toTurn).netIncomeCents;
}

export function queryLedger(
  _state: GameState,
  _filter: LedgerFilter,
  _page: { offset: number; limit: number },
): LedgerPage {
  // CONTRACT-STUB(§11) finance.queryLedger
  return { rows: [], summaries: [], total: 0, netCents: ZERO_CENTS };
}

export function costPerOunce(_state: GameState, _period: FinancePeriod, _claimId?: ClaimId): CostPerOunce {
  // CONTRACT-STUB(§11) finance.costPerOunce
  return {
    fineOzRecovered: 0,
    cashCostCents: ZERO_CENTS,
    aiscCents: ZERO_CENTS,
    cashCostPerOzCents: null,
    aiscPerOzCents: null,
  };
}

export function claimPnL(_state: GameState, _period: FinancePeriod): ClaimPnLRow[] {
  // CONTRACT-STUB(§11) finance.claimPnL
  return [];
}

export function incomeStatement(_state: GameState, _period: FinancePeriod): StatementLine[] {
  // CONTRACT-STUB(§11) finance.incomeStatement
  return [];
}

/** Spend by payment category over a span of turns (s02 #14: O-08 and M-CLAIMPROFIT inputs). */
export function spendByCategory(
  _state: GameState,
  _fromTurn: number,
  _toTurn: number,
  _claimId?: ClaimId,
): Partial<Record<PayCategory, Cents>> {
  // CONTRACT-STUB(§11) finance.spendByCategory
  return {};
}

export interface PayrollSummary {
  lastRunTurn: number | null;
  lines: PayrollRegisterLine[];
  grossYtdCents: Cents;
}

export function payrollSummary(_state: GameState): PayrollSummary {
  // CONTRACT-STUB(§11) finance.payrollSummary
  return { lastRunTurn: null, lines: [], grossYtdCents: ZERO_CENTS };
}
