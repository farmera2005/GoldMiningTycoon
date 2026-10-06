// §11 the forward views (DESIGN §11.4, §11.16, §11.19.4; S10-2, S11-9, S11-14, S11-17, S11-23, S13-2; P1 contract §4.11):
// what this week's settlement still has to pay (standing orders leave room for it), the 13-week cash forecast
// (memoized), the P1 distress view with its counter levers, and the funding preview. Wave-0 stubs show an untroubled
// company with nothing scheduled.
import { ZERO_CENTS, type Cents } from '../../core/money';
import { contractTuningNumber, hasContractTuning } from '../../state/partKit';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { ObligationSpec } from '../permits/types';
import { cashOnHandCents } from './netWorth';
import type { DistressStatusP1, Forecast13Week, FundingPreview, PendingWeekCosts } from './types';

/** Costs of this week not yet billed and the payroll still to run (step 12's standing orders read it, S10-2). */
export function pendingCostsThisWeek(_state: GameState, _ctx: StepContext): PendingWeekCosts {
  // CONTRACT-STUB(§11) finance.pendingCostsThisWeek
  return { unbilledCents: ZERO_CENTS, payrollCents: ZERO_CENTS };
}

/** Everything due this week (open bills due by now plus the pending costs). */
export function dueThisWeek(_state: GameState, _pending?: PendingWeekCosts): Cents {
  // CONTRACT-STUB(§11) finance.dueThisWeek
  return ZERO_CENTS;
}

export interface ForecastOptions {
  hypothetical?: { cashDeltaCents: Cents; obligations: ObligationSpec[] };
}

export function forecast13Week(_state: GameState, _opts?: ForecastOptions): Forecast13Week {
  // CONTRACT-STUB(§11) finance.forecast13Week
  return { weeks: [], productionByClaim: {} };
}

/** The P1 distress view (S11-9, S11-17). */
export function distressStatus(state: GameState): DistressStatusP1 {
  // CONTRACT-STUB(§11) finance.distressStatus (stub stage, counter weeks and counter moves)
  const graceKey = 'finance.p1InsolvencyGraceWeeks';
  const t = state.meta.tuning;
  const p1 = state.finance.distress.p1;
  return {
    stage: 0,
    stageKey: 'none',
    p1Counter: {
      open: p1.openSinceTurn !== null,
      openSinceTurn: p1.openSinceTurn,
      weeksOpen: p1.openSinceTurn === null ? 0 : state.clock.turn - p1.openSinceTurn,
      graceWeeks: hasContractTuning(t, graceKey) ? contractTuningNumber(t, graceKey) : 0,
      netCashCents: cashOnHandCents(state.finance),
    },
    counterMoves: [],
    liquidation: state.finance.distress.liquidation === null ? null : { ...state.finance.distress.liquidation },
  };
}

/** Whether this week's settlement is funded, and what goes short first (S13-2). */
export function fundingPreview(_state: GameState, _opts?: ForecastOptions): FundingPreview {
  // CONTRACT-STUB(§11) finance.fundingPreview
  return {
    needCents: ZERO_CENTS,
    fundCents: ZERO_CENTS,
    autoGoldCents: ZERO_CENTS,
    shortfallCents: ZERO_CENTS,
    firstShort: null,
  };
}
