// DESIGN §7 7.6.6 water. A wash plant circulates ~15 gpm per bcy/hr of throughput (D-7.18); recycling cuts the fresh
// draw to the makeup share but circulates more water; pumps, the source, wells and water trucks each cap the circulating
// flow, and the plant runs at what the water allows (or runs lean, at a recovery cost). Lines share one water budget
// pro rata to demand (D-7.49). Wells are §7's priced gamble on hidden yield (D-7.30).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { ClimateBandK, Prep } from './types';

/** A claim may drill two wells: the first reveals §3's hidden yield, the second shares the aquifer (7.6.6, WELL_LIMIT). */
export const MAX_WELLS_PER_CLAIM = 2;

export interface WaterNeedInput {
  /** bcy-weighted pad clay. */
  clay: number;
  prep: Prep;
  /** r: share of the circulating water recycled (recirculationShare). */
  recycleShare: number;
  /** The line's plant has a concentrator online (fluidisation water). */
  hasConcentrator: boolean;
}

/**
 * q = ops.gpmPerBcyHr × (1 + clay × ops.clayWaterAdd) × ops.prepWaterMult[prep] × (1 + ops.recycleExtraFlow × r)
 * × (concentrator ? 1 + ops.concentratorWaterAdd : 1), gpm per bcy/hr (7.6.6). A dry washer needs none (prep mult 0).
 */
export function waterNeedPerBcyHr(
  input: WaterNeedInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const clayF = 1 + Math.max(0, input.clay) * p.clayWaterAdd;
  const prepF = p.prepWaterMult[input.prep];
  const recycleF = 1 + p.recycleExtraFlow * Math.max(0, input.recycleShare);
  const concF = input.hasConcentrator ? 1 + p.concentratorWaterAdd : 1;
  const v = p.gpmPerBcyHr * clayF * prepF * recycleF * concF;
  const calc = ex.on
    ? kNode(ex, 'Process water per bcy/hr (gpm)', 'product', 'gpm', v, [
        kTune(ex, 'ops.gpmPerBcyHr', p.gpmPerBcyHr, 'gpm', 'Design water per bcy/hr'),
        kNode(ex, 'Clay', 'sum', 'mult', clayF, [
          kLeaf(ex, 'Pad clay', input.clay, 'ratio'),
          kTune(ex, 'ops.clayWaterAdd', p.clayWaterAdd, 'ratio', 'Extra water per unit of clay'),
        ]),
        kTune(ex, `ops.prepWaterMult.${input.prep}`, prepF, 'mult', `Feed prep (${input.prep})`),
        kNode(ex, 'Recycle extra flow', 'sum', 'mult', recycleF, [
          kLeaf(ex, 'Recycled share', input.recycleShare, 'pct'),
          kTune(ex, 'ops.recycleExtraFlow', p.recycleExtraFlow, 'ratio', 'Extra flow at full recycle'),
        ]),
        input.hasConcentrator
          ? kTune(ex, 'ops.concentratorWaterAdd', p.concentratorWaterAdd, 'ratio', 'Concentrator fluidisation water')
          : undefined,
      ])
    : undefined;
  return calcResult(v, calc);
}

/**
 * r (7.6.6): closed loop recycles everything but makeup (1); discharge mode recycles the plan's share, clamped to
 * ops.recycleMax. P2+: 0 while the pond is frozen or full (`pondUsable` false); P1 assumes the pond is adequate.
 */
export function recirculationShare(
  dischargeMode: 'closedLoop' | 'discharge',
  planRecirculation: number,
  pondUsable: boolean,
  p: OpsKernelParams,
): number {
  if (!pondUsable) return 0;
  return dischargeMode === 'closedLoop' ? 1 : Math.min(p.recycleMax, Math.max(0, planRecirculation));
}

/** m = ops.makeupFrac[climate band]: consumptive loss share of the circulating flow. */
export function makeupFrac(band: ClimateBandK, p: OpsKernelParams): number {
  return p.makeupFrac[band];
}

/** s = (1 − r) + r × m: the fresh share of the circulating flow. */
export function freshShare(recycleShare: number, makeup: number): number {
  const r = Math.min(1, Math.max(0, recycleShare));
  return 1 - r + r * makeup;
}

/**
 * Drilled-well supply: Σ yield × (0.9 + 0.1 × min(streamFlowFactor, 1.5)) × the water-availability hook. §3's
 * waterAvailableGpm is final (it already applies that hook to springs and §3 wells), so §7 applies the hook only to its
 * own drilled wells, exactly once.
 */
export function wellsSupplyGpm(yieldsGpm: readonly number[], streamFlowFactor: number, waterAvailMult: number): number {
  const sff = 0.9 + 0.1 * Math.min(Math.max(0, streamFlowFactor), 1.5);
  let sum = 0;
  for (const y of yieldsGpm) sum += Math.max(0, y);
  return sum * sff * waterAvailMult;
}

