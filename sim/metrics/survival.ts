// BALANCE §5 metric definitions over one GameResult: loss, bankruptcy filings and B_N (§5.1), going-concern S_N
// (§5.2), the reorganization share RS_N, BK_N and its split, the NW ratio and owner-ahead share (§5.3), FSP (§5.6) and
// the production attempt (§5.7). BALANCE.md is canonical; each function names the clause it implements. Windows are
// cumulative game years (weeks 1–52 in every climate, BALANCE §1 rule 6), each ending at turn 52N − 1.
//
// Inputs the build cannot observe yet arrive as null (sim/metrics/observe.ts) and take their neutral value here,
// which is exact while the owning system is absent: no §7 operations means nothing was washed, no §5 tenure means no
// claim is held, no §9 fleet means no wash capacity and no distress fleet sale. So in P0 a passive run is never lost
// (B_N = 1) and never washes (S_N = 0).
import type { LiquidationPath } from '../../src/engine';
import type { GameResult, ReorgStatus, YearEnd } from './gameResult';
import { WEEKS_PER_YEAR } from './gameResult';

/** BALANCE §5.2: a fleet that "can wash ≥ 20 bcy/hr". */
export const GOING_CONCERN_MIN_WASH_BCY_HR = 20;
/** BALANCE §5.2: "company cash ≥ $150,000 × cpiIndex", in cents. */
export const GOING_CONCERN_MIN_CASH_CENTS = 150_000 * 100;

/** The last turn of game year N (week 52). */
export function yearEndTurn(n: number): number {
  return WEEKS_PER_YEAR * n - 1;
}

function yearEnd(r: GameResult, n: number): YearEnd | null {
  return r.byYear[n - 1] ?? null;
}

/** A game the harness aborted before year N's end has no measured year N. */
function unmeasured(r: GameResult, n: number): boolean {
  return yearEnd(r, n) === null || (r.abortedTurn !== null && r.abortedTurn < yearEndTurn(n));
}

const by = (turn: number | null, n: number): boolean => turn !== null && turn <= yearEndTurn(n);

/** §5.1 (a)–(c): lost (liquidated, ousted, or a scenario lost) by the end of year N. */
export function lostBy(r: GameResult, n: number): boolean {
  return r.lossCause !== null && by(r.lostTurn, n);
}

/** §5.1 (a): liquidated by the end of year N; every liquidation is a bankruptcy filing. */
export function liquidatedBy(r: GameResult, n: number): boolean {
  return r.lossCause === 'liquidated' && by(r.lostTurn, n);
}

/** §5.1: the liquidation's cause when liquidated by year N's end. */
export function liquidationCauseBy(r: GameResult, n: number): LiquidationPath | null {
  return liquidatedBy(r, n) ? r.liquidationCause : null;
}

/** §5.1: a Chapter 11 Subchapter V filing in years 1..N (P4+; whatever followed). */
export function reorgFiledBy(r: GameResult, n: number): boolean {
  return by(r.reorg.filedTurn, n);
}

/** §5.1: a bankruptcy filing of either kind (a liquidation or a reorganization filing) in years 1..N. */
export function filedBy(r: GameResult, n: number): boolean {
  return liquidatedBy(r, n) || reorgFiledBy(r, n);
}

/** §5.1 B_N: not lost at the end of year N and no filing of either kind in years 1..N. */
export function bN(r: GameResult, n: number): boolean | null {
  if (unmeasured(r, n)) return null;
  return !lostBy(r, n) && !filedBy(r, n);
}

