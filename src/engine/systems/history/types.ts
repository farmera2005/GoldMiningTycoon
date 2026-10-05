// §2 history slice (DESIGN §2.5 `HistorySlice`, D-2.26): one weekly ring that starts with §10's pre-history at
// negative turns, plus annual rollups. Written in step 16 after §13's collation; values come from the owners'
// selectors, so the charts, the end report and the simulator read one structure.
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

export interface CompanySnapshot {
  /** §11 cashOnHand. */
  cashCents: Cents;
  /** netWorth(state, 'scoring') (§1 1.13). */
  ownerNwCents: Cents;
  /** §1 1.13 companyNW. */
  companyNwCents: Cents;
  /** The week's totals (§7, §10). */
  payWashedBcy: number;
  weighedRawOz: number;
  soldFineOz: number;
  /** Claims active this week. */
  byClaim: Record<ClaimId, { payWashedBcy: number; weighedRawOz: number }>;
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
  claimsHeld: number;
}

export interface HistorySlice {
  /** Ring of turns t − game.history.weeklyKeep … t, ascending. */
  weekly: WeekSnapshot[];
  /** One per completed game year (written at week 52), never pruned. */
  annual: YearRollup[];
}

/** §13 ExplainRef 'history' metrics. */
export type HistoryMetric = keyof MarketSnapshot | keyof Omit<CompanySnapshot, 'byClaim'>;

export function emptyHistorySlice(): HistorySlice {
  return { weekly: [], annual: [] };
}
