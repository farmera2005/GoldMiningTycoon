// The vertical gold profile (DESIGN §3.5.4): one implementation for sampling (drawSample), estimation (§4 evaluates the
// profile forms on its expected profiles) and mining (§7 bedrock-cleanup depth and dilution).
//
// Height h is in ft above the bedrock surface: gravel spans 0..Tg, the bedrock cleanup zone −B..0. G(h) is the
// cumulative share of the column's gold below h: s_b of it sits in the cleanup zone (decaying downward with λb), the
// rest in the gravel, decaying upward from bedrock with λg.
import { exp } from '../../core/dmath';
import type { BlockTruth, VerticalProfile } from './types';

export function profileOf(bt: BlockTruth, bedrockDecayFt: number): VerticalProfile {
  return {
    Tg: bt.payThicknessFt,
    B: bt.bedrockCleanupFt,
    sb: bt.bedrockGoldShare,
    lambdaG: bt.verticalDecayFt,
    lambdaB: bedrockDecayFt,
  };
}

/** G(h): cumulative share of the column's gold below height h (0 at −B, s_b at 0, 1 at Tg). */
export function cumulativeGoldShare(p: VerticalProfile, h: number): number {
  if (h >= 0) {
    if (p.Tg <= 0) return 1;
    const t = Math.min(h, p.Tg);
    return p.sb + ((1 - p.sb) * (1 - exp(-t / p.lambdaG))) / (1 - exp(-p.Tg / p.lambdaG));
  }
  if (p.B <= 0) return 0;
  const d = Math.min(p.B, -h);
  return p.sb - (p.sb * (1 - exp(-d / p.lambdaB))) / (1 - exp(-p.B / p.lambdaB));
}

/** Share of the column's gold between heights h1 < h2. */
export function verticalGoldShareProfile(p: VerticalProfile, h1: number, h2: number): number {
  return cumulativeGoldShare(p, h2) - cumulativeGoldShare(p, h1);
}

/** Grade of the interval [h1, h2] ÷ the block mean grade of the whole column (Tg + B). */
export function positionMultProfile(p: VerticalProfile, h1: number, h2: number): number {
  const span = h2 - h1;
  if (!(span > 0)) return 0;
  return verticalGoldShareProfile(p, h1, h2) / (span / (p.Tg + p.B));
}

export function verticalGoldShare(bt: BlockTruth, h1: number, h2: number, bedrockDecayFt: number): number {
  return verticalGoldShareProfile(profileOf(bt, bedrockDecayFt), h1, h2);
}

export function positionMult(bt: BlockTruth, h1: number, h2: number, bedrockDecayFt: number): number {
  return positionMultProfile(profileOf(bt, bedrockDecayFt), h1, h2);
}
