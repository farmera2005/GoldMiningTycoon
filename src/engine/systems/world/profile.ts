// Creek profiles (DESIGN §3.5.2): 1-D along-valley processes shared by every claim on a creek, so rich and poor
// stretches, paystreak wander and thickness carry across claim boundaries (D-3.5). Stream: rng(seed,'world','creek',C.id).
// Draw order: obFactor, payFactor (creek-level σ, §3.2), then richLog, centerFt, hwLog, obLog, payLog (rows normals each).
import { exp, sqrt } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { BLOCK_FT } from './constants';
import type { CreekProfile, GenCreek, GenDistrict } from './genTypes';
import { lnMedian } from './random';
import type { GeoGenParams } from './types';

/** Stationary Gaussian AR(1): z₀ ~ N(0,1), zᵢ = ρ zᵢ₋₁ + √(1−ρ²) εᵢ, ρ = exp(−209 / range); returns σ·z. n normals. */
export function ar1(r: Rng, n: number, rangeFt: number, sigma: number): number[] {
  const rho = exp(-BLOCK_FT / rangeFt);
  const s = sqrt(1 - rho * rho);
  const out = new Array<number>(n);
  let z = 0;
  for (let i = 0; i < n; i++) {
    const e = r.normal();
    z = i === 0 ? e : rho * z + s * e;
    out[i] = sigma * z;
  }
  return out;
}

export function genCreekProfile(
  r: Rng,
  c: GenCreek,
  d: GenDistrict,
  creeks: readonly GenCreek[],
  gp: GeoGenParams,
): CreekProfile {
  const tpl = d.tpl;
  const obFactor = lnMedian(r, 1, tpl.overburden.sig[1]);
  const payFactor = lnMedian(r, 1, tpl.pay.sig[0]);
  const richLog = ar1(r, c.rows, tpl.richRangeFt, tpl.sigma.rich);
  const centerRaw = ar1(r, c.rows, gp.grade.wanderRangeFt, tpl.wanderSdFt);
  const hwLog = ar1(r, c.rows, gp.grade.halfWidthRangeFt, tpl.sigHalfWidth);
  const obLog = ar1(r, c.rows, gp.grade.obRangeFt, tpl.overburden.sig[2]);
  const payLog = ar1(r, c.rows, gp.grade.payRangeFt, tpl.pay.sig[1]);
  // The paystreak wanders off the creek but stays inside the valley floor (valley half-width mult 1).
  const centerFt = centerRaw.map((x, row) => {
    const hw = tpl.halfWidthMedFt * exp(hwLog[row] as number);
    const lim = Math.max(0, c.halfWidthFt - hw);
    return x < -lim ? -lim : x > lim ? lim : x;
  });
  // Junction boost: rich ground just downstream of each gold-bearing tributary's mouth (R3), the junction row and the
  // junctionBoostRows − 1 rows below it.
  for (const t of creeks) {
    if (t.parentIdx !== c.idx || !t.goldBearing || t.junctionRow === null) continue;
    const k = t.junctionRow;
    for (let row = Math.max(0, k - gp.world.junctionBoostRows + 1); row <= k; row++) {
      richLog[row] = (richLog[row] as number) + gp.world.junctionBoostLog;
    }
  }
  return { obFactor, payFactor, richLog, centerFt, hwLog, obLog, payLog };
}
