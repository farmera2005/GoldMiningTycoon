// Per-cell aggregation (DESIGN §2.12 "Outputs"; BALANCE §5, §6.6). By year: S_N, B_N, RS_N and the retreated share
// side by side; BK_N with its split into liquidations by cause and reorganization filings by status; owner NW and the
// NW ratio at p10/p50/p90; the owner-ahead share; the production-attempt rate; stops per year. Plus FSP, causes of
// loss, minimum cash, the option counts and the bot-defect counts. Proportions carry Wilson intervals and quantiles
// seeded bootstrap intervals (BALANCE §3.0); n/a figures are null.
import type { LiquidationPath, StopReasonKind } from '../../src/engine';
import { simConfig } from '../config';
import type { GameResult, LossCause } from './gameResult';
import { STOP_KINDS } from './gameResult';
import {
  bkN,
  bN,
  firstSeasonProfit,
  liquidationCauseBy,
  liquidatedBy,
  nwRatioBy,
  ownerAheadBy,
  ownerNwBy,
  productionAttemptIn,
  reorgSplitBy,
  retreatedN,
  rsN,
  sN,
  type ReorgSplit,
} from './survival';
import {
  bootstrapQuantile,
  mean,
  NA_ESTIMATE,
  proportion,
  quantile,
  round6,
  type Estimate,
  type Proportion,
} from './stats';

export const LIQUIDATION_CAUSES: readonly LiquidationPath[] = ['filed', 'involuntary', 'converted', 'p1Counter'];
export const REORG_SPLITS: readonly ReorgSplit[] = ['completed', 'converted', 'open'];
export const LOSS_CAUSES: readonly LossCause[] = ['liquidated', 'ousted', 'scenario'];

export interface QuantileSet {
  p10: Estimate;
  p50: Estimate;
  p90: Estimate;
}

export interface YearMetrics {
  year: number;
  S: Proportion;
  B: Proportion;
  RS: Proportion;
  retreated: Proportion;
  BK: Proportion;
  /** L_N by cause (filed, involuntary, converted, P1 counter) and in total. */
  liquidations: Record<LiquidationPath, Proportion>;
  liquidationsTotal: Proportion;
  /** RS_N's filings by status at the end of year N. */
  reorgFilings: Record<ReorgSplit, Proportion>;
  ownerNwUsd: QuantileSet;
  nwRatio: QuantileSet;
  ownerAhead: Proportion;
  productionAttempt: Proportion;
  washedBcyP50: Estimate;
  fineOzP50: Estimate;
  cashCostUsdPerOzP50: Estimate;
  aiscUsdPerOzP50: Estimate;
  /** Stops per game year over the years the run played in full (O-13). */
  stops: { mean: number | null; p50: number | null; offSeasonMean: number | null };
}

export interface CellMetrics {
  games: number;
  years: number;
  byYear: YearMetrics[];
  fsp: Proportion;
  /** Runs lost by the end, by cause (counts). */
  lossCauses: Record<LossCause, number>;
  minCashUsd: { p10: number | null; p50: number | null };
  claimsProfitableShare: Proportion;
  /** First-claim district → games; null while no game holds a claim. */
  districtSplit: Record<string, number> | null;
  ownerInjectionUsdP50: Estimate;
  /** Multi-claim options (D-2.32): the most plant lines on any claim, summed claim-weeks and mechanic-weeks. */
  options: { maxPlantLines: number; smallCrewClaimWeeks: number; poolMechanicWeeks: number };
  /** Mean reasons per game year by stop kind. */
  stopReasonsPerYear: Record<StopReasonKind, number | null>;
  longestQuietWeeksMax: number;
  rejectedActions: number;
  rejectionsByCode: Record<string, number>;
  abortedGames: number;
}

export interface AggregateOptions {
  /** Seeds the bootstrap; the cell's label, so two cells never share resamples. */
  cellKey: string;
  resamples?: number;
}

function quantileSet(values: readonly (number | null)[], key: string, resamples: number): QuantileSet {
  return {
    p10: bootstrapQuantile(values, 0.1, { resamples, seedKey: `${key}|p10` }),
    p50: bootstrapQuantile(values, 0.5, { resamples, seedKey: `${key}|p50` }),
    p90: bootstrapQuantile(values, 0.9, { resamples, seedKey: `${key}|p90` }),
  };
}

function medianOf(values: readonly (number | null)[], key: string, resamples: number): Estimate {
  return values.every((v) => v === null) ? NA_ESTIMATE : bootstrapQuantile(values, 0.5, { resamples, seedKey: key });
}

function byCause<K extends string>(keys: readonly K[], f: (k: K) => Proportion): Record<K, Proportion> {
  const out = {} as Record<K, Proportion>;
  for (const k of keys) out[k] = f(k);
  return out;
}

const usd = (cents: number | null): number | null => (cents === null ? null : cents / 100);

