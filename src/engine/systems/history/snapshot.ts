// Writing the history ring (DESIGN §2.5 HistorySlice, D-2.26). newGame writes §10's pre-history at turns −156…−1
// (market fields only) and turn 0; step 16 appends one snapshot per week and prunes to game.history.weeklyKeep + 1
// entries; week 52 adds the year's rollup. Values come from the owners' selectors, never from hidden fields.
import type { TuningResolved } from '../../../data/tuning';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import { cashOnHandCents, companyNetWorthCents, ownerNetWorthCents } from '../finance/netWorth';
import { periodTotals } from '../finance/periods';
import { WEEKS_PER_YEAR, yearWeekToTurn } from '../../core/calendar';
import type { CompanySnapshot, HistorySlice, MarketSnapshot, WeekSnapshot, YearRollup } from './types';

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

/** This week's company series from §11's selectors (P0 has no production, so the ops and sales totals are 0). */
export function companySnapshot(state: GameState): CompanySnapshot {
  return {
    cashCents: cashOnHandCents(state.finance),
    ownerNwCents: ownerNetWorthCents(state.finance, state.meta.tuning),
    companyNwCents: companyNetWorthCents(state.finance, state.meta.tuning),
    payWashedBcy: 0,
    weighedRawOz: 0,
    soldFineOz: 0,
    byClaim: {},
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

/**
 * The rollup of a completed game year (written at week 52, after that week's snapshot): end-of-year cash and net
 * worth, the year's production and sales from the weekly ring, revenue and net income from the company journal.
 * claimsHeld comes from §5 once tenures exist (P1).
 */
export function yearRollup(state: GameState, year: number): YearRollup {
  const first = yearWeekToTurn(year, 1);
  const last = first + WEEKS_PER_YEAR - 1;
  let payWashedBcy = 0;
  let weighedRawOz = 0;
  let soldFineOz = 0;
  let end: CompanySnapshot | undefined;
  for (const snap of state.history.weekly) {
    if (snap.turn < first || snap.turn > last || snap.company === undefined) continue;
    payWashedBcy += snap.company.payWashedBcy;
    weighedRawOz += snap.company.weighedRawOz;
    soldFineOz += snap.company.soldFineOz;
    end = snap.company;
  }
  const endSnap = end ?? companySnapshot(state);
  const totals = periodTotals(state.finance, first, last);
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
    claimsHeld: 0,
  };
}
