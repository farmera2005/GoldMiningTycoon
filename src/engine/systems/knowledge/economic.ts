// The economic layer (DESIGN §4.7): planning cost per pay bcy, the cutoff applied to block P50 grade (D-4.5), the
// minable set and its ounces, recoverable and fine ounces. §4 is the single owner of the minable set, the cutoff and
// the planning cost (§5 values claims on them). Reruns on a planning change or a 2% move of the planning price; the
// statistical layer never reruns for price (D-4.41).
import { exp, log, pow, sqrt } from '../../core/dmath';
import { createWeakMemo } from '../../core/memo';
import { BCY_PER_ACRE_FT } from '../world/constants';
import type { SizeRecord } from '../world/types';
import { summarizeSet, type SetSummary } from './aggregate';
import type { EstimatorParams } from './params';
import type { StatLayer } from './statistical';
import type { PlanningAssumptions, PlanningContext } from './types';

// The minable set's ounces depend only on the statistical layer, the set and the mining-loss scale. A planning-price
// move that leaves the set unchanged (the usual weekly case) reuses them instead of re-running the O(H·m²)
// aggregation and its mixture quantiles (§2.13: ≤ 0.5 ms per economic-layer rerun). Keyed by the statistical layer
// object (immutable, itself memoized); a cold cache recomputes the identical summary.
const minableSummaryMemo = createWeakMemo<StatLayer, { readonly bySet: Record<string, SetSummary> }>(
  'knowledge.minableSummary',
);

function minableSummary(stat: StatLayer, minable: Uint8Array, scale: number): SetSummary {
  const cache = minableSummaryMemo.getOrCompute(stat, () => ({ bySet: {} })).bySet;
  const key = `${minable.join('')}|${scale}`;
  const hit = cache[key];
  if (hit !== undefined) return hit;
  const sum = summarizeSet(stat.agg, stat.A, minable, scale);
  cache[key] = sum;
  return sum;
}

export interface BlockEcon {
  readonly costPerPayBcy: Float64Array;
  readonly margin: Float64Array;
  readonly cutoff: Float64Array;
  readonly recovery: Float64Array;
  readonly ob50: Float64Array;
  readonly obP10: Float64Array;
  readonly obP90: Float64Array;
  readonly strip50: Float64Array;
  readonly minable: Uint8Array;
}

export interface EconLayer {
  readonly priceUsed: number;
  readonly blocks: BlockEcon;
  readonly minable: SetSummary;
  readonly minableBcy: number;
  readonly avgStrip: number;
  readonly avgMinableGradeP50: number;
  readonly recovery: number;
  readonly recoverableRawOzP50: number;
  readonly fineOzP50: number;
  readonly costUsdPerPayBcyM: number;
}

/** The planning price on a 2% log grid around refSpot (§4.7 Repricing); a player's fixed price is used as entered. */
export function planningPrice(planning: PlanningAssumptions, ctx: PlanningContext, step: number): number {
  if (typeof planning.price === 'object') return planning.price.usdPerFineOz;
  const p = planning.price === 'ema13' ? ctx.ema13UsdPerFineOz : ctx.spotUsdPerFineOz;
  const ref = ctx.refSpotUsdPerFineOz;
  const ls = log(1 + step);
  return ref * pow(1 + step, Math.round(log(p / ref) / ls));
}

/** The default planning case of a climate band (§4.7: north wash 12.00 / strip 2.50, arid 14.00 / 2.20), × cpiIndex. */
export function defaultPlanning(
  params: EstimatorParams,
  band: keyof EstimatorParams['planWashUsd'],
  cpiIndex = 1,
): PlanningAssumptions {
  const wash = params.planWashUsd[band];
  const strip = params.planStripUsd[band];
  if (wash === undefined || strip === undefined) throw new RangeError(`no planning costs for climate band ${band}`);
  return {
    price: 'ema13',
    payable: params.planPayable,
    recovery: 'auto',
    mineWashUsdPerPayBcy: wash * cpiIndex,
    stripUsdPerBcy: strip * cpiIndex,
    miningLossFrac: params.planMiningLossFrac,
    dilutionFrac: params.planDilutionFrac,
  };
}

function recoveryOf(mix: SizeRecord, rec: SizeRecord, clay: number, recClay: number): number {
  return (
    (mix.coarse * rec.coarse + mix.medium * rec.medium + mix.fine * rec.fine + mix.ultrafine * rec.ultrafine) *
    (1 - recClay * clay)
  );
}

