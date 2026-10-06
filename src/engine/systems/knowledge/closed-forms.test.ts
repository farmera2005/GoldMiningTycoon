// DESIGN §4.22 closed-form fixtures of the estimator's machinery: the 4.5.5 one-block update, the single-hypothesis
// Cholesky path against its closed form, posterior-variance monotonicity, the 4.5.3 Gamma–Poisson fixtures, the 4.7
// Fenton–Wilkinson sums and the 4.4.2 position multiplier. Synthetic models carry only the fields the solver reads.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { exp, log } from '../../core/dmath';
import { positionMultProfile } from '../world/vertical';
import { summarizeSet, type AggregateInputs } from './aggregate';
import { gammaPoissonUpdate } from './coarse';
import { cholesky, cholRank1Downdate, cholRank1Update } from './linalg';
import { mixtureQuantile } from './mixture';
import { blockCovariance, solvePosterior, type Hyps } from './posterior';
import type { PriorModel } from './prior';
import { GROUP_NONE, type Rows } from './rows';
import { digamma, invTrigamma, trigamma } from './special';

/** A model with only what solvePosterior and blockCovariance read: n, M, Se, S. */
function model(n: number, M: number, Se: Float64Array): PriorModel {
  return { n, M, Se, S: 1 } as unknown as PriorModel;
}

function oneHypothesis(): Hyps {
  return {
    count: 1,
    streak: new Int32Array([0]),
    barren: new Uint8Array([0]),
    logPrior: new Float64Array([0]),
    mOffset: new Float64Array([0]),
  };
}

function rowsOf(blk: number[], y: number[], v: number[], pr: number[] = blk.map(() => 0)): Rows {
  const R = blk.length;
  return {
    R,
    blk: Int32Array.from(blk),
    pr: Float64Array.from(pr),
    y: Float64Array.from(y),
    v: Float64Array.from(v),
    group: new Int8Array(R).fill(GROUP_NONE),
    gv: new Float64Array(R),
    common: 0,
    info: blk.map(() => null),
  };
}

describe('one-block update (§4.5.5 worked example)', () => {
  // North prior M = ln 0.0095, variance 0.6978 (all on m here); coarse at the prior (p 0.247, v_r 0.0895); one pit
  // gives y = −4.249, v = 0.267, so the total-grade variance is v + p²v_r = 0.273.
  const M = log(0.0095);
  const m = model(1, M, new Float64Array([0]));
  const rows = rowsOf([0], [-4.249], [0.267], [0.247]);
  const sol = solvePosterior(m, rows, new Float64Array(1), 0.6978, 0.0895, oneHypothesis());
  const CG = blockCovariance(m, rows, 0.6978, sol);
  const mu = sol.meanLnG[0] as number;
  const sd = Math.sqrt(CG[0] as number);
  const q = (p: number): number =>
    exp(
      mixtureQuantile(
        { count: 1, w: new Float64Array([1]), mu: new Float64Array([mu]), sd: new Float64Array([sd]) },
        p,
      ),
    );

  it('posterior mean −4.363 and variance 0.196 (weight 0.719)', () => {
    expect(mu).toBeCloseTo(-4.363, 3);
    expect(CG[0] as number).toBeCloseTo(0.196, 3);
  });

  it('P10 0.0072, P50 0.0127, P90 0.0225 from prior 0.0033 / 0.0095 / 0.0277', () => {
    expect(Math.abs(q(0.1) - 0.0072)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(q(0.5) - 0.0127)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(q(0.9) - 0.0225)).toBeLessThanOrEqual(1e-4);
    const prior = (p: number): number =>
      exp(
        mixtureQuantile(
          { count: 1, w: new Float64Array([1]), mu: new Float64Array([M]), sd: new Float64Array([Math.sqrt(0.6978)]) },
          p,
        ),
      );
    expect(Math.abs(prior(0.1) - 0.0033)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(prior(0.5) - 0.0095)).toBeLessThanOrEqual(1e-4);
    expect(Math.abs(prior(0.9) - 0.0277)).toBeLessThanOrEqual(1e-4);
  });
});

