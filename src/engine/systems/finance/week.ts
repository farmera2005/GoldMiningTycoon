// §11 steps 14 and 15 (DESIGN §11.22, §2.6; S11-8, S11-17, S11-20, S11-24; P1 contract §3 parts 14.1, 15.1; §0.6 item 3).
//   14.1 `financeStep`: (a) loan interest accrual; (b) payroll from §8 `payrollForWeek`; (c) bills: §7's cost lines,
//        §4's program costs, §8's staffing charges, loan payments in month-end weeks, §1's owner items, the week-52
//        Backed minimum top-up (§5 `minimumShortfallCents`), billable obligations due, the month-end
//        `accrued.royalties`; (d) receipts; (e) one settlement by priority, then §8 `recordPayrollOutcome`; (f) statuses
//        and §11's own obligation misses; (h) month end (depreciation from §9, ledger compaction, pruning).
//   15.1 `distressStep`: (b) the P1 insolvency counter and the stub stage with its `distress.stage` signal; (c) the
//        liquidation flag `{ cause: 'p1Counter' }` at t0 + grace; `cash.projectedNegative` from `forecast13Week`.
// Wave-0 stubs move no money, so a P1 game's cash only changes through actions.
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function financeStep(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§11) finance.financeStep
}

export function distressStep(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§11) finance.distressStep
}