export interface WaterTruckSupply {
  loadsPerHour: number;
  /** gpm delivered by the trucks on rental (averaged over the hour). */
  gpm: number;
}

/**
 * Q_truck = waterTrucksPerDay × ops.waterTruckGal × loadsPerHour / 60 with loadsPerHour = 1 / (fill time + round trip
 * to §3's nearest fill point at ops.waterTruckMph).
 */
export function waterTruckSupply(trucksPerDay: number, nearestFillMi: number, p: OpsKernelParams): WaterTruckSupply {
  const hours = p.waterTruckFillHr + (2 * Math.max(0, nearestFillMi)) / p.waterTruckMph;
  const loadsPerHour = hours > 0 ? 1 / hours : 0;
  return { loadsPerHour, gpm: (Math.max(0, trucksPerDay) * p.waterTruckGal * loadsPerHour) / 60 };
}

/**
 * Q_src = min(Q_draw, §6 maxWaterGpm when strict) + Q_truck, where Q_draw = §3 waterAvailableGpm (as returned) + the
 * drilled wells' supply.
 */
export function sourceGpm(
  s3AvailableGpm: number,
  wellsGpm: number,
  maxWaterGpm: number | null,
  truckGpm: number,
): number {
  const draw = Math.max(0, s3AvailableGpm) + Math.max(0, wellsGpm);
  return (maxWaterGpm === null ? draw : Math.min(draw, Math.max(0, maxWaterGpm))) + Math.max(0, truckGpm);
}

/** Pump stages: ceil((ops.plantTdhFt + §3 benchLiftFt) / ops.pumpStageHeadFt); bench claims pump in series (D-7.34). */
export function pumpStages(benchLiftFt: number, p: OpsKernelParams): number {
  return Math.max(1, Math.ceil((p.plantTdhFt + Math.max(0, benchLiftFt)) / p.pumpStageHeadFt));
}

/** Q_pump = Σ pumpGpm (§9, rated at 100 ft TDH) × u / stages, gpm. */
export function pumpFlowGpm(pumps: readonly { gpm: number; u: number }[], stages: number): number {
  let q = 0;
  for (const pm of pumps) q += pm.gpm * Math.max(0, pm.u);
  return stages > 0 ? q / stages : 0;
}

/** Q_circ = min(Q_pump, Q_src / s): the circulating flow the system can sustain. */
export function circulatingGpm(pumpGpm: number, srcGpm: number, fresh: number): number {
  if (!(fresh > 0)) return Math.max(0, pumpGpm);
  return Math.max(0, Math.min(pumpGpm, srcGpm / fresh));
}

/** W_water = Q_circ / q, bcy/hr; Infinity when the plant needs no water (a dry washer). */
export function waterLimitedRate(circGpm: number, qGpmPerBcyHr: number): number {
  return qGpmPerBcyHr > 0 ? Math.max(0, circGpm) / qGpmPerBcyHr : Number.POSITIVE_INFINITY;
}

/** runLean: the plant may run up to W_water / ops.leanWaterFloor. */
export function leanRateLimit(waterLimitedBcyHr: number, p: OpsKernelParams): number {
  return waterLimitedBcyHr / p.leanWaterFloor;
}

/** ω = min(1, Q_circ / (rate × q)): pumped water is throttled to need, so ω < 1 only when running lean. */
export function waterRatio(circGpm: number, rateBcyHr: number, qGpmPerBcyHr: number): number {
  const need = rateBcyHr * qGpmPerBcyHr;
  return need > 0 ? Math.min(1, Math.max(0, circGpm) / need) : 1;
}

export interface WaterBalanceInput {
  /** §3 waterAvailableGpm (final). */
  s3AvailableGpm: number;
  /** Drilled wells' revealed yields. */
  wellYieldsGpm: readonly number[];
  streamFlowFactor: number;
  /** The water-availability hook value for the claim. */
  waterAvailMult: number;
  /** §6 maxWaterGpm in strict mode, else null. */
  maxWaterGpm: number | null;
  waterTrucksPerDay: number;
  nearestFillMi: number;
  benchLiftFt: number;
  pumps: readonly { gpm: number; u: number }[];
  /** s (freshShare). */
  freshShare: number;
}

export interface WaterBalance {
  wellGpm: number;
  truckGpm: number;
  sourceGpm: number;
  stages: number;
  pumpGpm: number;
  circGpm: number;
}

