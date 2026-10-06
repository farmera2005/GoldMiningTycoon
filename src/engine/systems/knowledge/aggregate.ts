// Claim aggregation (DESIGN §4.7): contained ounces per hypothesis by Fenton–Wilkinson over a block set, plus the
// independent compound-Poisson pocket term (undetected pockets and confirmed hits), then mixture quantiles over the
// hypotheses. exp(C_ab) is computed once and reused for every hypothesis; only the vector A changes.
import { exp, log, sqrt } from '../../core/dmath';
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

/**
 * Contained ounces over the block set `sel` (§4.7): per hypothesis ES = Σ A_b, E[S²] = Σ_ab A_a A_b exp(C_ab), plus
 * pockets Ep = Σ λ_b bcyMean g_p, Vp = Σ λ_b bcy2Mean g_p² (1 + cv²) and confirmed hits; σ² = ln(1 + Var/ES²).
 * `scale` multiplies the ounces (minable: 1 − miningLossFrac).
 */
export function summarizeSet(inp: AggregateInputs, A: Float64Array, sel: Uint8Array, scale: number): SetSummary {
  const { n, H } = inp;
  const idx: number[] = [];
  for (let b = 0; b < n; b++) if (sel[b] === 1 && inp.alive[b] === 1) idx.push(b);
  const muW = new Float64Array(H);
  const sdW = new Float64Array(H);
  const baseMu = new Float64Array(H);
  const baseS2 = new Float64Array(H);
  const baseSd = new Float64Array(H);
  const wts = new Float64Array(H);
  let mean = 0;
  let baseMean = 0;
  const lnScale = log(scale);
  const confirmed2 = inp.pocketBcy2Mean / (inp.pocketBcyMean * inp.pocketBcyMean) - 1;
  for (let h = 0; h < H; h++) {
    const w = inp.weights[h] as number;
    wts[h] = w >= MIN_COMPONENT_WEIGHT ? w : 0;
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
    let Ep = 0;
    let Vp = 0;
    for (const b of idx) {
      const conf = inp.confirmedOz[b] as number;
      if (conf > 0) {
        Ep += conf;
        Vp += conf * conf * confirmed2;
        continue;
      }
      const lam = inp.pocketLambda[h * n + b] as number;
      if (!(lam > 0)) continue;
      const g = inp.pocketGrade[h * n + b] as number;
      Ep += lam * inp.pocketBcyMean * g;
      Vp += lam * inp.pocketBcy2Mean * g * g * (1 + inp.pocketGradeCv2);
    }
    if (!(ES > 0)) {
      baseMu[h] = -Infinity;
      baseS2[h] = 0;
      muW[h] = -Infinity;
      continue;
    }
    const vS = Math.max(0, ES2 - ES * ES);
    const s2b = log(1 + vS / (ES * ES));
    baseS2[h] = s2b;
    baseMu[h] = log(ES) - s2b / 2 + lnScale;
    baseSd[h] = sqrt(Math.max(s2b, 1e-12));
    const ET = ES + Ep;
    const s2 = log(1 + (vS + Vp) / (ET * ET));
    muW[h] = log(ET) - s2 / 2 + lnScale;
    sdW[h] = sqrt(Math.max(s2, 1e-12));
    mean += w * ET * scale;
    baseMean += w * ES * scale;
  }
  if (idx.length === 0) {
    return {
      p10: 0,
      p50: 0,
      p90: 0,
      mean: 0,
      baseP10: 0,
      baseP50: 0,
      baseP90: 0,
      baseMean: 0,
      baseMu,
      baseS2,
    };
  }
  const full: Mixture = { count: H, w: wts, mu: muW, sd: sdW };
  const base: Mixture = { count: H, w: wts, mu: baseMu, sd: baseSd };
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
