// The incremental production path (DESIGN §4.5.2 "Incremental production path", D-4.41; s04 #1, #2). Cleanups arrive
// every couple of weeks on an operating claim, so they must not trigger full solves. The claim's estimate is anchored:
//
//   anchor turn F_c = latest of (a) the availableTurn of the newest non-production evidence item (samples) or record
//                     finding, (b) the district's most recent season end ≤ turn, (c) the cleanupTurn of every
//                     estFullSolveEveryProdRows-th production row after max(a, b) (rows in cleanupTurn, SampleId order);
//   anchor evidence  = everything but the production rows with cleanupTurn > F_c, at the block state stored when the
//                     anchor was taken (quantized: the fully mined blocks and the stripped feet);
//   appended rows    = production rows with cleanupTurn > F_c (at most estFullSolveEveryProdRows − 1).
//
// The anchor gets the full two-pass solve. Appended rows extend its Cholesky factor by a block append
// (B = K_new,old·L⁻ᵀ, L22 = chol(K_new,new − BBᵀ)), re-solve the anchor's surviving hypotheses, and downdate the block
// covariance by a rank-k term; working grades, N_eff, site refinements, pruning and the coarse posterior stay frozen at
// the anchor (sieved masses wait for the next anchor). F_c is a function of the evidence and the season calendar and
// the anchor's block state is stored in `knowledge.anchors`, so a reload rebuilds the same anchor and the same
// appended rows, and the estimate is bit-identical with or without a warm memo.
import { exp, sqrt } from '../../core/dmath';
import { compareIds } from '../../core/ids';
import { cholesky, cholRank1Downdate, cholRank1Update, forwardSolveInPlace } from './linalg';
import { coarsePosterior, coarseTerms, type CoarsePosterior } from './coarse';
import { blockCovariance, noise, signal, solvePosterior } from './posterior';
import type { PreparedProduction } from './production';
import { GROUP_PROD_RECOVERY, withProductionRows, type Rows } from './rows';
import type { Mass4 } from './samples';
import {
  anchorPosterior,
  ncShares,
  pooledForSizeMix,
  quantizeBlockState,
  type AnchorBlockState,
  type AnchorSolve,
  type PosteriorSolve,
} from './statistical';
import type { EvidenceSet, SampleRecord } from './types';

/**
 * A claim's estimate anchor as §4 stores it in `knowledge.anchors[claimId]` at each re-anchor (s04 #1). Contract delta:
 * contracts.md has `{ turn; minedBlockIds; strippedBlockIds }`; the geometry is solved in the anchor's depth frame, so
 * the stripped FEET are stored (their key set is strippedBlockIds) and the post-solve layer shifts overburden by the
 * stripping since (otherwise samples on blocks a recent operator pre-stripped read in the wrong frame).
 */
export interface EstimateAnchor extends AnchorBlockState {
  readonly turn: number;
}

/** The anchor turn used for a full solve: every production row is inside it. */
export const FULL_SOLVE_ANCHOR_TURN = Number.MAX_SAFE_INTEGER;

function cleanupTurnOf(rec: SampleRecord): number | null {
  return rec.source === 'production' && rec.production !== undefined ? rec.production.cleanupTurn : null;
}

/**
 * F_c (DESIGN §4.5.2): the latest of the newest non-production evidence item, the last season end, and the cleanup
 * turn of every `everyRows`-th production row after those. −1 when nothing anchors (prior only).
 */
export function anchorTurn(evidence: EvidenceSet, lastSeasonEndTurn: number | null, everyRows: number): number {
  let base = -1;
  for (const s of evidence.samples) if (s.source !== 'production') base = Math.max(base, s.availableTurn);
  for (const r of evidence.records) base = Math.max(base, r.turn);
  if (lastSeasonEndTurn !== null) base = Math.max(base, lastSeasonEndTurn);
  const after = evidence.samples
    .filter((s) => (cleanupTurnOf(s) ?? -Infinity) > base)
    .sort((a, b) => (cleanupTurnOf(a) as number) - (cleanupTurnOf(b) as number) || compareIds(a.id, b.id));
  const step = Math.max(1, Math.floor(everyRows));
  let F = base;
  for (let k = step; k <= after.length; k += step)
    F = Math.max(F, cleanupTurnOf(after[k - 1] as SampleRecord) as number);
  return F;
}

/** The anchor block state of a block-state snapshot: fully mined blocks and stripped feet (s04 #1). */
export function takeAnchor(turn: number, blockState: EvidenceSet['blockState']): EstimateAnchor {
  return { turn, ...quantizeBlockState(blockState) };
}

/**
 * The anchor for this week (step 16 wrap-up): the stored one while F_c is unchanged, else a new one at the current
 * block state. New non-production evidence, a season end and the every-12th production row each move F_c.
 */