/** The claim's circulating water for one hour-block (7.6.6), with its explanation. */
export function waterBalance(
  input: WaterBalanceInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<WaterBalance> {
  const wellGpm = wellsSupplyGpm(input.wellYieldsGpm, input.streamFlowFactor, input.waterAvailMult);
  const truck = waterTruckSupply(input.waterTrucksPerDay, input.nearestFillMi, p);
  const src = sourceGpm(input.s3AvailableGpm, wellGpm, input.maxWaterGpm, truck.gpm);
  const stages = pumpStages(input.benchLiftFt, p);
  const pumpGpm = pumpFlowGpm(input.pumps, stages);
  const circGpm = circulatingGpm(pumpGpm, src, input.freshShare);
  const v: WaterBalance = { wellGpm, truckGpm: truck.gpm, sourceGpm: src, stages, pumpGpm, circGpm };
  const calc = ex.on
    ? kNode(ex, 'Circulating water', 'min', 'gpm', circGpm, [
        kNode(ex, 'Pumps', 'ratio', 'gpm', pumpGpm, [kLeaf(ex, 'Pump stages in series', stages, 'count')]),
        kNode(ex, 'Source ÷ fresh share', 'ratio', 'gpm', input.freshShare > 0 ? src / input.freshShare : src, [
          kNode(ex, 'Fresh water available', 'sum', 'gpm', src, [
            kLeaf(ex, 'Creek, spring or well (§3)', input.s3AvailableGpm, 'gpm'),
            kLeaf(ex, 'Drilled wells', wellGpm, 'gpm'),
            input.maxWaterGpm === null ? undefined : kLeaf(ex, 'Permit cap', input.maxWaterGpm, 'gpm'),
            kNode(ex, 'Water trucks', 'product', 'gpm', truck.gpm, [
              kLeaf(ex, 'Trucks per day', input.waterTrucksPerDay, 'count'),
              kTune(ex, 'ops.waterTruckGal', p.waterTruckGal, 'gal', 'Truck tank'),
              kLeaf(ex, 'Loads per hour', truck.loadsPerHour, 'ratio'),
            ]),
          ]),
          kLeaf(ex, 'Fresh share of circulating flow', input.freshShare, 'pct'),
        ]),
      ])
    : undefined;
  return calcResult(v, calc);
}

/**
 * Lines share the circulating water pro rata to demand (D-7.49): with Σ D ≤ Q_circ each line gets its demand, otherwise
 * share_ℓ = Q_circ × D_ℓ / Σ D. A line with no demand this hour (cleanup, move, standby, empty pad) gets none.
 */
export function shareWater(demandsGpm: readonly number[], circGpm: number): number[] {
  let total = 0;
  for (const d of demandsGpm) total += Math.max(0, d);
  const cap = Math.max(0, circGpm);
  if (total <= cap) return demandsGpm.map((d) => Math.max(0, d));
  return demandsGpm.map((d) => (total > 0 ? (cap * Math.max(0, d)) / total : 0));
}

/** Drilling cost (7.6.6): (ops.wellBaseUsd + ops.wellUsdPerFt × §3 depthToWaterFt) × cpiIndex. */
export function wellCostUsd(depthToWaterFt: number, cpiIndex: number, p: OpsKernelParams): number {
  return (p.wellBaseUsd + p.wellUsdPerFt * Math.max(0, depthToWaterFt)) * cpiIndex;
}

/**
 * Drilling a well (ops/drillWell): price and duration, with the price's explanation. §3's depth to water is hidden until
 * the well is drilled, so a caller explaining the price before then passes a truth context.
 */
export function wellDrilling(
  depthToWaterFt: number,
  cpiIndex: number,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<{ usd: number; weeks: number }> {
  const usd = wellCostUsd(depthToWaterFt, cpiIndex, p);
  const calc = ex.on
    ? kNode(ex, 'Well drilling', 'product', 'usd', usd, [
        kTune(ex, 'ops.wellBaseUsd', p.wellBaseUsd, 'usd', 'Casing, pump and genset hook-up'),
        kTune(ex, 'ops.wellUsdPerFt', p.wellUsdPerFt, 'usd', 'Per foot drilled'),
        kLeaf(ex, 'Depth to water', depthToWaterFt, 'ft'),
        kLeaf(ex, 'Cost index', cpiIndex, 'index'),
      ])
    : undefined;
  return calcResult({ usd, weeks: p.wellWeeks }, calc);
}

/**
 * The yield of the claim's n-th drilled well (0-based): the first reveals §3's hidden wellYieldGpm, the second yields
 * ops.secondWellYieldMult × that (shared aquifer); no third (null).
 */
export function drilledWellYieldGpm(index: number, hiddenYieldGpm: number, p: OpsKernelParams): number | null {
  if (index === 0) return hiddenYieldGpm;
  if (index === 1) return hiddenYieldGpm * p.secondWellYieldMult;
  return null;
}

/** Well pump fuel: each drilled well's pump burns ops.wellPumpGalPerHr while the plant runs (7.6.6, 7.11). */
export function wellPumpGal(plantRunHours: number, wellCount: number, p: OpsKernelParams): number {
  return Math.max(0, plantRunHours) * Math.max(0, wellCount) * p.wellPumpGalPerHr;
}
