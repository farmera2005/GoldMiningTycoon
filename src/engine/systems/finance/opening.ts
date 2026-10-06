// §11's opening values for a new game (DESIGN §11.23; P1 contract §4.11, N9). §1's start setup calls this after it has
// set the start table's values: the cash sweep's operating target (`finance.defaultOperatingTargetUsd`) and the owner's
// credit file, scored and anchored at the start's personal credit score. Under P0 rules the slice keeps its inert
// values (the caller runs this from rules 1). A key the tuning data does not have yet leaves its field inert.
import { usdToCents } from '../../core/money';
import { contractTuningNumber, hasContractTuning } from '../../state/partKit';
import type { GameState } from '../../state/types';

export function openingFinance(draft: GameState): void {
  const t = draft.meta.tuning;
  const targetKey = 'finance.defaultOperatingTargetUsd';
  if (hasContractTuning(t, targetKey)) {
    draft.finance.sweep.operatingTargetCents = usdToCents(contractTuningNumber(t, targetKey));
  }
  const score = draft.company.owner.personalCreditScore;
  draft.finance.credit.owner.score = score;
  draft.finance.credit.owner.anchor = score;
}
