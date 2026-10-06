// §11 finance explainers (DESIGN §2.8, §11.19; P1 contract §4.11): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). `cash` and `netWorth` keep their
// implementations in explain/cash.ts and explain/netWorth.ts. A name already used by another folder fails the
// composition test.
import type { CalcNode } from '../../core/calc';
import type { ClaimId, LoanId } from '../../core/ids';
import { explainCash } from '../../explain/cash';
import { explainNetWorth } from '../../explain/netWorth';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';
import type { FinancePeriod } from './types';

function statementLine(_state: GameState, _period: FinancePeriod, _lineKey: string): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.statementLine
  return stubCalcNode('Statement line', 'cents');
}

function forecast13WeekExplain(_state: GameState): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.forecast13Week
  return stubCalcNode('Cash in 13 weeks', 'cents');
}

function insolvencyCounter(_state: GameState): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.insolvencyCounter
  return stubCalcNode('Weeks to liquidation', 'weeks');
}

function loanPayment(_state: GameState, _loanId: LoanId): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.loanPayment
  return stubCalcNode('Loan payment', 'cents');
}

function costPerOunceExplain(_state: GameState, _period: FinancePeriod, _claimId?: ClaimId): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.costPerOunce
  return stubCalcNode('Cash cost per fine oz', 'usdPerFineOz');
}

function fundingPreviewExplain(_state: GameState): CalcNode {
  // CONTRACT-STUB(§11) finance.explain.fundingPreview
  return stubCalcNode('Funding this week', 'cents');
}

export const financeExplainers = {
  /** Cash on hand → cash accounts → ledger postings. */
  cash: explainCash,
  /** netWorth(state, 'scoring') → company NW and the owner's personal items. */
  netWorth: explainNetWorth,
  statementLine,
  forecast13Week: forecast13WeekExplain,
  insolvencyCounter,
  loanPayment,
  costPerOunce: costPerOunceExplain,
  fundingPreview: fundingPreviewExplain,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
