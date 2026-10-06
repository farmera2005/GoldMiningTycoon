// §8 in the pipeline (DESIGN §8.15, §2.6; P1 contract §1.5 N8, §3 parts 1.3, 3.3, 7.3, 10.5, 16.9).
//   N8 `initPools`: per district ascending, per role in `Role` order, Poisson(poolTarget) on
//      `rng(seed,'staff-market',0,districtId)`.
//   1.3 `yearStart` (week 1): experience increments (≥ 12 weeks worked), seasons with the company, P1 recall rolls
//      (`staff-rehire`, p 0.75), former-employee re-entries.
//   3.3 `laborMarket`: labor season, wages, pool targets, churn, arrivals, referrals, re-entries, recruiter deliveries,
//      deposit forfeits.
//   7.3 `availability`: pending assignments, arrivals, morale, quits, absences, the training stub, unpaid refusal and
//      `staff.crewAvailableFrac`, availableFraction, camp occupancy, the small-crew test and each claim's and line's
//      supervisor (the supervision records `foremanFor` reads).
//   10.5 `hoursAndFatigue`: hours from §7 crew, §4 program crew, the site mechanic stub, office, cook and owner;
//      fatigue, skill growth, counters, `ctx.week.staff.hours`; injuries from P2.
//   16.9 `wrapUp`: departures, separations pruning, `employee.quit`, `crew.moraleLow`, `crew.noForeman` (its only
//      emitter, S08-20), `crew.leadHand`, the layoff and recall decisions with their signals (S12-2).
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function initPools(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§8) staff.initPools
}

export function yearStart(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§8) staff.yearStart
}

export function laborMarket(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§8) staff.laborMarket
}

export function availability(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§8) staff.availability
}

export function hoursAndFatigue(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§8) staff.hoursAndFatigue
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§8) staff.wrapUp
}
