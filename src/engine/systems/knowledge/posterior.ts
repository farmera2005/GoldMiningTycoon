// The grade posterior (DESIGN §4.5.2): latent x = [m, e_1 … e_n, r], one Cholesky of K = HΣ₀Hᵀ + R shared by every
// paystreak hypothesis (only the prior mean differs), hypothesis log likelihoods −½ rᵀK⁻¹r, and the low-count site
// refinement of §4.4.4. A barren hypothesis differs from its gold-bearing twin by a constant on m, so its residual is
// r − c·1 and it costs O(R) beyond the twin (c = ln barrenMult).
import { exp, log, sqrt } from '../../core/dmath';
import { backSolveInPlace, cholesky, forwardSolveInPlace } from './linalg';
import type { PriorModel } from './prior';
import type { Rows } from './rows';
import { smallCount } from './smallCount';

export interface Hyps {
  readonly count: number;
  readonly streak: Int32Array;
  readonly barren: Uint8Array;
  /** ln prior weight plus the worked-block penalty and the held-selection factor. */
  readonly logPrior: Float64Array;
  /** Offset on the claim mean m: ln barrenMult for barren hypotheses plus the held-selection shift. */
  readonly mOffset: Float64Array;
}

export function allHypotheses(model: PriorModel, penalty: Float64Array): Hyps {
  const H = model.S * 2;
  const streak = new Int32Array(H);
  const barren = new Uint8Array(H);
  const logPrior = new Float64Array(H);
  const mOffset = new Float64Array(H);
  const lpb = logOf(model.pBarren);
  const lpg = logOf(1 - model.pBarren);
  const sel = model.selection;
  let h = 0;
  for (let s = 0; s < model.S; s++) {
    const ps = model.streakHasPS[s] === 1;
    for (let br = 0; br < 2; br++) {
      streak[h] = s;
      barren[h] = br;
      const sl = ps ? (br === 1 ? sel.barren : sel.gold) : sel.noPaystreak;
      logPrior[h] =
        logOf(model.streakPrior[s] as number) + (br === 1 ? lpb : lpg) + (penalty[s] as number) + sl.logWeight;
      mOffset[h] = (br === 1 ? model.lnBarrenMult : 0) + sl.shift;
      h++;
    }
  }
  return { count: H, streak, barren, logPrior, mOffset };
}

function logOf(x: number): number {
  return x > 0 ? log(x) : -1e300;
}

export function pruneHypotheses(h: Hyps, weights: Float64Array, minWeight: number): Hyps {
  const keep: number[] = [];
  for (let i = 0; i < h.count; i++) if ((weights[i] as number) >= minWeight) keep.push(i);
  if (keep.length === 0) {
    // Keep the single best rather than nothing (cannot happen with normalized weights and minWeight < 1).
    let best = 0;
    for (let i = 1; i < h.count; i++) if ((weights[i] as number) > (weights[best] as number)) best = i;
    keep.push(best);
  }
  const count = keep.length;
  const streak = new Int32Array(count);
  const barren = new Uint8Array(count);
  const logPrior = new Float64Array(count);
  const mOffset = new Float64Array(count);
  keep.forEach((src, i) => {
    streak[i] = h.streak[src] as number;
    barren[i] = h.barren[src] as number;
    logPrior[i] = h.logPrior[src] as number;
    mOffset[i] = h.mOffset[src] as number;
  });
  return { count, streak, barren, logPrior, mOffset };
}

export interface Solve {
  readonly hyps: Hyps;
  readonly weights: Float64Array;
  /** Posterior mean of ln G_b = m + e_b per hypothesis (count × n). */
  readonly meanLnG: Float64Array;
  /** Posterior mean of r per hypothesis. */
  readonly meanR: Float64Array;
  readonly R: number;
  readonly L: Float64Array;
  /** α_h = K⁻¹ r_h per hypothesis (count × R), for row predictions. */
  readonly alpha: Float64Array;
}

