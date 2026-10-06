// DESIGN §7 7.4 natural thaw (Stefan form, D-7.8): thaw depth grows with the square root of accumulated thawing
// degree-days, so d_new = √(d² + K) per week; removing material lowers the thaw line by the thickness removed (skimming
// keeps the thaw at its fast early rate), and the first winter week keeps only a share of it.
import { calcResult, type Calc } from '../../../core/calc';
import { sqrt } from '../../../core/dmath';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { BlockSurface, TempBand, ThawSurface } from './types';

/** The thaw-table row of a block surface; null for surfaces that do not thaw (mined out, backfilled, reclaimed). */
export function thawSurfaceOf(surface: BlockSurface): ThawSurface | null {
  switch (surface) {
    case 'vegetated':
      return 'vegetated';
    case 'cleared':
      return 'cleared';
    case 'stripping':
    case 'payExposed':
      return 'stripped';
    case 'minedOut':
    case 'backfilled':
    case 'reclaimed':
      return null;
  }
}

export interface ThawRateInput {
  tempBand: TempBand;
  surface: ThawSurface;
  /** Overburden (muck) still over the pay: ice-rich muck thaws slower. */
  overburdenRemaining: boolean;
  /** §3 claim.env.thawAspectMult (north-facing bench 0.65 … south-facing 1.35; valley bottoms 1.0). */
  aspectMult: number;
  /** The §12 thaw hook value, read through effective() by the caller (1 when no event applies). */
  eventMult: number;
}

/** K = thawK[band] × surfaceMult × (muck ? thawMuckMult : 1) × aspect × event, in ft² per week. */
export function thawRateK(input: ThawRateInput, p: OpsKernelParams, ex: KernelExplainCtx = KEX_OFF): Calc<number> {
  const kBand = p.thawK[input.tempBand];
  const sMult = p.thawSurfaceMult[input.surface];
  const muck = input.overburdenRemaining ? p.thawMuckMult : 1;
  const v = Math.max(0, kBand * sMult * muck * input.aspectMult * input.eventMult);
  const calc = ex.on
    ? kNode(ex, 'Thaw rate (ft² per week)', 'product', 'none', v, [
        kTune(ex, `ops.thawK.${input.tempBand}`, kBand, 'none', `Thaw constant (${input.tempBand} week)`),
        kTune(ex, `ops.thawSurfaceMult.${input.surface}`, sMult, 'mult', `Surface (${input.surface})`),
        input.overburdenRemaining ? kTune(ex, 'ops.thawMuckMult', muck, 'mult', 'Ice-rich muck') : undefined,
        kLeaf(ex, 'Slope aspect', input.aspectMult, 'mult'),
        kLeaf(ex, 'Events', input.eventMult, 'mult'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** One week of thaw: min(√(d² + K), remaining column), ft below the current exposed surface. */
export function thawStep(thawedFt: number, kFt2: number, remainingColumnFt: number): number {
  const d = Math.max(0, thawedFt);
  return Math.min(sqrt(d * d + Math.max(0, kFt2)), Math.max(0, remainingColumnFt));
}

/** Removing material (a strip lift, or skimming the thawed layer) lowers the thaw line by the thickness removed. */
export function thawAfterRemoval(thawedFt: number, removedFt: number): number {
  return Math.max(0, thawedFt - Math.max(0, removedFt));
}

/** The first winter-phase week keeps overwinterThawRetention[surface] of the thaw (drained ground re-thaws fast). */
export function overwinterThaw(thawedFt: number, surface: ThawSurface, p: OpsKernelParams): number {
  return thawedFt * p.overwinterThawRetention[surface];
}