export function economicLayer(stat: StatLayer, planning: PlanningAssumptions, ctx: PlanningContext): EconLayer {
  const model = stat.model;
  const P = model.params;
  const n = model.n;
  const price = planningPrice(planning, ctx, P.repriceStep);
  const fin = stat.fineness.p50;
  const g = P.ground;
  const costPerPayBcy = new Float64Array(n);
  const margin = new Float64Array(n);
  const cutoff = new Float64Array(n);
  const recovery = new Float64Array(n);
  const ob50 = new Float64Array(n);
  const obP10 = new Float64Array(n);
  const obP90 = new Float64Array(n);
  const strip50 = new Float64Array(n);
  const minable = new Uint8Array(n);
  const geo = stat.geo;
  for (let b = 0; b < n; b++) {
    const D50 = exp(geo.D.mean[b] as number);
    const T50 = stat.T50[b] as number;
    // Overburden stripped since the anchor lowers the surface; the sd is unchanged (stripping is known, s04 #1).
    const ob = Math.max(0, D50 - T50 + geo.bHat - (stat.obShiftFt[b] as number));
    const sdOb = sqrt(D50 * D50 * (geo.D.varDiag[b] as number) + T50 * T50 * (geo.T.varDiag[b] as number));
    ob50[b] = ob;
    obP10[b] = Math.max(0, ob - 1.2816 * sdOb);
    obP90[b] = Math.max(0, ob + 1.2816 * sdOb);
    strip50[b] = ob / T50;
    const fr = stat.ground.frozen[b] as number;
    const groundStrip = 1 + g.stripFrozen * fr + g.stripCement * (stat.ground.cement[b] as number);
    const groundWash =
      1 +
      g.washBoulders * (stat.ground.boulders[b] as number) +
      g.washClay * (stat.ground.clay[b] as number) +
      g.washFrozen * fr;
    const cost =
      planning.mineWashUsdPerPayBcy * groundWash + planning.stripUsdPerBcy * groundStrip * (strip50[b] as number);
    const rec =
      planning.recovery === 'auto'
        ? recoveryOf(stat.sizeMixP50, ctx.recoveryBySize, stat.ground.clay[b] as number, g.recClay)
        : planning.recovery;
    const value = rec * fin * price * planning.payable;
    costPerPayBcy[b] = cost;
    recovery[b] = rec;
    margin[b] = (stat.gradeQ.p50[b] as number) * value - cost;
    cutoff[b] = cost / value;
    minable[b] = (margin[b] as number) >= 0 && stat.agg.alive[b] === 1 ? 1 : 0;
  }
  const loss = planning.miningLossFrac;
  const any = minable.some((x) => x === 1);
  const sum = minableSummary(stat, minable, 1 - loss);
  let payA = 0;
  let obA = 0;
  let costW = 0;
  let recW = 0;
  let gradeW = 0;
  let bcy = 0;
  for (let b = 0; b < n; b++) {
    const use = any ? minable[b] === 1 : true;
    if (!use) continue;
    const ac = model.acres[b] as number;
    const T50 = stat.T50[b] as number;
    const w = T50 * ac;
    payA += w;
    obA += (ob50[b] as number) * ac;
    costW += (costPerPayBcy[b] as number) * w;
    recW += (recovery[b] as number) * w;
    const fr = stat.fRem[b] as number;
    gradeW += (stat.gradeQ.p50[b] as number) * w * fr;
    if (any) bcy += T50 * BCY_PER_ACRE_FT * ac * fr;
  }
  const rec = payA > 0 ? recW / payA : 0;
  const remPay = (() => {
    let s = 0;
    for (let b = 0; b < n; b++)
      if (!any || minable[b] === 1)
        s += (stat.T50[b] as number) * (model.acres[b] as number) * (stat.fRem[b] as number);
    return s;
  })();
  const minableBcy = bcy * (1 + planning.dilutionFrac) * (1 - loss);
  return {
    priceUsed: price,
    blocks: { costPerPayBcy, margin, cutoff, recovery, ob50, obP10, obP90, strip50, minable },
    minable: sum,
    minableBcy,
    avgStrip: payA > 0 ? obA / payA : 0,
    avgMinableGradeP50: remPay > 0 ? gradeW / remPay : 0,
    recovery: rec,
    recoverableRawOzP50: sum.p50 * rec,
    fineOzP50: sum.p50 * rec * fin,
    costUsdPerPayBcyM: payA > 0 ? costW / payA : 0,
  };
}