/** Signal covariance between rows j and k (HΣ₀Hᵀ). */
function signal(model: PriorModel, rows: Rows, Vm: number, vr: number, j: number, k: number): number {
  const bj = rows.blk[j] as number;
  const bk = rows.blk[k] as number;
  let s = Vm + (rows.pr[j] as number) * (rows.pr[k] as number) * vr;
  if (bj >= 0 && bk >= 0) s += model.Se[bj * model.n + bk] as number;
  return s;
}

/** Shared-group covariance between rows (exposure group, upper-pay profile group, the claim-level sample error). */
function groupCov(rows: Rows, j: number, k: number): number {
  const g = rows.group[j] as number;
  const grp = g !== 0 && rows.group[k] === g ? sqrt((rows.gv[j] as number) * (rows.gv[k] as number)) : 0;
  return grp + ((rows.blk[j] as number) >= 0 && (rows.blk[k] as number) >= 0 ? rows.common : 0);
}

/** Noise covariance: the row's own variance plus its shared group. */
function noise(rows: Rows, j: number, k: number): number {
  return (j === k ? (rows.v[j] as number) : 0) + groupCov(rows, j, k);
}

export function solvePosterior(
  model: PriorModel,
  rows: Rows,
  muE: Float64Array,
  Vm: number,
  vr: number,
  hyps: Hyps,
): Solve {
  const n = model.n;
  const R = rows.R;
  const H = hyps.count;
  const meanLnG = new Float64Array(H * n);
  const meanR = new Float64Array(H);
  const alpha = new Float64Array(H * R);
  const logw = new Float64Array(H);
  if (R === 0) {
    for (let h = 0; h < H; h++) {
      const s = hyps.streak[h] as number;
      const Mh = model.M + (hyps.mOffset[h] as number);
      for (let b = 0; b < n; b++) meanLnG[h * n + b] = Mh + (muE[s * n + b] as number);
      logw[h] = hyps.logPrior[h] as number;
    }
    return { hyps, weights: normalize(logw), meanLnG, meanR, R, L: new Float64Array(0), alpha };
  }
  const K = new Float64Array(R * R);
  for (let j = 0; j < R; j++) {
    for (let k = 0; k <= j; k++) {
      const v = signal(model, rows, Vm, vr, j, k) + noise(rows, j, k);
      K[j * R + k] = v;
      K[k * R + j] = v;
    }
  }
  const L = cholesky(K, R);
  const k1 = new Float64Array(R).fill(1);
  forwardSolveInPlace(L, R, k1);
  backSolveInPlace(L, R, k1);
  let s11 = 0;
  for (let j = 0; j < R; j++) s11 += k1[j] as number;
  // Q[b][j] = Cov(m + e_b, row j): V_m + Σ_e[b][b_j] (the records row loads on m only).
  const Q = new Float64Array(n * R);
  for (let b = 0; b < n; b++) {
    for (let j = 0; j < R; j++) {
      const bj = rows.blk[j] as number;
      Q[b * R + j] = Vm + (bj >= 0 ? (model.Se[b * n + bj] as number) : 0);
    }
  }
  const Qk1 = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    let s = 0;
    for (let j = 0; j < R; j++) s += (Q[b * R + j] as number) * (k1[j] as number);
    Qk1[b] = s;
  }
  // r loads −p_j on each row: Cov(r, row j) = −p_j v_r.
  let rk1 = 0;
  for (let j = 0; j < R; j++) rk1 += -(rows.pr[j] as number) * vr * (k1[j] as number);

  // One solve per distinct paystreak configuration among the active hypotheses.
  const done = new Int32Array(model.S).fill(-1);
  const twinQ = new Float64Array(model.S);
  const twinT = new Float64Array(model.S);
  const resid = new Float64Array(R);
  const u = new Float64Array(R);
  for (let h = 0; h < H; h++) {
    const s = hyps.streak[h] as number;
    let src = done[s] as number;
    if (src < 0) {
      for (let j = 0; j < R; j++) {
        const bj = rows.blk[j] as number;
        resid[j] = (rows.y[j] as number) - model.M - (bj >= 0 ? (muE[s * n + bj] as number) : 0);
        u[j] = resid[j] as number;
      }
      forwardSolveInPlace(L, R, u);
      let q = 0;
      for (let j = 0; j < R; j++) q += (u[j] as number) * (u[j] as number);
      backSolveInPlace(L, R, u);
      let t = 0;
      for (let j = 0; j < R; j++) t += u[j] as number;
      // u, q, t are for the configuration's unshifted residual; every hypothesis on the configuration differs only
      // by its constant offset on m (barren flag, selection shift), so it is derived from them in O(R + n).
      const cc = hyps.mOffset[h] as number;
      for (let j = 0; j < R; j++) alpha[h * R + j] = (u[j] as number) - cc * (k1[j] as number);
      logw[h] = (hyps.logPrior[h] as number) - 0.5 * (q - 2 * cc * t + cc * cc * s11);
      let rm = 0;
      for (let j = 0; j < R; j++) rm += -(rows.pr[j] as number) * vr * (u[j] as number);
      meanR[h] = rm - cc * rk1;
      for (let b = 0; b < n; b++) {
        let m = 0;
        for (let j = 0; j < R; j++) m += (Q[b * R + j] as number) * (u[j] as number);
        meanLnG[h * n + b] = model.M + (muE[s * n + b] as number) + m + cc * (1 - (Qk1[b] as number));
      }
      // Remember the twin's raw quantities for the other member of the pair.
      done[s] = h;
      twinQ[s] = q;
      twinT[s] = t;
      src = h;
      continue;
    }
    // Derive from the stored twin at slot `src`.
    const q = twinQ[s] as number;
    const t = twinT[s] as number;
    const cc = hyps.mOffset[h] as number;
    const cs = hyps.mOffset[src] as number;
    for (let j = 0; j < R; j++) alpha[h * R + j] = (alpha[src * R + j] as number) + (cs - cc) * (k1[j] as number);
    logw[h] = (hyps.logPrior[h] as number) - 0.5 * (q - 2 * cc * t + cc * cc * s11);
    meanR[h] = (meanR[src] as number) + (cs - cc) * rk1;
    for (let b = 0; b < n; b++) {
      meanLnG[h * n + b] = (meanLnG[src * n + b] as number) + (cc - cs) * (1 - (Qk1[b] as number));
    }
  }
  return { hyps, weights: normalize(logw), meanLnG, meanR, R, L, alpha };
}