export function refreshAnchor(
  prev: EstimateAnchor | null,
  evidence: EvidenceSet,
  lastSeasonEndTurn: number | null,
  everyRows: number,
): EstimateAnchor {
  const F = anchorTurn(evidence, lastSeasonEndTurn, everyRows);
  if (prev !== null && prev.turn === F) return prev;
  return takeAnchor(F, evidence.blockState);
}

/** The anchor of a full solve: all production inside, the current block state. */
export function fullSolveAnchor(evidence: EvidenceSet): EstimateAnchor {
  return takeAnchor(FULL_SOLVE_ANCHOR_TURN, evidence.blockState);
}

/** Splits the samples at the anchor: production rows with cleanupTurn > turn are appended, all else is anchored. */
export function splitAtAnchor(
  samples: readonly SampleRecord[],
  turn: number,
): { readonly anchored: SampleRecord[]; readonly appended: SampleRecord[] } {
  const anchored: SampleRecord[] = [];
  const appended: SampleRecord[] = [];
  for (const s of samples) {
    const t = cleanupTurnOf(s);
    if (t !== null && t > turn) appended.push(s);
    else anchored.push(s);
  }
  appended.sort((a, b) => compareIds(a.id, b.id));
  return { anchored, appended };
}

/** The solve with appended production rows (a PosteriorSolve over the anchor's hypotheses). */
export type AppendedSolve = PosteriorSolve;

/**
 * The coarse refresh of an append (design delta to §4.5.2's frozen list). DESIGN freezes the coarse posterior at the
 * anchor ("sieved counts wait for the next anchor"). On a pit-only anchor that left R uncertain, a season's first
 * cleanups pin R hard (each block's sieved coarse mass is hundreds of effective particles, φ-capped at ≈ 1/σ²_coarse),
 * and the frozen R kept the unmined blocks' total grades off: claim P50 up to 2% from an unfrozen solve after 3–11
 * rows (20 claims of 4.22's test, 3 of them over 1%). The refresh recomputes the Gamma posterior with every production
 * row's sieved masses at the anchor's frozen thinning a_b and R̃ (two passes, as the anchor's: the φ cap of a production
 * block scales as 1/R̃) and moves each sample composite to it: y by ΔE[w_b] (y = y_nc + E[w_b]) and its coarse loading
 * p_b with v_r in K, a rank-2 change of K (− v_r p pᵀ + v_r' p' p'ᵀ) that the anchor's factor takes as two rank-1
 * updates. The rows' own coarse jitter (p_b² σ²_coarse in v) stays frozen (measured effect < 0.05%). Working grades,
 * N_eff, site refinements and pruning stay frozen as DESIGN says.
 */
interface CoarseRefresh {
  /** The anchor's rows moved to the refreshed coarse posterior, with the production rows appended. */
  readonly rows: Rows;
  readonly coarse: CoarsePosterior;
  readonly ncShare: Mass4;
  /** The anchor rows' coarse loadings before and after (length = anchor rows). */
  readonly p0: Float64Array;
  readonly p1: Float64Array;
}

function coarseRefresh(an: AnchorSolve, prod: readonly PreparedProduction[]): CoarseRefresh {
  const model = an.model;
  const ci = an.coarseInputs;
  const all = [...an.production, ...prod];
  const prodCoarse = all.map((p) => p.coarse);
  const coarseAt = (rTilde: number): CoarsePosterior =>
    coarsePosterior(model, an.samples, ci.a, rTilde, an.coarse.coarseMeanMg, an.ncShare, ci.excluded, prodCoarse);
  const coarse = coarseAt(exp(coarseAt(ci.rTilde).mr));
  const ct = coarseTerms(ci.a, coarse.mr, coarse.vr);
  const base = an.rows;
  const y = Float64Array.from(base.y);
  const pr = Float64Array.from(base.pr);
  for (let j = 0; j < base.R; j++) {
    const b = base.blk[j] as number;
    if (b < 0 || base.group[j] === GROUP_PROD_RECOVERY) continue;
    y[j] = (y[j] as number) + ((ct.Ew[b] as number) - (ci.Ew[b] as number));
    pr[j] = ct.p[b] as number;
  }
  return {
    rows: withProductionRows(
      { ...base, y, pr },
      prod.map((p) => p.row),
    ),
    coarse,
    ncShare: ncShares(model, pooledForSizeMix(ci.pooled, all)),
    p0: base.pr,
    p1: pr,
  };
}

/**
 * Appends production rows to the anchor (§4.5.2): the coarse refresh's rank-2 update of the anchor's factor, the
 * block-append Cholesky (B = K_new,old·L⁻ᵀ, L22 = chol(K_new,new − BBᵀ)), the anchor's surviving hypotheses re-solved
 * with the extended factor, and the block covariance C₀ − W'ᵀW' − W₂ᵀW₂ with W' = L'⁻¹Q_oldᵀ and the rank-k
 * W₂ = L22⁻¹(Q_new − B·W'). Equal to `frozenFullSolve` up to rounding (4.22: 1e-9).
 */
