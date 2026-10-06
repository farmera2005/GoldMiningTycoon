// DESIGN §7 7.6.3 haul. Trucks cycle load → haul → dump → return → spot; the loader is the line's fastest dig excavator,
// so an under-matched fleet idles the excavator and an over-matched one queues trucks. Speeds are the low end of R4's
// pit-road range for soft placer roads (D-7.27).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { PrecipBand } from './types';

/** haulFt = ops.haulBaseFt + ops.blockSpacingFt × (|Δi| + |Δj|) between the mining block and the plant site. */
export function haulDistanceFt(di: number, dj: number, p: OpsKernelParams): number {
  return p.haulBaseFt + p.blockSpacingFt * (Math.abs(di) + Math.abs(dj));
}

/**
 * hcm = ops.haulCycleMultByPrecip[precip] (P5; 1 before) × the §12 haul-cycle hook value (read through effective() by the
 * caller).
 */
export function haulCycleMult(
  precip: PrecipBand,
  eventMult: number,
  precipRuleActive: boolean,
  p: OpsKernelParams,
): number {
  return (precipRuleActive ? p.haulCycleMultByPrecip[precip] : 1) * eventMult;
}

export interface TruckCycleInput {
  /** P_k: §9 machineEffectiveRate of the truck (effective payload), bcy per load. */
  payloadBcy: number;
  /** The loader's instantaneous dig rate (the fastest dig excavator on the line), bcy/hr. */
  loaderDigRateBcyHr: number;
  haulFt: number;
  /** haulCycleMult. */
  cycleMult: number;
  /** u(k, t) of the truck. */
  u: number;
}

export interface TruckCycle {
  loadMin: number;
  loadedMin: number;
  dumpMin: number;
  emptyMin: number;
  spotMin: number;
  cycleMin: number;
  /** P × 60 / cycle × ops.haulJobEff, bcy per scheduled hour at u = 1. */
  capBcyHr: number;
  /** capBcyHr × u: this truck's capacity in the hour-block. */
  capBcy: number;
  /** cycle ÷ load time: trucks one loader can keep busy (shown in the plan editor). */
  trucksToMatch: number;
}

/** 7.6.3 truck cycle and capacity. */
export function truckCycle(
  input: TruckCycleInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<TruckCycle> {
  const loading = input.loaderDigRateBcyHr > 0 && input.payloadBcy > 0;
  const loadMin = loading ? (input.payloadBcy / input.loaderDigRateBcyHr) * 60 : 0;
  const hcm = input.cycleMult;
  const loadedMin = (input.haulFt / p.truckLoadedFtPerMin) * hcm;
  const dumpMin = p.truckDumpMin * hcm;
  const emptyMin = (input.haulFt / p.truckEmptyFtPerMin) * hcm;
  const spotMin = p.truckSpotMin * hcm;
  const cycleMin = loadMin + loadedMin + dumpMin + emptyMin + spotMin;
  const capBcyHr = loading && cycleMin > 0 ? ((input.payloadBcy * 60) / cycleMin) * p.haulJobEff : 0;
  const v: TruckCycle = {
    loadMin,
    loadedMin,
    dumpMin,
    emptyMin,
    spotMin,
    cycleMin,
    capBcyHr,
    capBcy: capBcyHr * Math.max(0, input.u),
    trucksToMatch: loadMin > 0 ? cycleMin / loadMin : 0,
  };
  const calc = ex.on
    ? kNode(ex, 'Truck capacity this hour', 'product', 'bcy', v.capBcy, [
        kLeaf(ex, 'Payload', input.payloadBcy, 'bcy'),
        kNode(ex, 'Cycle time (min)', 'sum', 'none', cycleMin, [
          kNode(ex, 'Load (min)', 'ratio', 'none', loadMin, [
            kLeaf(ex, 'Loader dig rate', input.loaderDigRateBcyHr, 'bcyPerHour'),
          ]),
          kNode(ex, 'Haul loaded (min)', 'ratio', 'none', loadedMin, [
            kLeaf(ex, 'Haul distance', input.haulFt, 'ft'),
            kTune(ex, 'ops.truckLoadedFtPerMin', p.truckLoadedFtPerMin, 'none', 'Loaded speed (ft/min)'),
          ]),
          kTune(ex, 'ops.truckDumpMin', p.truckDumpMin, 'none', 'Dump (min)'),
          kNode(ex, 'Return empty (min)', 'ratio', 'none', emptyMin, [
            kTune(ex, 'ops.truckEmptyFtPerMin', p.truckEmptyFtPerMin, 'none', 'Empty speed (ft/min)'),
          ]),
          kTune(ex, 'ops.truckSpotMin', p.truckSpotMin, 'none', 'Spot (min)'),
          kLeaf(ex, 'Cycle multiplier (weather, events)', hcm, 'mult'),
        ]),
        kTune(ex, 'ops.haulJobEff', p.haulJobEff, 'pct', 'Job efficiency (50-minute hour)'),
        kLeaf(ex, 'Usable share of the hour', input.u, 'pct'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** A loader in `haul` (load-and-carry): r × min(1, ops.loaderCarryRefFt / haulFt) × u, bcy per hour-block. */
export function loaderCarryCapBcy(refRate: number, haulFt: number, u: number, p: OpsKernelParams): number {
  const dist = haulFt > 0 ? Math.min(1, p.loaderCarryRefFt / haulFt) : 1;
  return Math.max(0, refRate * dist * u);
}