function normalize(logw: Float64Array): Float64Array {
  let mx = -Infinity;
  for (let i = 0; i < logw.length; i++) mx = Math.max(mx, logw[i] as number);
  const w = new Float64Array(logw.length);
  let tot = 0;
  for (let i = 0; i < logw.length; i++) {
    const x = exp((logw[i] as number) - mx);
    w[i] = x;
    tot += x;
  }
  for (let i = 0; i < logw.length; i++) w[i] = (w[i] as number) / tot;
  return w;
}

/**
 * Posterior covariance of ln G across blocks (n × n), shared by all hypotheses: C₀ − Q K⁻¹ Qᵀ with
 * C₀[a][b] = V_m + Σ_e[a][b].
 */
export function blockCovariance(model: PriorModel, rows: Rows, Vm: number, sol: Solve): Float64Array {
  const n = model.n;
  const R = sol.R;
  const C = new Float64Array(n * n);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) C[a * n + b] = Vm + (model.Se[a * n + b] as number);
  if (R === 0) return C;
  const W = new Float64Array(n * R);
  const w = new Float64Array(R);
  for (let b = 0; b < n; b++) {
    for (let j = 0; j < R; j++) {
      const bj = rows.blk[j] as number;
      w[j] = Vm + (bj >= 0 ? (model.Se[b * n + bj] as number) : 0);
    }
    forwardSolveInPlace(sol.L, R, w);
    W.set(w, b * R);
  }
  for (let a = 0; a < n; a++) {
    for (let b = 0; b <= a; b++) {
      let s = 0;
      for (let j = 0; j < R; j++) s += (W[a * R + j] as number) * (W[b * R + j] as number);
      const v = (C[a * n + b] as number) - s;
      C[a * n + b] = v;
      C[b * n + a] = v;
    }
  }
  return C;
}

