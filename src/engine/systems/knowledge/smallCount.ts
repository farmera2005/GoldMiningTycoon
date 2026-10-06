// The small-count correction (DESIGN §4.4.4). A sample holding about one particle is not lognormal: the table gives
// the mean b and variance v_t of t = ln(max(M, ½μ*) / E[M]) by effective particle count, from a Monte Carlo of §3's
// draw. Lookup is linear in ln N_eff, with slope β = max(0.05, 1 + db/d ln N_eff) from the bracketing grid points, so
// at low counts β → 0 and the observation stops pretending to know the grade.
import { log } from '../../core/dmath';
import type { SmallCountRow } from './params';

export interface SmallCount {
  readonly b: number;
  readonly v: number;
  readonly beta: number;
}

const MIN_BETA = 0.05;

/** The lognormal limit above the grid: b = −½ ln(1 + 1/N), v = ln(1 + 1/N), β = 1 + 1/(2(N + 1)). */
export function lognormalLimit(nEff: number): SmallCount {
  const l = log(1 + 1 / nEff);
  return { b: -0.5 * l, v: l, beta: 1 + 1 / (2 * (nEff + 1)) };
}

export function smallCount(table: readonly SmallCountRow[], nEff: number): SmallCount {
  const last = table[table.length - 1] as SmallCountRow;
  if (nEff >= last.n) return lognormalLimit(nEff);
  const first = table[0] as SmallCountRow;
  const x = log(Math.max(first.n, nEff));
  let i = 0;
  while (i < table.length - 2 && x > log((table[i + 1] as SmallCountRow).n)) i++;
  const lo = table[i] as SmallCountRow;
  const hi = table[i + 1] as SmallCountRow;
  const x0 = log(lo.n);
  const dx = log(hi.n) - x0;
  const t = (x - x0) / dx;
  const slope = (hi.b - lo.b) / dx;
  return { b: lo.b + t * (hi.b - lo.b), v: lo.v + t * (hi.v - lo.v), beta: Math.max(MIN_BETA, 1 + slope) };
}
