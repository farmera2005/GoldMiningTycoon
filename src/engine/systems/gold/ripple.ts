// §10's ripple helpers (DESIGN §10 10.5; S10-15; P1 contract §4.10): how other sections let the gold index move
// their prices with a lag (§3 supply, §4 contractor rates, §5 asks, §8 wages, §9 used prices). On the flat P1 index every
// ripple is exactly `base`, so the Wave-0 stubs return `base` and their explain node is a single base leaf.
import { calcResult, type Calc } from '../../core/calc';
import type { GameState } from '../../state/types';

export interface RippleOpts {
  escalate?: boolean;
}

/** base × clamp(goldIdx(t − lag)^e, lo, hi). */
export function ripple(
  _state: GameState,
  base: number,
  _e: number,
  _lagWeeks: number,
  _lo: number,
  _hi: number,
  _opts?: RippleOpts,
): Calc<number> {
  // CONTRACT-STUB(§10) gold.ripple
  return calcResult(base, undefined);
}

/** A rate (probability per week) rippled and kept in [0, 1]. */
export function rippleRate(
  _state: GameState,
  base: number,
  _e: number,
  _lagWeeks: number,
  _lo: number,
  _hi: number,
  _opts?: RippleOpts,
): Calc<number> {
  // CONTRACT-STUB(§10) gold.rippleRate
  return calcResult(base, undefined);
}

/** Different elasticities up and down. */
export function rippleTwoSided(
  _state: GameState,
  base: number,
  _eUp: number,
  _eDown: number,
  _lag: number,
  _lo: number,
  _hi: number,
): Calc<number> {
  // CONTRACT-STUB(§10) gold.rippleTwoSided
  return calcResult(base, undefined);
}

/** base + ptsPerUnit × (goldIdx(t − lag) − 1), capped. */
export function rippleAdd(
  _state: GameState,
  base: number,
  _ptsPerUnit: number,
  _lag: number,
  _cap: number,
): Calc<number> {
  // CONTRACT-STUB(§10) gold.rippleAdd
  return calcResult(base, undefined);
}

/** k × momentum, capped (0 on the flat index). */
export function momentumTilt(_state: GameState, _k: number, _cap: number): Calc<number> {
  // CONTRACT-STUB(§10) gold.momentumTilt
  return calcResult(0, undefined);
}

/** A named ripple's domain value (1 on the flat index). */
export function rippleDomain(_state: GameState, _key: string): Calc<number> {
  // CONTRACT-STUB(§10) gold.rippleDomain
  return calcResult(1, undefined);
}
