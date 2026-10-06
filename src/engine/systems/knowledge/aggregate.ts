// Claim aggregation (DESIGN §4.7): contained ounces per hypothesis by Fenton–Wilkinson over a block set, plus the
// independent compound-Poisson pocket term (undetected pockets and confirmed hits), then mixture quantiles over the
// hypotheses. exp(C_ab) is computed once and reused for every hypothesis; only the vector A changes.
//
// Pockets (design delta): DESIGN folds the pocket term into each hypothesis's lognormal by moments. A pocket is a
// rare, large, all-or-nothing addition (Λ ≈ 0.1 per claim, each worth hundreds of ounces), and one moment-matched
// lognormal spreads that jump over the whole distribution: on ground where the base is small (arid fans, dredged and
// mined-out claims) it pulled P10 far below the base and put 93–98% of truths inside P10–P90. Each hypothesis is
// therefore split into "no undetected pocket" (weight e^{−Λ}) and "at least one" (1 − e^{−Λ}, with the compound
// Poisson's conditional moments); confirmed hits stay in both.
import { exp, expm1, log, sqrt } from '../../core/dmath';
import { mixtureQuantile, type Mixture } from './mixture';

export interface AggregateInputs {
  readonly n: number;
  readonly H: number;
  readonly weights: Float64Array;
  /** μ_b(h) of ln O_b (H × n); blocks with no remaining pay are excluded via `alive`. */
  readonly muX: Float64Array;
  /** C_bb (n). */
  readonly cDiag: Float64Array;
  /** exp(C_ab) (n × n). */
  readonly expC: Float64Array;
  readonly alive: Uint8Array;
  /** Undetected-pocket rate λ_b(h) (H × n) and pocket grade g_p(h, b) (H × n); confirmed hits per block. */
  readonly pocketLambda: Float64Array;
  readonly pocketGrade: Float64Array;
  readonly confirmedOz: Float64Array;
  readonly pocketBcyMean: number;
  readonly pocketBcy2Mean: number;
  readonly pocketGradeCv2: number;
}

export interface SetSummary {
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  readonly mean: number;
  /** Without the pocket term (confidence gates, §4.8). */
  readonly baseP10: number;
  readonly baseP50: number;
  readonly baseP90: number;
  readonly baseMean: number;
  /** Per-hypothesis base lognormal (VOI and verdicts read them). */
  readonly baseMu: Float64Array;
  readonly baseS2: Float64Array;
}

const MIN_COMPONENT_WEIGHT = 1e-9;
const MIN_LAMBDA = 1e-12;

/** A_b(h) = exp(μ_b(h) + C_bb/2) for every hypothesis (H × n). */
export function blockMeans(inp: AggregateInputs): Float64Array {
  const { n, H } = inp;
  const A = new Float64Array(H * n);
  for (let h = 0; h < H; h++) {
    for (let b = 0; b < n; b++) {
      if (inp.alive[b] !== 1) continue;
      A[h * n + b] = exp((inp.muX[h * n + b] as number) + 0.5 * (inp.cDiag[b] as number));
    }
  }
  return A;
}

function lognormalOf(mean: number, variance: number): { mu: number; sd: number } {
  const s2 = log(1 + Math.max(0, variance) / (mean * mean));
  return { mu: log(mean) - s2 / 2, sd: sqrt(Math.max(s2, 1e-12)) };
}

/**
 * Contained ounces over the block set `sel` (§4.7): per hypothesis ES = Σ A_b, E[S²] = Σ_ab A_a A_b exp(C_ab); pockets
 * λ_b, g_p with E[X] = bcyMean·g_p, E[X²] = bcy2Mean·g_p²(1 + cv²); confirmed hits add oz and oz²(bcy2/bcy² − 1).
 * `scale` multiplies the ounces (minable: 1 − miningLossFrac).
 */