export function appendProduction(an: AnchorSolve, prod: readonly PreparedProduction[]): AppendedSolve {
  if (prod.length === 0) return anchorPosterior(an);
  const model = an.model;
  const n = model.n;
  const Ra = an.rows.R;
  const k = prod.length;
  const R = Ra + k;
  const { rows, coarse, ncShare, p0, p1 } = coarseRefresh(an, prod);
  const Vm = an.Vm;
  const vr = coarse.vr;
  // The anchor's factor moved to the refreshed coarse loadings: + v_r' p' p'ᵀ, then − v_r p pᵀ.
  const La = Float64Array.from(an.sol.L);
  if (Ra > 0) {
    const up = new Float64Array(Ra);
    const down = new Float64Array(Ra);
    const sUp = sqrt(vr);
    const sDown = sqrt(an.coarse.vr);
    for (let j = 0; j < Ra; j++) {
      up[j] = sUp * (p1[j] as number);
      down[j] = sDown * (p0[j] as number);
    }
    cholRank1Update(La, Ra, up);
    cholRank1Downdate(La, Ra, down);
  }
  // Bᵀ, row i = L_a⁻¹ K[old, new i].
  const Bt = new Float64Array(k * Ra);
  const col = new Float64Array(Ra);
  for (let i = 0; i < k; i++) {
    const ji = Ra + i;
    for (let j = 0; j < Ra; j++) col[j] = signal(model, rows, Vm, vr, j, ji) + noise(rows, j, ji);
    forwardSolveInPlace(La, Ra, col);
    Bt.set(col, i * Ra);
  }
  // Schur complement S = K_new,new − BᵀB and its factor.
  const S = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let i2 = 0; i2 <= i; i2++) {
      let v = signal(model, rows, Vm, vr, Ra + i, Ra + i2) + noise(rows, Ra + i, Ra + i2);
      for (let j = 0; j < Ra; j++) v -= (Bt[i * Ra + j] as number) * (Bt[i2 * Ra + j] as number);
      S[i * k + i2] = v;
      S[i2 * k + i] = v;
    }
  }
  const L22 = cholesky(S, k);
  const L = new Float64Array(R * R);
  for (let r = 0; r < Ra; r++) for (let c = 0; c <= r; c++) L[r * R + c] = La[r * Ra + c] as number;
  for (let i = 0; i < k; i++) {
    const r = Ra + i;
    for (let j = 0; j < Ra; j++) L[r * R + j] = Bt[i * Ra + j] as number;
    for (let i2 = 0; i2 <= i; i2++) L[r * R + Ra + i2] = L22[i * k + i2] as number;
  }
  const sol = solvePosterior(model, rows, an.muE, Vm, vr, an.sol.hyps, L);
  // Block covariance: C₀ − W'ᵀW' − W₂ᵀW₂.
  const W = new Float64Array(n * Ra);
  const w = new Float64Array(Ra);
  const W2 = new Float64Array(n * k);
  const q = new Float64Array(k);
  for (let b = 0; b < n; b++) {
    for (let j = 0; j < Ra; j++) {
      const bj = rows.blk[j] as number;
      w[j] = Vm + (bj >= 0 ? (model.Se[b * n + bj] as number) : 0);
    }
    forwardSolveInPlace(La, Ra, w);
    W.set(w, b * Ra);
    for (let i = 0; i < k; i++) {
      const bi = rows.blk[Ra + i] as number;
      let v = Vm + (model.Se[b * n + bi] as number);
      for (let j = 0; j < Ra; j++) v -= (Bt[i * Ra + j] as number) * (w[j] as number);
      q[i] = v;
    }
    forwardSolveInPlace(L22, k, q);
    W2.set(q, b * k);
  }
  const CG = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b <= a; b++) {
      let s = 0;
      for (let j = 0; j < Ra; j++) s += (W[a * Ra + j] as number) * (W[b * Ra + j] as number);
      for (let i = 0; i < k; i++) s += (W2[a * k + i] as number) * (W2[b * k + i] as number);
      const v = Vm + (model.Se[a * n + b] as number) - s;
      CG[a * n + b] = v;
      CG[b * n + a] = v;
    }
  }
  return { rows, sol, CG, coarse, ncShare };
}

/**
 * The reference for the incremental path (4.22): the same frozen anchor quantities and the same coarse refresh, with
 * every row factorized from scratch.
 */
export function frozenFullSolve(an: AnchorSolve, prod: readonly PreparedProduction[]): AppendedSolve {
  if (prod.length === 0) return anchorPosterior(an);
  const { rows, coarse, ncShare } = coarseRefresh(an, prod);
  const sol = solvePosterior(an.model, rows, an.muE, an.Vm, coarse.vr, an.sol.hyps);
  return { rows, sol, CG: blockCovariance(an.model, rows, an.Vm, sol), coarse, ncShare };
}