/**
 * Low-count site refinement (§4.4.4): for rows with N_eff below the threshold, refit the Gaussian site to the
 * small-count likelihood by moment matching on a fixed grid. Returns true if
 * any row changed (the caller re-solves). Rows are refit from the same posterior (one sweep).
 */
export function refineSites(model: PriorModel, rows: Rows, Vm: number, vr: number, sol: Solve): boolean {
  const P = model.params;
  const R = rows.R;
  const H = sol.hyps.count;
  let changed = false;
  const yNew = Float64Array.from(rows.y);
  const vNew = Float64Array.from(rows.v);
  const sj = new Float64Array(R);
  const G = P.siteRefineGrid;
  for (let j = 0; j < R; j++) {
    const info = rows.info[j];
    if (info === null || info === undefined || !(info.nEff < P.siteRefineMaxNeff)) continue;
    // Predictive moments of the row latent over the hypothesis mixture.
    let mm = 0;
    let m2 = 0;
    for (let h = 0; h < H; h++) {
      const aj = sol.alpha[h * R + j] as number;
      const mean = (rows.y[j] as number) - (rows.v[j] as number) * aj;
      const w = sol.weights[h] as number;
      mm += w * mean;
      m2 += w * mean * mean;
    }
    // The shared position error is part of what the row measures (it shifts the effective grade), so it counts as
    // signal here: the site is only the row's own (y_j, v_j).
    for (let k = 0; k < R; k++) sj[k] = signal(model, rows, Vm, vr, j, k) + groupCov(rows, j, k);
    const sjj = sj[j] as number;
    forwardSolveInPlace(sol.L, R, sj);
    let q = 0;
    for (let k = 0; k < R; k++) q += (sj[k] as number) * (sj[k] as number);
    const vv = Math.max(1e-12, m2 - mm * mm + sjj - q);
    const vj = rows.v[j] as number;
    const yj = rows.y[j] as number;
    const pc = 1 / vv - 1 / vj;
    if (!(pc > 1e-6)) continue;
    const sc2 = 1 / pc;
    const sc = sqrt(sc2);
    const muc = sc2 * (mm / vv - yj / vj);
    let w0 = 0;
    let w1 = 0;
    let w2 = 0;
    for (let g = 0; g < G; g++) {
      const z = -4 + (8 * g) / (G - 1);
      const x = muc + sc * z;
      const lgnc = x - info.Ew;
      const ne = (exp(lgnc) * 31103.5 * info.Veff) / info.muStar;
      const t = smallCount(P.smallCount, ne);
      const mean = lgnc + t.b - info.corr;
      const v = t.v + info.vOther;
      const d = info.lgObs - mean;
      const wq = exp((-z * z) / 2 - (0.5 * d * d) / v) / sqrt(v);
      w0 += wq;
      w1 += wq * x;
      w2 += wq * x * x;
    }
    if (!(w0 > 0)) continue;
    const mt = w1 / w0;
    const vt = Math.max(1e-6, w2 / w0 - mt * mt);
    const pnew = 1 / vt - 1 / sc2;
    const vn = pnew > 1e-4 ? 1 / pnew : 1e4;
    yNew[j] = vn * (mt / vt - muc / sc2);
    vNew[j] = vn;
    changed = true;
  }
  if (changed) {
    (rows.y as Float64Array).set(yNew);
    (rows.v as Float64Array).set(vNew);
  }
  return changed;
}