describe('single hypothesis, ρ = 0: the Cholesky path equals the closed form (§4.22)', () => {
  // Independent blocks (Σ_e = τ² I), one observation per block: P_m = 1/V_m + Σ 1/(τ² + v_b),
  // λ_b = τ²/(τ² + v_b), E[ln G_b] = λ_b y_b + (1 − λ_b) m̂, Var = λ_b v_b + (1 − λ_b)²/P_m.
  it('to 1e-12 on random blocks and observations', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.double({ min: 0.05, max: 1.5, noNaN: true }),
        fc.double({ min: 0.05, max: 1.0, noNaN: true }),
        fc.array(fc.double({ min: 0.01, max: 2, noNaN: true }), { minLength: 12, maxLength: 12 }),
        fc.array(fc.double({ min: -8, max: -2, noNaN: true }), { minLength: 12, maxLength: 12 }),
        (n, tau2, Vm, vs, ys) => {
          const M = -4.6;
          const Se = new Float64Array(n * n);
          for (let b = 0; b < n; b++) Se[b * n + b] = tau2;
          const blk = [...Array(n).keys()];
          const v = blk.map((b) => vs[b] as number);
          const y = blk.map((b) => ys[b] as number);
          const m = model(n, M, Se);
          const rows = rowsOf(blk, y, v);
          const sol = solvePosterior(m, rows, new Float64Array(n), Vm, 0, oneHypothesis());
          const CG = blockCovariance(m, rows, Vm, sol);
          let Pm = 1 / Vm;
          let num = M / Vm;
          for (let b = 0; b < n; b++) {
            Pm += 1 / (tau2 + (v[b] as number));
            num += (y[b] as number) / (tau2 + (v[b] as number));
          }
          const mHat = num / Pm;
          for (let b = 0; b < n; b++) {
            const lam = tau2 / (tau2 + (v[b] as number));
            const mean = lam * (y[b] as number) + (1 - lam) * mHat;
            const vr = lam * (v[b] as number) + ((1 - lam) * (1 - lam)) / Pm;
            expect(Math.abs((sol.meanLnG[b] as number) - mean)).toBeLessThan(1e-12 * Math.max(1, Math.abs(mean)));
            expect(Math.abs((CG[b * n + b] as number) - vr)).toBeLessThan(1e-12);
          }
          expect(sol.weights[0]).toBe(1);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('posterior-variance monotonicity (§4.22 property)', () => {
  // A correlated block field (exponential kernel on a 4 × 5 grid) and random rows: adding one observation never
  // increases any block's posterior variance within a fixed hypothesis set.
  const nA = 5;
  const nC = 4;
  const n = nA * nC;
  const Se = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const da = Math.abs(Math.floor(a / nC) - Math.floor(b / nC)) * 209;
      const dc = Math.abs((a % nC) - (b % nC)) * 209;
      Se[a * n + b] = 0.25 * exp(-da / 700 - dc / 120) + 0.0784 * exp(-da / 3000) + (a === b ? 0.1225 : 0);
    }
  }
  const m = model(n, -4.6, Se);
  const row = fc.record({
    b: fc.integer({ min: 0, max: n - 1 }),
    y: fc.double({ min: -7, max: -2, noNaN: true }),
    v: fc.double({ min: 0.02, max: 1.5, noNaN: true }),
    p: fc.double({ min: 0, max: 0.6, noNaN: true }),
  });
  it('holds for any rows and any added row', () => {
    fc.assert(
      fc.property(fc.array(row, { minLength: 0, maxLength: 15 }), row, (base, extra) => {
        const vr = 0.09;
        const r0 = rowsOf(
          base.map((r) => r.b),
          base.map((r) => r.y),
          base.map((r) => r.v),
          base.map((r) => r.p),
        );
        const all = [...base, extra];
        const r1 = rowsOf(
          all.map((r) => r.b),
          all.map((r) => r.y),
          all.map((r) => r.v),
          all.map((r) => r.p),
        );
        const h = oneHypothesis();
        const c0 = blockCovariance(m, r0, 0.25, solvePosterior(m, r0, new Float64Array(n), 0.25, vr, h));
        const c1 = blockCovariance(m, r1, 0.25, solvePosterior(m, r1, new Float64Array(n), 0.25, vr, h));
        for (let b = 0; b < n; b++)
          expect(c1[b * n + b] as number).toBeLessThanOrEqual((c0[b * n + b] as number) + 1e-12);
      }),
      { numRuns: 150 },
    );
  });
});

describe('Gamma–Poisson coarse factor (§4.5.3 fixtures)', () => {
  // Mid-reach prior: α0 = ψ₁⁻¹(0.30²) = 11.60, R0 = 0.3275, β0 = e^{ψ(α0)}/R0 = 33.92; true R 0.45; σ_coarseBlock 0.25.
  const alpha0 = invTrigamma(0.3 * 0.3);
  const R0 = 0.3275;
  const beta0 = exp(digamma(alpha0)) / R0;
  const c2 = 0.25 * 0.25;
  const blocks = (k: number, E: number): { N: Float64Array; E: Float64Array } => ({
    N: new Float64Array(k).fill(0.45 * E),
    E: new Float64Array(k).fill(E),
  });

  it('prior α0 11.60, β0 33.92', () => {
    expect(alpha0).toBeCloseTo(11.6, 2);
    expect(beta0).toBeCloseTo(33.92, 2);
  });

  it('no coarse data leaves R at R0', () => {
    const g = gammaPoissonUpdate(alpha0, beta0, new Float64Array(20), new Float64Array(20), R0, c2);
    expect(exp(g.mr)).toBeCloseTo(R0, 12);
    expect(g.vr).toBeCloseTo(trigamma(alpha0), 12);
  });

  it('20 test pits of 5 bcy (E_b 1.48, φ 0.964): α 24.45, β 62.46, R 0.384, sd 0.204', () => {
    // φ = 1/(1 + R̃ E c2) = 0.964 at the pass-2 R̃ ≈ 0.40.
    const { N, E } = blocks(20, 1.48);
    const g = gammaPoissonUpdate(alpha0, beta0, N, E, 0.4, c2);
    expect(Math.abs(g.alpha - 24.45)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(g.beta - 62.46)).toBeLessThanOrEqual(0.05);
    // DESIGN's figures are rounded: R = e^{ψ(α)}/β = 0.3835, sd √ψ₁(α) = 0.2043.
    expect(Math.abs(exp(g.mr) - 0.384)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(Math.sqrt(g.vr) - 0.204)).toBeLessThanOrEqual(0.001);
  });

  it('one 500-bcy bulk sample (E_b 147.7, φ 0.205): α 25.23, β 64.20, R 0.385, sd 0.201', () => {
    const { N, E } = blocks(1, 147.7);
    const g = gammaPoissonUpdate(alpha0, beta0, N, E, 0.42, c2);
    expect(Math.abs(g.alpha - 25.23)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(g.beta - 64.2)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(exp(g.mr) - 0.385)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(Math.sqrt(g.vr) - 0.201)).toBeLessThanOrEqual(0.001);
  });
});

/** Aggregation inputs for one hypothesis without pockets. */
function aggOf(mu: number[], C: number[][]): AggregateInputs & { readonly muX: Float64Array } {
  const n = mu.length;
  const expC = new Float64Array(n * n);
  const cDiag = new Float64Array(n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) expC[a * n + b] = exp((C[a] as number[])[b] as number);
    cDiag[a] = (C[a] as number[])[a] as number;
  }
  return {
    n,
    H: 1,
    weights: new Float64Array([1]),
    muX: Float64Array.from(mu),
    cDiag,
    expC,
    alive: new Uint8Array(n).fill(1),
    pocketLambda: new Float64Array(n),
    pocketGrade: new Float64Array(n),
    confirmedOz: new Float64Array(n),
    pocketBcyMean: 1650,
    pocketBcy2Mean: 3.33e6,
    pocketGradeCv2: 0.3,
  };
}

function meansOf(inp: AggregateInputs & { readonly muX: Float64Array }): Float64Array {
  const A = new Float64Array(inp.n);
  for (let b = 0; b < inp.n; b++) A[b] = exp((inp.muX[b] as number) + 0.5 * (inp.cDiag[b] as number));
  return A;
}

describe('Fenton–Wilkinson sums (§4.7)', () => {
  it('two blocks (μ ln 80 / ln 60, σ 0.5 / 0.6, C12 0.10): P10 82.4, P50 146.8, P90 261.5', () => {
    const inp = aggOf(
      [log(80), log(60)],
      [
        [0.25, 0.1],
        [0.1, 0.36],
      ],
    );
    const s = summarizeSet(inp, meansOf(inp), new Uint8Array([1, 1]), 1);
    expect(s.mean).toBeCloseTo(162.5, 1);
    expect(s.p10).toBeCloseTo(82.4, 1);
    expect(s.p50).toBeCloseTo(146.8, 1);
    expect(s.p90).toBeCloseTo(261.5, 1);
  });

  it('a single block reproduces its lognormal', () => {
    const inp = aggOf([log(100)], [[0.49]]);
    const s = summarizeSet(inp, meansOf(inp), new Uint8Array([1]), 1);
    // Mixture quantiles converge to 1e-10 in log space.
    expect(Math.abs(log(s.p50 / 100))).toBeLessThan(1e-9);
    expect(Math.abs(log(s.p10 / (100 * exp(-1.2815515655446004 * 0.7))))).toBeLessThan(1e-9);
    expect(Math.abs(log(s.p90 / (100 * exp(1.2815515655446004 * 0.7))))).toBeLessThan(1e-9);
  });

  it('fully correlated identical blocks sum to n × one block', () => {
    const n = 5;
    const C = [...Array(n).keys()].map(() => new Array<number>(n).fill(0.3));
    const inp = aggOf(new Array<number>(n).fill(log(40)), C);
    const s = summarizeSet(inp, meansOf(inp), new Uint8Array(n).fill(1), 1);
    const one = aggOf([log(40)], [[0.3]]);
    const s1 = summarizeSet(one, meansOf(one), new Uint8Array([1]), 1);
    expect(s.p10 / s1.p10).toBeCloseTo(n, 9);
    expect(s.p50 / s1.p50).toBeCloseTo(n, 9);
    expect(s.p90 / s1.p90).toBeCloseTo(n, 9);
  });

  it('precomputed exp(C) gives the direct evaluation', () => {
    const mu = [log(30), log(55), log(12), log(80)];
    const C = [
      [0.3, 0.1, 0.05, 0.02],
      [0.1, 0.25, 0.08, 0.04],
      [0.05, 0.08, 0.4, 0.1],
      [0.02, 0.04, 0.1, 0.2],
    ];
    const inp = aggOf(mu, C);
    const s = summarizeSet(inp, meansOf(inp), new Uint8Array(4).fill(1), 1);
    let ES = 0;
    let ES2 = 0;
    for (let a = 0; a < 4; a++) {
      const Aa = exp((mu[a] as number) + 0.5 * ((C[a] as number[])[a] as number));
      ES += Aa;
      for (let b = 0; b < 4; b++) {
        const Ab = exp((mu[b] as number) + 0.5 * ((C[b] as number[])[b] as number));
        ES2 += Aa * Ab * exp((C[a] as number[])[b] as number);
      }
    }
    const s2 = log(ES2 / (ES * ES));
    expect(Math.abs(log(s.p50 / exp(log(ES) - s2 / 2)))).toBeLessThan(1e-9);
    expect(Math.abs(s.mean / ES - 1)).toBeLessThan(1e-12);
  });
});

describe('position multiplier (§4.4.2, §4.22)', () => {
  it('positionMult(−1, 5) on schist (T 6.5, λg 2) = 1.058', () => {
    // 5 ft of gravel over 1.5 ft of schist cleanup (gold share 0.2), λg 2, λb 0.6.
    const prof = { Tg: 5, B: 1.5, sb: 0.2, lambdaG: 2, lambdaB: 0.6 };
    expect(positionMultProfile(prof, -1, 5)).toBeCloseTo(1.058, 3);
  });
});

describe('rank-1 Cholesky update and downdate (incremental path)', () => {
  it('update then downdate by the same vector restores the factor', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 100, maxLength: 100 }),
        fc.array(fc.double({ min: -0.5, max: 0.5, noNaN: true }), { minLength: 10, maxLength: 10 }),
        (n, raw, xs) => {
          const A = new Float64Array(n * n);
          for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
              let s = i === j ? n : 0;
              for (let k = 0; k < n; k++) s += (raw[i * 10 + k] as number) * (raw[j * 10 + k] as number);
              A[i * n + j] = s;
            }
          const L = cholesky(A, n);
          const x = Float64Array.from(xs.slice(0, n));
          const up = Float64Array.from(L);
          cholRank1Update(up, n, Float64Array.from(x));
          // up·upᵀ = A + x xᵀ
          for (let i = 0; i < n; i++)
            for (let j = 0; j <= i; j++) {
              let s = 0;
              for (let k = 0; k < n; k++) s += (up[i * n + k] as number) * (up[j * n + k] as number);
              expect(Math.abs(s - ((A[i * n + j] as number) + (x[i] as number) * (x[j] as number)))).toBeLessThan(1e-9);
            }
          cholRank1Downdate(up, n, Float64Array.from(x));
          for (let i = 0; i < n * n; i++) expect(Math.abs((up[i] as number) - (L[i] as number))).toBeLessThan(1e-9);
        },
      ),
      { numRuns: 100 },
    );
  });
});
