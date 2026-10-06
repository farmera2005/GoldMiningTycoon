// DESIGN §7 7.6.4 feed modes and the pad. The mode follows from the line's machines each week: a feeder on the pad,
// trucks dumping straight into the hopper, or (the classic starter) an excavator feeding a small plant within reach,
// which shifts toward the face every few thousand bcy and has no pad buffer (D-7.32).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import { frozenMixMult } from './ground';
import type { OpsKernelParams } from './params';
import type { FeedMode } from './types';

export interface FeedModeInput {
  /** The line has a wash plant (plantMachineId ≠ null). */
  hasPlant: boolean;
  /** Loaders or excavators in `feed` on the line. */
  feederCount: number;
  /** Trucks, or loaders in load-and-carry `haul`, on the line. */
  haulerCount: number;
  /** Excavators in `dig` on the line. */
  digExcavatorCount: number;
  plantRatedBcyHr: number;
  /** The plant site is 4-adjacent to the line's current mining block. */
  plantAdjacentToFace: boolean;
}

/**
 * The line's feed mode (7.6.4): padLoader with a feeder; truckDirect with haulers and no feeder; excavatorDirect with
 * neither, a dig excavator, a plant rated ≤ ops.directFeedMaxRated and the plant next to the face; 'none' with no plant;
 * otherwise 'invalid' (the plan fails PLANT_NO_FEED).
 */
export function feedMode(input: FeedModeInput, p: OpsKernelParams): FeedMode | 'invalid' {
  if (!input.hasPlant) return 'none';
  if (input.feederCount > 0) return 'padLoader';
  if (input.haulerCount > 0) return 'truckDirect';
  if (input.digExcavatorCount > 0 && input.plantRatedBcyHr <= p.directFeedMaxRated && input.plantAdjacentToFace) {
    return 'excavatorDirect';
  }
  return 'invalid';
}

/** Excavator-direct feed capacity: dig capacity × ops.directFeedDigMult. */
export function directFeedCapBcy(digCapBcy: number, p: OpsKernelParams): number {
  return Math.max(0, digCapBcy) * p.directFeedDigMult;
}

/** An excavator-direct plant shifts toward the face (ops.directFeedShiftHours, cause plantMove) every SetupBcy fed. */
export function directFeedShiftDue(bcyFedSinceShift: number, p: OpsKernelParams): boolean {
  return bcyFedSinceShift >= p.directFeedSetupBcy;
}

/**
 * Share of a feed draw that comes from beyond ops.padFreeBcy (farther from the hopper). The pad is well mixed (D-7.6), so
 * a draw takes the far material pro rata.
 */
export function padRehandleShare(padBcy: number, p: OpsKernelParams): number {
  return padBcy > p.padFreeBcy && padBcy > 0 ? (padBcy - p.padFreeBcy) / padBcy : 0;
}

export interface FeederInput {
  /** r_m of the loader or excavator in `feed`, bcy/hr. */
  refRate: number;
  u: number;
  /** padRehandleShare. */
  rehandleShare: number;
  /** Frozen share of the pad (overwintered stockpile not yet thawed). */
  frozenShare: number;
}

/**
 * Feeder capacity per hour-block: r × u ÷ [time per bcy], where far pad material costs ops.rehandleTimeMult and frozen
 * pad bcy feed at the frozen-gravel dig rate (7.6.4, 7.12).
 */
export function feederCapacityBcy(
  input: FeederInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const rehandle = 1 + Math.min(1, Math.max(0, input.rehandleShare)) * (p.rehandleTimeMult - 1);
  const frozen = frozenMixMult(input.frozenShare, p.digMult.gravelFrozen);
  const v = Math.max(0, (input.refRate * input.u * frozen) / rehandle);
  const calc = ex.on
    ? kNode(ex, 'Feeder capacity this hour', 'product', 'bcy', v, [
        kLeaf(ex, 'Reference rate', input.refRate, 'bcyPerHour'),
        kLeaf(ex, 'Usable share of the hour', input.u, 'pct'),
        kNode(ex, 'Rehandle time factor', 'sum', 'mult', rehandle, [
          kLeaf(ex, 'Share fed from beyond the free pad', input.rehandleShare, 'pct'),
          kTune(ex, 'ops.rehandleTimeMult', p.rehandleTimeMult, 'mult', 'Rehandle time'),
        ]),
        kLeaf(ex, 'Frozen pad factor', frozen, 'mult'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** A pad carried over winter: ops.stockpileOverwinterFrozenFrac of its bcy are frozen at start-up (7.12). */
export function overwinterPadFrozenBcy(padBcy: number, p: OpsKernelParams): number {
  return Math.max(0, padBcy) * p.stockpileOverwinterFrozenFrac;
}