function yearMetrics(games: readonly GameResult[], n: number, key: string, resamples: number): YearMetrics {
  const measured = games.filter((g) => bN(g, n) !== null);
  const played = games.filter((g) => {
    const y = g.byYear[n - 1];
    return y !== undefined && !y.carried;
  });
  const stopsPlayed = played.map((g) => (g.byYear[n - 1] as NonNullable<GameResult['byYear'][number]>).stops);
  const offSeason = played.map((g) => g.byYear[n - 1]?.stopsOffSeason ?? null);
  const year = (g: GameResult) => g.byYear[n - 1];
  return {
    year: n,
    S: proportion(games.map((g) => sN(g, n))),
    B: proportion(games.map((g) => bN(g, n))),
    RS: proportion(games.map((g) => rsN(g, n))),
    retreated: proportion(games.map((g) => retreatedN(g, n))),
    BK: proportion(games.map((g) => bkN(g, n))),
    liquidations: byCause(LIQUIDATION_CAUSES, (c) => proportion(measured.map((g) => liquidationCauseBy(g, n) === c))),
    liquidationsTotal: proportion(measured.map((g) => liquidatedBy(g, n))),
    reorgFilings: byCause(REORG_SPLITS, (s) => proportion(measured.map((g) => reorgSplitBy(g, n) === s))),
    ownerNwUsd: quantileSet(
      games.map((g) => usd(ownerNwBy(g, n))),
      `${key}|ownerNw|y${n}`,
      resamples,
    ),
    nwRatio: quantileSet(
      games.map((g) => nwRatioBy(g, n)),
      `${key}|nwRatio|y${n}`,
      resamples,
    ),
    ownerAhead: proportion(games.map((g) => ownerAheadBy(g, n))),
    productionAttempt: proportion(games.map((g) => productionAttemptIn(g, n))),
    washedBcyP50: medianOf(
      games.map((g) => year(g)?.washedBcy ?? null),
      `${key}|washed|y${n}`,
      resamples,
    ),
    fineOzP50: medianOf(
      games.map((g) => year(g)?.fineOz ?? null),
      `${key}|fineOz|y${n}`,
      resamples,
    ),
    cashCostUsdPerOzP50: medianOf(
      games.map((g) => year(g)?.cashCostUsdPerOz ?? null),
      `${key}|cc|y${n}`,
      resamples,
    ),
    aiscUsdPerOzP50: medianOf(
      games.map((g) => year(g)?.aiscUsdPerOz ?? null),
      `${key}|aisc|y${n}`,
      resamples,
    ),
    stops: {
      mean: roundOrNull(mean(stopsPlayed)),
      p50: quantile(stopsPlayed, 0.5),
      offSeasonMean: offSeason.some((v) => v === null) ? null : roundOrNull(mean(offSeason as number[])),
    },
  };
}

function roundOrNull(x: number | null): number | null {
  return x === null ? null : round6(x);
}

function sumOrNull(values: readonly (number | null)[]): number | null {
  if (values.length === 0 || values.some((v) => v === null)) return null;
  return (values as number[]).reduce((a, b) => a + b, 0);
}

export function aggregateCell(games: readonly GameResult[], years: number, opts: AggregateOptions): CellMetrics {
  const resamples = opts.resamples ?? simConfig['sim.bootstrapResamples'];
  const byYear: YearMetrics[] = [];
  for (let n = 1; n <= years; n++) byYear.push(yearMetrics(games, n, opts.cellKey, resamples));

  const lossCauses = { liquidated: 0, ousted: 0, scenario: 0 } as Record<LossCause, number>;
  for (const g of games) if (g.lossCause !== null) lossCauses[g.lossCause]++;

  const claimFlags: (boolean | null)[] = [];
  for (const g of games) {
    if (g.claimsAcquired === null || g.claimsProfitable === null) claimFlags.push(null);
    else for (let c = 0; c < g.claimsAcquired; c++) claimFlags.push(c < g.claimsProfitable);
  }

  let districtSplit: Record<string, number> | null = null;
  for (const g of games) {
    if (g.district === null) continue;
    districtSplit ??= {};
    districtSplit[g.district] = (districtSplit[g.district] ?? 0) + 1;
  }

  const playedYears = games.reduce((a, g) => a + g.byYear.filter((y) => !y.carried).length, 0);
  const stopReasonsPerYear = {} as Record<StopReasonKind, number | null>;
  for (const k of STOP_KINDS) {
    const total = games.reduce((a, g) => a + g.stopsByKind[k], 0);
    stopReasonsPerYear[k] = playedYears === 0 ? null : round6(total / playedYears);
  }

  const rejectionsByCode: Record<string, number> = {};
  for (const g of games) {
    for (const code of Object.keys(g.rejectionsByCode).sort()) {
      rejectionsByCode[code] = (rejectionsByCode[code] ?? 0) + (g.rejectionsByCode[code] ?? 0);
    }
  }

  const minCash = games.map((g) => g.minCashCents / 100);
  return {
    games: games.length,
    years,
    byYear,
    fsp: proportion(games.map(firstSeasonProfit)),
    lossCauses,
    minCashUsd: { p10: quantile(minCash, 0.1), p50: quantile(minCash, 0.5) },
    claimsProfitableShare: proportion(claimFlags),
    districtSplit,
    ownerInjectionUsdP50: medianOf(
      games.map((g) => usd(g.ownerInjectionCents)),
      `${opts.cellKey}|injection`,
      resamples,
    ),
    options: {
      maxPlantLines: games.reduce((a, g) => Math.max(a, g.options.maxPlantLines), 0),
      smallCrewClaimWeeks: sumOrNull(games.map((g) => g.options.smallCrewClaimWeeks)) ?? 0,
      poolMechanicWeeks: sumOrNull(games.map((g) => g.options.poolMechanicWeeks)) ?? 0,
    },
    stopReasonsPerYear,
    longestQuietWeeksMax: games.reduce((a, g) => Math.max(a, g.longestQuietWeeks), 0),
    rejectedActions: games.reduce((a, g) => a + g.rejectedActions, 0),
    rejectionsByCode,
    abortedGames: games.filter((g) => g.abortReason !== null).length,
  };
}