export function summarizeSet(inp: AggregateInputs, A: Float64Array, sel: Uint8Array, scale: number): SetSummary {
  const { n, H } = inp;
  const idx: number[] = [];
  for (let b = 0; b < n; b++) if (sel[b] === 1 && inp.alive[b] === 1) idx.push(b);
  const baseMu = new Float64Array(H);
  const baseS2 = new Float64Array(H);
  if (idx.length === 0) {
    return { p10: 0, p50: 0, p90: 0, mean: 0, baseP10: 0, baseP50: 0, baseP90: 0, baseMean: 0, baseMu, baseS2 };
  }
  const baseSd = new Float64Array(H);
  const wBase = new Float64Array(H);
  const wFull = new Float64Array(2 * H);
  const muFull = new Float64Array(2 * H);
  const sdFull = new Float64Array(2 * H);
  let mean = 0;
  let baseMean = 0;
  const lnScale = log(scale);
  const confirmed2 = inp.pocketBcy2Mean / (inp.pocketBcyMean * inp.pocketBcyMean) - 1;
  for (let h = 0; h < H; h++) {
    const w = inp.weights[h] as number;
    const wk = w >= MIN_COMPONENT_WEIGHT ? w : 0;
    let ES = 0;
    let ES2 = 0;
    for (let ia = 0; ia < idx.length; ia++) {
      const a = idx[ia] as number;
      const Aa = A[h * n + a] as number;
      ES += Aa;
      let row = 0;
      const ra = a * n;
      for (let ib = 0; ib < idx.length; ib++) {
        const b = idx[ib] as number;
        row += (A[h * n + b] as number) * (inp.expC[ra + b] as number);
      }
      ES2 += Aa * row;
    }
    let Ec = 0;
    let Vc = 0;
    let lam = 0;
    let Eu = 0;
    let Vu = 0;
    for (const b of idx) {
      const conf = inp.confirmedOz[b] as number;
      if (conf > 0) {
        Ec += conf;
        Vc += conf * conf * confirmed2;
        continue;
      }
      const l = inp.pocketLambda[h * n + b] as number;
      if (!(l > 0)) continue;
      const g = inp.pocketGrade[h * n + b] as number;
      lam += l;
      Eu += l * inp.pocketBcyMean * g;
      Vu += l * inp.pocketBcy2Mean * g * g * (1 + inp.pocketGradeCv2);
    }
    const vS = Math.max(0, ES2 - ES * ES);
    const b0 = lognormalOf(ES, vS);
    baseMu[h] = b0.mu + lnScale;
    baseS2[h] = b0.sd * b0.sd;
    baseSd[h] = b0.sd;
    wBase[h] = wk;
    mean += w * (ES + Ec + Eu) * scale;
    baseMean += w * ES * scale;
    const pNone = lam > MIN_LAMBDA ? exp(-lam) : 1;
    const c0 = lognormalOf(ES + Ec, vS + Vc);
    wFull[2 * h] = wk * pNone;
    muFull[2 * h] = c0.mu + lnScale;
    sdFull[2 * h] = c0.sd;
    if (lam > MIN_LAMBDA) {
      const pSome = -expm1(-lam);
      const m1 = Eu / pSome;
      const v1 = Math.max(0, (Vu + Eu * Eu) / pSome - m1 * m1);
      const c1 = lognormalOf(ES + Ec + m1, vS + Vc + v1);
      wFull[2 * h + 1] = wk * pSome;
      muFull[2 * h + 1] = c1.mu + lnScale;
      sdFull[2 * h + 1] = c1.sd;
    } else {
      wFull[2 * h + 1] = 0;
      muFull[2 * h + 1] = c0.mu + lnScale;
      sdFull[2 * h + 1] = c0.sd;
    }
  }
  const full: Mixture = { count: 2 * H, w: wFull, mu: muFull, sd: sdFull };
  const base: Mixture = { count: H, w: wBase, mu: baseMu, sd: baseSd };
  return {
    p10: exp(mixtureQuantile(full, 0.1)),
    p50: exp(mixtureQuantile(full, 0.5)),
    p90: exp(mixtureQuantile(full, 0.9)),
    mean,
    baseP10: exp(mixtureQuantile(base, 0.1)),
    baseP50: exp(mixtureQuantile(base, 0.5)),
    baseP90: exp(mixtureQuantile(base, 0.9)),
    baseMean,
    baseMu,
    baseS2,
  };
}
