// DESIGN §7 7.6.5 plant capacity, 7.6.8 tailings handling, and the plant downtime of cleanups (7.10) and moves (7.7).
// The plant's effective rated rate falls with clay (by how well the prep scrubs it) and boulders; feeding beyond it is
// allowed up to ops.plantMaxOverfeed and costs fine gold through φ (7.9).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { PrecipBand, Prep } from './types';

export interface PlantRateInput {
  /** §9 catalog rated bcy/hr plus any extra sluice runs. */
  ratedBcyHr: number;
  /** machineEffectiveRate(plant) / rated (P1–P2: §9's grade rate multiplier). */
  cond: number;
  /** bcy-weighted pad clay (0–1). */
  clay: number;
  /** bcy-weighted pad boulders. */
  boulders: number;
  prep: Prep;
  /** The §12 plant-capacity hook value (1 without an event). */
  eventMult: number;
}

/**
 * R_eff = rated × cond × (1 − clay × ops.clayCapCut[prep]) × (1 − boulders × ops.boulderPlantPenalty) × event (7.6.5).
 * The season factor enters once, through the plant's usable hours u (7.5), not here as well: applying it in both places
 * would square the freeze-up cut and make a slowed plant look overfed.
 */
export function plantEffectiveRate(
  input: PlantRateInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const clayCut = Math.max(0, 1 - input.clay * p.clayCapCut[input.prep]);
  const boulderCut = Math.max(0, 1 - input.boulders * p.boulderPlantPenalty);
  const v = Math.max(0, input.ratedBcyHr * input.cond * clayCut * boulderCut * input.eventMult);
  const calc = ex.on
    ? kNode(ex, 'Effective rated capacity', 'product', 'bcyPerHour', v, [
        kLeaf(ex, 'Rated', input.ratedBcyHr, 'bcyPerHour'),
        kLeaf(ex, 'Condition', input.cond, 'mult'),
        kNode(ex, 'Clay factor', 'product', 'mult', clayCut, [
          kLeaf(ex, 'Pad clay', input.clay, 'ratio'),
          kTune(
            ex,
            `ops.clayCapCut.${input.prep}`,
            p.clayCapCut[input.prep],
            'ratio',
            `Clay capacity cut (${input.prep})`,
          ),
        ]),
        kNode(ex, 'Boulder factor', 'product', 'mult', boulderCut, [
          kLeaf(ex, 'Pad boulders', input.boulders, 'ratio'),
          kTune(ex, 'ops.boulderPlantPenalty', p.boulderPlantPenalty, 'ratio', 'Boulder plant penalty'),
        ]),
        kLeaf(ex, 'Events', input.eventMult, 'mult'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** The highest legal feed target: ops.plantMaxOverfeed × rated (FEED_TARGET_TOO_HIGH above it). */
export function maxFeedTargetBcyHr(ratedBcyHr: number, p: OpsKernelParams): number {
  return p.plantMaxOverfeed * ratedBcyHr;
}

/** plantCap = min(feed target, ops.plantMaxOverfeed × R_eff) × u, bcy per hour-block. */
export function plantCapacityBcy(feedTargetBcyHr: number, rEff: number, u: number, p: OpsKernelParams): number {
  return Math.max(0, Math.min(feedTargetBcyHr, p.plantMaxOverfeed * rEff) * u);
}

/** φ = (W / u) / R_eff: the feed rate while actually running ÷ effective rated (drives recovery, 7.9). */
export function feedRatio(washedBcy: number, u: number, rEff: number): number {
  return u > 0 && rEff > 0 ? washedBcy / u / rEff : 0;
}

/** A dry washer needs feed at ≤ 3% moisture: it runs only in dry or normal weeks (7.6.5). */
export function dryWasherCanRun(precip: PrecipBand): boolean {
  return precip === 'dry' || precip === 'normal';
}

/** Cleanup downtime: ops.cleanupHoursBase + ops.cleanupHoursPerRatedBcyHr × rated (75 bcy/hr → 7 h; 300 → 16 h). */
export function cleanupHours(ratedBcyHr: number, p: OpsKernelParams): number {
  return p.cleanupHoursBase + p.cleanupHoursPerRatedBcyHr * ratedBcyHr;
}

/** Off-day cleanup crew-hours: cleanupHours × ops.cleanupCrewSize (paid by §8 at its overtime rules). */
export function cleanupCrewHours(ratedBcyHr: number, p: OpsKernelParams): number {
  return cleanupHours(ratedBcyHr, p) * p.cleanupCrewSize;
}

/** Plant-move downtime (s07 #21): ops.plantMoveHoursBase + ops.plantMoveHoursPerRatedBcyHr × rated (75 → 16 h). */
export function plantMoveHours(ratedBcyHr: number, p: OpsKernelParams): number {
  return p.plantMoveHoursBase + p.plantMoveHoursPerRatedBcyHr * ratedBcyHr;
}

/**
 * Tailings handling machine-hours (7.6.8): ops.tailingsHandlingHrPerKBcy per 1,000 bcy washed above what a stacker or
 * conveyor in support carries.
 */
export function tailingsHandlingHours(washedBcy: number, stackerBcy: number, p: OpsKernelParams): number {
  return (Math.max(0, washedBcy - Math.max(0, stackerBcy)) * p.tailingsHandlingHrPerKBcy) / 1000;
}