/** §5.2 S_N: B_N, washed in some season 1..N, no distress fleet sale, and a going concern at the end of year N. */
export function sN(r: GameResult, n: number): boolean | null {
  const b = bN(r, n);
  if (b === null) return null;
  if (!b) return false;
  let washed = false;
  for (let k = 1; k <= n; k++) washed ||= (yearEnd(r, k)?.washedBcy ?? 0) > 0;
  if (!washed || by(r.distressFleetSaleTurn, n)) return false;
  const end = yearEnd(r, n) as YearEnd;
  const holdsOperation = (end.claimsHeld ?? 0) >= 1 && (end.fleetWashBcyHr ?? 0) >= GOING_CONCERN_MIN_WASH_BCY_HR;
  // The threshold is a money amount: round it to whole cents so 150,000 × 1.1 compares as $165,000.00 exactly.
  return holdsOperation || end.cashCents >= Math.round(GOING_CONCERN_MIN_CASH_CENTS * end.cpiIndex);
}

/** §5.1 RS_N. */
export function rsN(r: GameResult, n: number): boolean | null {
  return unmeasured(r, n) ? null : reorgFiledBy(r, n);
}

/** §5.1 BK_N: at least one filing of either kind in years 1..N. */
export function bkN(r: GameResult, n: number): boolean | null {
  return unmeasured(r, n) ? null : filedBy(r, n);
}

/** §5.2 the retreated share's indicator: B_N and not S_N. */
export function retreatedN(r: GameResult, n: number): boolean | null {
  const b = bN(r, n);
  const s = sN(r, n);
  return b === null || s === null ? null : b && !s;
}

/** §5.1 a reorganization case's status at a turn (open = filed or confirmed). */
export function reorgStatusAt(r: GameResult, turn: number): ReorgStatus {
  const c = r.reorg;
  const at = (t: number | null): boolean => t !== null && t <= turn;
  if (!at(c.filedTurn)) return 'none';
  if (at(c.convertedTurn)) return 'converted';
  if (at(c.completedTurn)) return 'completed';
  if (at(c.confirmedTurn)) return 'confirmed';
  return 'filed';
}

export type ReorgSplit = 'completed' | 'converted' | 'open';

/** §5.1: a filing's status at the end of year N, for BK_N's reorganization part; null when none was filed. */
export function reorgSplitBy(r: GameResult, n: number): ReorgSplit | null {
  const s = reorgStatusAt(r, yearEndTurn(n));
  if (s === 'none') return null;
  return s === 'completed' || s === 'converted' ? s : 'open';
}

/** §1 1.13 owner NW at the end of year N, cents. */
export function ownerNwBy(r: GameResult, n: number): number | null {
  return unmeasured(r, n) ? null : (yearEnd(r, n) as YearEnd).ownerNwCents;
}

/** §5.3 NW ratio = owner NW at year N's end ÷ start NW; real (÷ cpiIndex) from P5. */
export function nwRatioBy(r: GameResult, n: number): number | null {
  const nw = ownerNwBy(r, n);
  if (nw === null || r.startNwCents === null || r.startNwCents === 0) return null;
  const real = r.rules >= 5 ? (yearEnd(r, n) as YearEnd).cpiIndex : 1;
  return nw / real / r.startNwCents;
}

/** §5.3 owner-ahead: NW ratio ≥ 1.0. */
export function ownerAheadBy(r: GameResult, n: number): boolean | null {
  const ratio = nwRatioBy(r, n);
  return ratio === null ? null : ratio >= 1;
}

/** §5.6 FSP: year-1 company net income plus the change in unsold gold at the best visible net price, > 0. */
export function firstSeasonProfit(r: GameResult): boolean | null {
  const y1 = yearEnd(r, 1);
  if (y1 === null || y1.netIncomeCents === null || r.unsoldGoldChangeY1Cents === null) return null;
  return y1.netIncomeCents + r.unsoldGoldChangeY1Cents > 0;
}

/** §5.7 production attempt: washed bcy > 0 in season N (null while §7 is absent). */
export function productionAttemptIn(r: GameResult, n: number): boolean | null {
  if (unmeasured(r, n)) return null;
  const washed = (yearEnd(r, n) as YearEnd).washedBcy;
  return washed === null ? null : washed > 0;
}
