// Writing the history ring (DESIGN §2.5 HistorySlice, D-2.26; P1 contract §1.8, §4.14). newGame writes §10's
// pre-history at turns −156…−1 (market fields only) and turn 0; step 16 appends one snapshot per week, prunes to
// game.history.weeklyKeep + 1 entries and writes the completed year's rollup. Values come from the owners' selectors and
// from the week's handoffs (`StepContext.week`), never from hidden fields:
//   - cash and net worth: §11's selectors;
//   - pay washed: §7's week results (ctx.week.ops.results);
//   - weighed raw oz, fine oz recovered and in-kind interests: the step-12 cleanup chain (ctx.week.cleanup.results);
//   - sample raw oz: §4's sample lots (ctx.week.knowledge.sampleLots);
//   - fine oz sold: §10's accumulator, which counts action-time sales too and is reset after the read (s02 #9).
import type { TuningResolved } from '../../../data/tuning';
import { WEEKS_PER_YEAR, yearWeekToTurn } from '../../core/calendar';
import type { ClaimId } from '../../core/ids';
import { sortedKeys } from '../../core/iter';
import { cents, roundCents, ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import type { WeekScratch } from '../../turn/types';
import { periodCostTotals } from '../finance/costTotals';
import { periodTotals } from '../finance/periods';
import { financeSelectors } from '../finance/select';
import { weekSalesSinceSnapshot } from '../gold/weekSales';
import { landSelectors } from '../land/select';
import type {
  ClaimWeekSnapshot,
  CompanySnapshot,
  HistorySlice,
  MarketSnapshot,
  WeekSnapshot,
  YearRollup,
} from './types';

/**
 * The flat market of P0–P4 (§10 10.5: "P1 skips all of this: the history is a flat line"): opening spot, goldIdx 1.0,
 * CPI 1.000 with no change, the neutral rates (real = base − trend inflation), USD index 100, central-bank buying at
 * its normal level, the quiet geopolitical baseline, neutral equity mood and the diesel rack on its anchor. §10
 * replaces it with its own series reader when the price model ships (P5).
 */
export function flatMarketSnapshot(tuning: TuningResolved): MarketSnapshot {
  const baseRate = tuningNumber(tuning, 'market.openingBaseRate');
  return {
    spot: tuningNumber(tuning, 'market.openingSpotUsdPerFineOz'),
    goldIdx: 1,
    cpiIndex: 1,
    cpiYoY: 0,
    baseRate,
    realRate: baseRate - tuningNumber(tuning, 'market.cpiTrendAnnual'),
    usdIdx: 100,
    cbPublished: tuningNumber(tuning, 'market.cb.normal'),
    geoRisk: tuningNumber(tuning, 'market.geo.baseline'),
    eqSentiment: tuningNumber(tuning, 'market.eq.mean'),
    dieselRack: tuningNumber(tuning, 'market.openingDieselRackUsdPerGal'),
  };
}

/** This week's visible market series (P0: the flat market). */
export function marketSnapshot(state: GameState): MarketSnapshot {
  return flatMarketSnapshot(state.meta.tuning);
}

function emptyClaimWeek(): ClaimWeekSnapshot {
  return { payWashedBcy: 0, weighedRawOz: 0, fineOzRecovered: 0, inKindFineOz: 0, inKindValueCents: ZERO_CENTS };
}

/** The week's production from the handoffs, in a fixed order (claims ascending, then chain order) for exact sums. */
interface WeekProduction {
  payWashedBcy: number;
  weighedRawOz: number;
  sampleRawOz: number;
  fineOzRecovered: number;
  byClaim: Record<ClaimId, ClaimWeekSnapshot>;
}

function weekProduction(week: WeekScratch | null): WeekProduction {
  const out: WeekProduction = { payWashedBcy: 0, weighedRawOz: 0, sampleRawOz: 0, fineOzRecovered: 0, byClaim: {} };
  if (week === null) return out;
  const claims: Record<ClaimId, ClaimWeekSnapshot> = {};
  const claim = (id: ClaimId): ClaimWeekSnapshot => (claims[id] ??= emptyClaimWeek());
  for (const claimId of sortedKeys(week.ops.results)) {
    const r = week.ops.results[claimId];
    if (r === undefined) continue;
    out.payWashedBcy += r.payWashedBcy;
    claim(claimId).payWashedBcy += r.payWashedBcy;
  }
  for (const rec of week.cleanup.results) {
    const c = claim(rec.claimId);
    out.weighedRawOz += rec.result.rawOzWeighed;
    out.fineOzRecovered += rec.fineOzRecovered;
    c.weighedRawOz += rec.result.rawOzWeighed;
    c.fineOzRecovered += rec.fineOzRecovered;
    c.inKindFineOz += rec.inKindFineOz;
    c.inKindValueCents = cents(c.inKindValueCents + rec.inKindValueCents);
  }
  for (const lot of week.knowledge.sampleLots) {
    out.sampleRawOz += lot.weighedRawOz;
    out.fineOzRecovered += lot.fineOzRecovered;
    claim(lot.claimId).fineOzRecovered += lot.fineOzRecovered;
  }
  // Insert in ascending id order, so the record's key order never depends on which handoff named a claim first.
  for (const claimId of sortedKeys(claims)) out.byClaim[claimId] = claims[claimId] as ClaimWeekSnapshot;
  return out;
}

/**
 * This week's company series. `week` is the pipeline's scratch (null outside a pipeline, e.g. newGame's turn-0
 * snapshot, which has no production).
 */
export function companySnapshot(state: GameState, week: WeekScratch | null = null): CompanySnapshot {
  const p = weekProduction(week);
  return {
    cashCents: financeSelectors.cashOnHand(state),
    ownerNwCents: financeSelectors.netWorth(state, 'scoring'),
    companyNwCents: financeSelectors.companyNetWorth(state),
    payWashedBcy: p.payWashedBcy,
    weighedRawOz: p.weighedRawOz,
    soldFineOz: weekSalesSinceSnapshot(state).fineOz,
    sampleRawOz: p.sampleRawOz,
    fineOzRecovered: p.fineOzRecovered,
    byClaim: p.byClaim,
  };
}

/** §10's visible pre-history at turns −keepWeeks … −1 (P0–P4: flat). */
export function preHistory(tuning: TuningResolved): WeekSnapshot[] {
  const keep = tuningNumber(tuning, 'market.preHistory.keepWeeks');
  const out: WeekSnapshot[] = [];
  for (let turn = -keep; turn < 0; turn++) out.push({ turn, market: flatMarketSnapshot(tuning) });
  return out;
}

/** Appends the week's snapshot and drops turns older than turn − weeklyKeep (mutates a draft). */
export function appendWeekly(history: HistorySlice, snap: WeekSnapshot, weeklyKeep: number): void {
  const last = history.weekly[history.weekly.length - 1];
  if (last !== undefined && last.turn >= snap.turn) {
    throw new Error(`history: snapshot for turn ${snap.turn} after turn ${last.turn}`);
  }
  history.weekly.push(snap);
  const oldest = snap.turn - weeklyKeep;
  let drop = 0;
  while (drop < history.weekly.length && (history.weekly[drop] as WeekSnapshot).turn < oldest) drop++;
  if (drop > 0) history.weekly.splice(0, drop);
}

/** Per fine oz, or null when nothing was recovered (a cost per ounce of no ounces is undefined, not zero). */
function perOz(costCents: Cents, fineOz: number): Cents | null {
  return fineOz > 0 ? roundCents(costCents / fineOz) : null;
}

/**
 * The rollup of a completed game year: end-of-year cash and net worth from the year's last snapshot (turn 52Y − 1),
 * the year's production and sales from the weekly ring, revenue and net income from the company journal, the cost
 * totals from §11 and the claims held from §5 when it is written.
 */
export function yearRollup(state: GameState, year: number): YearRollup {
  const first = yearWeekToTurn(year, 1);
  const last = first + WEEKS_PER_YEAR - 1;
  let payWashedBcy = 0;
  let weighedRawOz = 0;
  let soldFineOz = 0;
  let fineOzRecovered = 0;
  const claims: Record<ClaimId, { payWashedBcy: number; fineOzRecovered: number }> = {};
  let end: CompanySnapshot | undefined;
  for (const snap of state.history.weekly) {
    if (snap.turn < first || snap.turn > last || snap.company === undefined) continue;
    const c = snap.company;
    payWashedBcy += c.payWashedBcy;
    weighedRawOz += c.weighedRawOz;
    soldFineOz += c.soldFineOz;
    fineOzRecovered += c.fineOzRecovered;
    for (const claimId of sortedKeys(c.byClaim)) {
      const w = c.byClaim[claimId] as ClaimWeekSnapshot;
      const y = (claims[claimId] ??= { payWashedBcy: 0, fineOzRecovered: 0 });
      y.payWashedBcy += w.payWashedBcy;
      y.fineOzRecovered += w.fineOzRecovered;
    }
    end = c;
  }
  const byClaim: YearRollup['byClaim'] = {};
  for (const claimId of sortedKeys(claims)) byClaim[claimId] = claims[claimId] as YearRollup['byClaim'][ClaimId];
  const endSnap = end ?? companySnapshot(state);
  const totals = periodTotals(state.finance, first, last);
  const costs = periodCostTotals(state, first, last);
  return {
    year,
    cashEndCents: endSnap.cashCents,
    ownerNwEndCents: endSnap.ownerNwCents,
    companyNwEndCents: endSnap.companyNwCents,
    payWashedBcy,
    weighedRawOz,
    soldFineOz,
    revenueCents: totals.revenueCents,
    netIncomeCents: totals.netIncomeCents,
    claimsHeld: landSelectors.controlledClaimCount(state),
    fineOzRecovered,
    cashCostCents: costs.cashCostCents,
    aiscCents: costs.aiscCents,
    cashCostPerOzCents: perOz(costs.cashCostCents, fineOzRecovered),
    aiscPerOzCents: perOz(costs.aiscCents, fineOzRecovered),
    byClaim,
  };
}
