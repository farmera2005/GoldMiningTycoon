// §2 history slice (DESIGN §2.5 `HistorySlice`, D-2.26; P1 contract §1.8): one weekly ring that starts with §10's
// pre-history at negative turns, plus annual rollups. Written in step 16 after §13's collation; values come from the
// owners' selectors and the week's handoffs, so the charts, the end report and the simulator read one structure.
import type { ClaimId } from '../../core/ids';
import type { Cents } from '../../core/money';

/** §10's 11 visible market series for one week. */
export interface MarketSnapshot {
  spot: number;
  goldIdx: number;
  cpiIndex: number;
  cpiYoY: number;
  baseRate: number;
  realRate: number;
  usdIdx: number;
  cbPublished: number;
  geoRisk: number;
  eqSentiment: number;
  dieselRack: number;
}

/** One claim's production in a week (claims active this week only). */
export interface ClaimWeekSnapshot {
  payWashedBcy: number;
  /** Cleanup weighings only (s02 #19). */
  weighedRawOz: number;
  /** Cleanup gross weighed raw × estimated fineness, plus this claim's sample lots (s01 #21). */
  fineOzRecovered: number;
  /** In-kind production interests taken off the top (S11-15). */
  inKindFineOz: number;
  inKindValueCents: Cents;
}

export interface CompanySnapshot {
  /** §11 cashOnHand. */
  cashCents: Cents;
  /** netWorth(state, 'scoring') (§1 1.13). */
  ownerNwCents: Cents;
  /** §1 1.13 companyNW. */
  companyNwCents: Cents;
  /** The week's totals (§7, §10). Pay gravel washed through the plants. */
  payWashedBcy: number;
  /** Cleanup weighings only, gross of in-kind interests; sample lots are `sampleRawOz` (s02 #19). */
  weighedRawOz: number;
  /** Estimated fine oz sold since the previous snapshot, action-time sales included (s02 #9). */
  soldFineOz: number;
  /** Sample concentrates weighed this week (prospecting gold, raw). */
  sampleRawOz: number;
  /** The production counter (s01 #21, S10-13): cleanup gross weighed raw × estimated fineness + sample lots. */
  fineOzRecovered: number;
  /** Claims active this week. */
  byClaim: Record<ClaimId, ClaimWeekSnapshot>;
}

export interface WeekSnapshot {
  turn: number;
  market: MarketSnapshot;
  /** Absent at negative turns (pre-history). */
  company?: CompanySnapshot;
}

export interface YearRollup {
  year: number;
  cashEndCents: Cents;
  ownerNwEndCents: Cents;
  companyNwEndCents: Cents;
  payWashedBcy: number;
  weighedRawOz: number;
  soldFineOz: number;
  revenueCents: Cents;
  netIncomeCents: Cents;
  /** §5 controlledClaimCount when the rollup is written. */
  claimsHeld: number;
  /** The year's production counter (s01 #20–21). */
  fineOzRecovered: number;
  /** §11 11.19.5 cash cost and all-in sustaining cost of the year (S11-15). */
  cashCostCents: Cents;
  aiscCents: Cents;
  /** Per fine oz recovered; null in a year that recovered none. */
  cashCostPerOzCents: Cents | null;
  aiscPerOzCents: Cents | null;
  /** Per claim, for §11's G&A allocation of older periods (S11-16). */
  byClaim: Record<ClaimId, { payWashedBcy: number; fineOzRecovered: number }>;
}

export interface HistorySlice {
  /** Ring of turns t − game.history.weeklyKeep … t, ascending. */
  weekly: WeekSnapshot[];
  /**
   * One per completed game year, never pruned. P1 rules write year Y's rollup in step 16 of turn 52Y (year Y + 1,
   * week 1), so actions taken after the week-52 pipeline count in their year (s02 #9); P0 rules wrote it at week 52.
   */
  annual: YearRollup[];
}

/** §13 ExplainRef 'history' metrics. */
export type HistoryMetric = keyof MarketSnapshot | keyof Omit<CompanySnapshot, 'byClaim'>;

export function emptyHistorySlice(): HistorySlice {
  return { weekly: [], annual: [] };
}
