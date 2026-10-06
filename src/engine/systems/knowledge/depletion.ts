// Old-timer depletion in the prior mean (DESIGN §4.5.1 o_depl, §4.10.2 known-kind offsets, §4.10.4 old workings found
// in the field). Old-timers took the richest paystreak blocks, so a block's log-grade offset depends on what is
// known about it:
//   unknown  — the claim's mixture of hidden kinds: Σ_k P(k) q_k ℓ_k on blocks the kind could have worked;
//   worked   — the kind's worked offset (removal plus the selection of the richest blocks);
//   passed   — the kind's passed-over offset on paystreak blocks (the selection left the poorer ones);
//   neutral  — no offset (pre-stripped recent-operator blocks, fully mined blocks).
// The kinds and worked blocks come from visible features (§3.9: piles, dredge tailings, recent disturbance and their
// blocks), a records footprint, or a pit that hits old workings. Drift workings are hidden from the air, so on a
// feature-free claim P(drift) is updated by every bedrock sample that did not hit workings.
import { exp, lgamma, log, normInv } from '../../core/dmath';
import type { BlockId } from '../../core/ids';
import { depletionRemoval } from '../world/oldTimers';
import { cumulativeGoldShare } from '../world/vertical';
import type { OldTimerKind } from '../world/types';
import { depletionKindOf, type DepletionKind, type EstimatorParams } from './params';
import type { PriorModel } from './prior';
import type { PreparedSample } from './samples';
import type { EvidenceSet } from './types';

export const DEPL_UNKNOWN = 0;
export const DEPL_WORKED = 1;
export const DEPL_PASSED = 2;
export const DEPL_NEUTRAL = 3;

export interface KindProb {
  readonly kind: DepletionKind | 'recentCat';
  readonly p: number;
}

export interface DepletionModel {
  /** Kind distribution applying to unknown, worked and passed blocks (excluding 'none'). */
  readonly kinds: readonly KindProb[];
  readonly state: Uint8Array;
  /** Blocks known worked: hypotheses that put them off the paystreak are penalized (estWorkedOffStreakLik). */
  readonly workedBlocks: readonly number[];
  /**
   * The kind whose worked blocks are all known (visible from the air or a records footprint), so their count tells
   * the paystreak's size (estWorkedCountSlackBlocks); null when the set may be incomplete (pit hits) or for dredges
   * (every paystreak block, handled by the passed-block penalty).
   */
  readonly countKind: 'drift' | 'handCut' | 'dryWash' | 'recentCat' | null;
  /** Claim-level variance from the unknown-kind mixture, added to V_m (§4.5.1 v_depl). */
  readonly vDepl: number;
  /** Profile changes on worked blocks (§3.6: drift doubles λg and cuts s_b by 0.6; dredge sets λg 6, s_b ≥ 0.5). */
  readonly lambdaMult: Float64Array;
  readonly sbMult: Float64Array;
  readonly sbFloor: Float64Array;
  /** For display: the most likely kind of a worked block. */
  readonly workedKind: readonly (OldTimerKind | undefined)[];
}

function phi(z: number): number {
  return exp((-z * z) / 2) / 2.5066282746310002;
}

/** Selection offsets for a share q worked of paystreak blocks with block-field sd σ (§4.10.2 formula). */
export function selectionOffsets(q: number, sigma: number, removalLog: number): { worked: number; passed: number } {
  if (q >= 1) return { worked: removalLog, passed: 0 };
  const zq = normInv(1 - q);
  const d = sigma * phi(zq);
  return { worked: removalLog + d / q, passed: -d / (1 - q) };
}

function kindParams(kind: DepletionKind | 'recentCat', model: PriorModel): {
  q: number;
  l: number;
  worked: number;
  passed: number;
  minF: number;
} {
  const p = model.params;
  if (kind === 'recentCat') {
    // Recent operators mined the best paystreak outright (f_rem = 0 there); the rest are the passed-over blocks.
    const o = selectionOffsets(p.recentWorkedShare, model.sigmaBlock, 0);
    return { q: p.recentWorkedShare, l: 0, worked: 0, passed: o.passed, minF: p.streakMinF };
  }
  const off = p.workedLogOffset[kind];
  return {
    q: p.workedShare[kind],
    l: p.removalLog[kind],
    worked: off[0],
    passed: kind === 'dredge' ? 0 : off[1],
    minF: kind === 'dredge' ? p.dredgeMinF : p.streakMinF,
  };
}

/** Does f qualify for a kind's workings (dredge: f > minF; the rest: f ≥ 0.4, §3.6)? */
function qualifies(kind: DepletionKind | 'recentCat', f: number, minF: number): boolean {
  return kind === 'dredge' ? f > minF : f >= minF;
}

function normalized(pKind: Readonly<Partial<Record<OldTimerKind, number>>>): { kinds: KindProb[]; pNone: number } {
  const kinds: KindProb[] = [];
  let total = 0;
  let pNone = 0;
  for (const k of ['none', 'handCut', 'drift', 'dredge', 'dryWash', 'hydraulic', 'recentCat'] as const) {
    const w = pKind[k] ?? 0;
    total += w;
    const dk = depletionKindOf(k);
    // P6 hydraulic workings carry no §4 offset table yet; their weight counts as unworked.
    if (dk === null) pNone += w;
    else if (w > 0) kinds.push({ kind: dk, p: w });
  }
  if (!(total > 0)) return { kinds: [], pNone: 1 };
  return { kinds: kinds.map((k) => ({ kind: k.kind, p: k.p / total })), pNone: pNone / total };
}

/**
 * Coarse-ratio change of a worked block (§3.6 deplete removes size classes by weights, coarse first for hand
 * methods), as R_after / R_before on the prior mix at the kind's mean extraction. Feeds the block's coarse thinning
 * a_b (design delta: DESIGN's a_b = 0.5 + 0.5 f̄_b ignores that old-timers took the coarse gold; on dredged ground the
 * coarse share falls from ~25% to ~9%).
 */
export function workedCoarseMult(model: PriorModel, kind: DepletionKind | 'recentCat', bHat: number, sbHat: number): number {
  if (kind === 'recentCat') return 1;
  const D = model.params.deplete;
  let x = D.meanX[kind];
  if (kind === 'drift') {
    const prof = {
      Tg: model.priors.geometry.payMedFt,
      B: bHat,
      sb: sbHat,
      lambdaG: model.priors.verticalDecayFt,
      lambdaB: model.params.phys.bedrockDecayFt,
    };
    x *= cumulativeGoldShare(prof, D.driftTopFt) - cumulativeGoldShare(prof, -D.driftBedrockFt);
  }
  x = Math.min(D.maxX, x);
  const m = model.sizeMixPrior;
  const mix = [m.coarse, m.medium, m.fine, m.ultrafine];
  const removed = depletionRemoval(mix, x, kind === 'dredge' ? D.dredgeWeights : D.handWeights, D.cap);
  const after = mix.map((v, k) => Math.max(0, v - (removed[k] as number)));
  const rBefore = (mix[0] as number) / ((mix[1] as number) + (mix[2] as number) + (mix[3] as number));
  const rAfter = (after[0] as number) / Math.max(1e-12, (after[1] as number) + (after[2] as number) + (after[3] as number));
  return rAfter / rBefore;
}

/** Per-block multiplier on the coarse thinning a_b from the depletion state (expected over the kind mixture). */
export function coarseDepletionMult(model: PriorModel, depl: DepletionModel, bHat: number, sbHat: number): Float64Array {
  const n = model.n;
  const out = new Float64Array(n).fill(1);
  const mults = depl.kinds.map((k) => ({ k, mult: workedCoarseMult(model, k.kind, bHat, sbHat), q: kindParams(k.kind, model).q }));
  for (let b = 0; b < n; b++) {
    const st = depl.state[b];
    if (st === DEPL_WORKED) {
      const m = mults.find((x) => x.k.kind === depl.workedKind[b]);
      if (m !== undefined) out[b] = m.mult;
    } else if (st === DEPL_UNKNOWN) {
      let v = 1;
      for (const m of mults) v += m.k.p * m.q * (m.mult - 1);
      out[b] = v;
    }
  }
  return out;
}

export function depletionModel(
  model: PriorModel,
  evidence: EvidenceSet,
  samples: readonly PreparedSample[],
  minedFrac: Float64Array,
  strippedFt: Float64Array,
): DepletionModel {
  const n = model.n;
  const params: EstimatorParams = model.params;
  const state = new Uint8Array(n);
  const workedKind: (OldTimerKind | undefined)[] = new Array<OldTimerKind | undefined>(n).fill(undefined);
  const lambdaMult = new Float64Array(n).fill(1);
  const sbMult = new Float64Array(n).fill(1);
  const sbFloor = new Float64Array(n).fill(0);
  const worked: number[] = [];
  const markWorked = (b: number, kind: DepletionKind | 'recentCat'): void => {
    if (state[b] === DEPL_WORKED) return;
    state[b] = DEPL_WORKED;
    worked.push(b);
    workedKind[b] = kind;
    if (kind === 'drift') {
      lambdaMult[b] = params.driftDecayMult;
      sbMult[b] = params.driftBedrockShareMult;
    } else if (kind === 'dredge') {
      sbFloor[b] = params.dredgeMinBedrockShare;
    }
  };

  // 1. A records footprint names the kind and its worked blocks (§4.10.2).
  let footprint: { kind: OldTimerKind; blocks: readonly BlockId[] } | null = null;
  for (const r of evidence.records) {
    if (r.item !== 'oldWorkings' || r.payload.kind === undefined) continue;
    footprint = { kind: r.payload.kind, blocks: (r.payload.workedBlocks ?? []).map((w) => w.blockId) };
  }
  const visible = model.priors.blocks.map((b) => b.visibleWorkings);
  const prior = normalized(model.priors.oldTimer.pKind);
  let kinds: KindProb[] = prior.kinds;
  let resolved = false;
  let countKind: DepletionModel['countKind'] = null;
  const completeSet = (k: DepletionKind | 'recentCat' | null): DepletionModel['countKind'] =>
    k === null || k === 'dredge' ? null : k;

  if (footprint !== null) {
    const dk = depletionKindOf(footprint.kind);
    kinds = dk === null ? [] : [{ kind: dk, p: 1 }];
    resolved = true;
    countKind = completeSet(dk);
    for (const id of footprint.blocks) {
      const b = model.indexOf[id];
      if (b !== undefined && dk !== null) markWorked(b, dk);
    }
  } else if (visible.some((v) => v) && kinds.length > 0 && prior.pNone === 0) {
    // Visible workings: the kind is the visible one and the worked blocks are the ones that show (§3.9).
    resolved = true;
    countKind = completeSet(kinds.reduce((a, k) => (k.p > a.p ? k : a)).kind);
    for (let b = 0; b < n; b++) {
      if (!visible[b]) continue;
      const recent = kinds.some((k) => k.kind === 'recentCat');
      if (recent && (minedFrac[b] as number) < 1 && (strippedFt[b] as number) > 0) {
        state[b] = DEPL_NEUTRAL; // pre-stripped: the next block the operator meant to mine
        continue;
      }
      const top = kinds.reduce((a, k) => (k.p > a.p ? k : a));
      markWorked(b, top.kind);
    }
  }

  if (!resolved) {
    // Hidden kinds (drift): a pit that hits old workings proves the kind; bedrock samples without a hit lower it.
    const hidden = kinds;
    const hits: number[] = [];
    for (const s of samples) if (s.reachedPay && s.rec.observed.oldWorkings && !hits.includes(s.b)) hits.push(s.b);
    if (hits.length > 0) {
      // A geologist names the era from depth and material; drift (at bedrock under intact muck) is the hidden kind,
      // and the block gets the drift offset without one (§4.10.4).
      const driftLike = hidden.find((k) => k.kind === 'drift') ?? hidden[0];
      const kind = driftLike?.kind ?? 'drift';
      kinds = [{ kind, p: 1 }];
      for (const b of hits.sort((x, y) => x - y)) markWorked(b, kind);
    } else if (hidden.length > 0) {
      const checked: number[] = [];
      for (const s of samples) if (s.interval === 'fullColumn' && !checked.includes(s.b)) checked.push(s.b);
      const pStreak = priorStreakProb(model);
      let pNone = prior.pNone;
      const post = hidden.map((k) => {
        const kp = kindParams(k.kind, model);
        let lw = log(k.p);
        for (const b of checked) lw += log(Math.max(1e-12, 1 - kp.q * (pStreak[b] as number)));
        return { kind: k.kind, lw };
      });
      let mx = log(Math.max(pNone, 1e-300));
      for (const p of post) mx = Math.max(mx, p.lw);
      let tot = pNone > 0 ? exp(log(pNone) - mx) : 0;
      const ws = post.map((p) => exp(p.lw - mx));
      for (const w of ws) tot += w;
      pNone = pNone > 0 ? exp(log(pNone) - mx) / tot : 0;
      kinds = post.map((p, i) => ({ kind: p.kind, p: (ws[i] as number) / tot }));
      for (const b of checked) state[b] = DEPL_PASSED;
    }
  } else {
    for (let b = 0; b < n; b++) if (state[b] === DEPL_UNKNOWN) state[b] = DEPL_PASSED;
  }
  for (let b = 0; b < n; b++) if ((minedFrac[b] as number) >= 1 && state[b] !== DEPL_WORKED) state[b] = DEPL_NEUTRAL;

  // v_depl (§4.5.1): Σ P q ℓ² − (Σ P q ℓ)² while any block's depletion is unknown.
  let vDepl = 0;
  if (state.some((s) => s === DEPL_UNKNOWN)) {
    let m1 = 0;
    let m2 = 0;
    for (const k of kinds) {
      const kp = kindParams(k.kind, model);
      m1 += k.p * kp.q * kp.l;
      m2 += k.p * kp.q * kp.l * kp.l;
    }
    vDepl = Math.max(0, m2 - m1 * m1);
  }
  return {
    kinds,
    state,
    workedBlocks: worked.sort((a, b) => a - b),
    countKind,
    vDepl,
    lambdaMult,
    sbMult,
    sbFloor,
    workedKind,
  };
}

/** P(f_b ≥ 0.4) under the configuration prior times the worked-block likelihood terms (penalty, per configuration). */
export function hypothesisPsProb(model: PriorModel, penalty: Float64Array): Float64Array {
  const n = model.n;
  const S = model.S;
  let mx = -Infinity;
  for (let s = 0; s < S; s++) mx = Math.max(mx, penalty[s] as number);
  const w = new Float64Array(S);
  let tot = 0;
  for (let s = 0; s < S; s++) {
    w[s] = (model.streakPrior[s] as number) * exp((penalty[s] as number) - mx);
    tot += w[s] as number;
  }
  const out = new Float64Array(n);
  if (!(tot > 0)) return out;
  for (let s = 0; s < S; s++) {
    const ws = (w[s] as number) / tot;
    for (let b = 0; b < n; b++) if ((model.streakF[s * n + b] as number) >= model.params.streakMinF) out[b] = (out[b] as number) + ws;
  }
  return out;
}

/** Prior P(f_b ≥ 0.4) over the paystreak configurations. */
export function priorStreakProb(model: PriorModel): Float64Array {
  const n = model.n;
  const out = new Float64Array(n);
  for (let s = 0; s < model.S; s++) {
    const w = model.streakPrior[s] as number;
    for (let b = 0; b < n; b++) if ((model.streakF[s * n + b] as number) >= model.params.streakMinF) out[b] = (out[b] as number) + w;
  }
  return out;
}

/**
 * μ_e per paystreak configuration (S × n): ln(f + (1 − f)·bgRatio) + o_depl; the removal part of the offset (pocket
 * grades scale by it after §3's floor, §3.6 deplete); and the per-configuration log likelihood penalty for known
 * worked blocks off the paystreak. `handCutEligible[b]` is P(the block's cover is thin enough for hand-cutters): they
 * worked only ground under geology.oldTimer.kinds.handCut.maxObFt (§3.6), so their selection applies only there.
 */
export function streakMeans(
  model: PriorModel,
  depl: DepletionModel,
  handCutEligible: Float64Array,
): { mu: Float64Array; removal: Float64Array; penalty: Float64Array } {
  const n = model.n;
  const S = model.S;
  const bg = model.priors.streak.bgRatio;
  const mu = new Float64Array(S * n);
  const removal = new Float64Array(S * n);
  const penalty = new Float64Array(S);
  const kp = depl.kinds.map((k) => ({ ...kindParams(k.kind, model), kind: k.kind, p: k.p }));
  const lnPen = log(model.params.workedOffStreakLik);
  for (let s = 0; s < S; s++) {
    for (let b = 0; b < n; b++) {
      const f = model.streakF[s * n + b] as number;
      let o = 0;
      let rm = 0;
      const st = depl.state[b];
      if (st === DEPL_UNKNOWN) {
        for (const k of kp) {
          if (!qualifies(k.kind, f, k.minF)) continue;
          const el = k.kind === 'handCut' ? (handCutEligible[b] as number) : 1;
          o += el * k.p * k.q * k.l;
          rm += el * k.p * k.q * k.l;
        }
      } else if (st === DEPL_WORKED) {
        const wk = depl.workedKind[b];
        const k = kp.find((x) => x.kind === wk) ?? kp[0];
        if (k !== undefined) {
          o = k.worked;
          rm = k.l;
        }
      } else if (st === DEPL_PASSED) {
        for (const k of kp) {
          if (!qualifies(k.kind, f, k.minF)) continue;
          const el = k.kind === 'handCut' ? (handCutEligible[b] as number) : 1;
          o += el * k.p * k.passed;
        }
      }
      mu[s * n + b] = log(f + (1 - f) * bg) + o;
      removal[s * n + b] = rm;
    }
    let pen = 0;
    for (const b of depl.workedBlocks) {
      const wk = depl.workedKind[b];
      // Dredged blocks carry no such term (design delta, P0): a dredge took every block with any paystreak, so its
      // footprint is fixed by the unworked blocks (below). §3's paystreak wanders and changes width row by row, so a
      // dredged block of small f often falls off a rigid configuration; requiring every dredged block on the
      // configuration's streak favours wide paystreaks and overstated the gold left on dredged ground by ~0.2 (ln).
      if (wk === 'dredge') continue;
      const k = kp.find((x) => x.kind === wk);
      const minF = k?.minF ?? model.params.streakMinF;
      const f = model.streakF[s * n + b] as number;
      if (!(f >= minF)) pen += lnPen;
    }
    pen += workedCountLogLik(model, depl, s, handCutEligible);
    // A dredge worked every block of its stretch with any paystreak (q = 1, §3.6): an unworked block that a
    // hypothesis puts on the streak would have been dredged too.
    const dredge = kp.find((k) => k.kind === 'dredge' && k.p >= 1);
    if (dredge !== undefined) {
      for (let b = 0; b < n; b++) {
        if (depl.state[b] === DEPL_PASSED && (model.streakF[s * n + b] as number) > dredge.minF) pen += lnPen;
      }
    }
    penalty[s] = pen;
  }
  return { mu, removal, penalty };
}

/**
 * Log likelihood of the known worked-block count W under paystreak configuration s (design delta to §4.10.2, P0):
 * §3.6 works round(U(lo, hi) × N) of the N paystreak blocks (hand-cutters only those under thin cover; drift miners
 * each with probability p), so W ≈ p·U·N' with N' the configuration's count give or take estWorkedCountSlackBlocks.
 * Without it the worked-block penalty alone favours wide paystreaks (they cover the worked blocks most easily) and the
 * prior overstates the gold on worked ground.
 */
export function workedCountLogLik(model: PriorModel, depl: DepletionModel, s: number, handCutEligible: Float64Array): number {
  const kind = depl.countKind;
  if (kind === null) return 0;
  const n = model.n;
  const P = model.params;
  const wc = P.workedCount[kind];
  let N = 0;
  let nEl = 0;
  let elVar = 0;
  for (let b = 0; b < n; b++) {
    if ((model.streakF[s * n + b] as number) < P.streakMinF) continue;
    N++;
    const el = handCutEligible[b] as number;
    nEl += el;
    elVar += el * (1 - el);
  }
  const mid = (wc.lo + wc.hi) / 2;
  const varU = ((wc.hi - wc.lo) * (wc.hi - wc.lo)) / 12;
  const slack2 = P.workedCountSlackBlocks * P.workedCountSlackBlocks;
  let mu = wc.p * mid * N;
  let v = 1 / 12 + wc.p * (1 - wc.p) * mid * N + wc.p * wc.p * (varU * N * N + mid * mid * slack2);
  if (kind === 'handCut') {
    // Hand-cutters took the top share but only where the cover was thin (§3.6): W = min(round(top·N), eligible).
    mu = Math.min(mu, nEl);
    v += elVar;
  }
  const W = depl.workedBlocks.length;
  // Which W of the N: 1/C(N, W) under an exchangeable grade ranking, tempered (estWorkedSetTemper).
  const pool = kind === 'handCut' ? Math.max(nEl, W) : N;
  const lnChoose = pool > W ? lgamma(pool + 1) - lgamma(W + 1) - lgamma(pool - W + 1) : 0;
  return -0.5 * ((W - mu) * (W - mu)) / v - 0.5 * log(v) - P.workedSetTemper * lnChoose;
}

/** Var[Z | Z > Φ⁻¹(1 − q)] for Z ~ N(0, 1): the spread left among the richest share q (upper truncation). */
export function upperTruncVar(q: number): number {
  if (q >= 1) return 1;
  const c = normInv(1 - q);
  const lam = phi(c) / q;
  return Math.max(0, 1 + c * lam - lam * lam);
}

/** Var[Z | Z < Φ⁻¹(1 − q)]: the spread left among the passed-over 1 − q (lower truncation). */
export function lowerTruncVar(q: number): number {
  if (q >= 1) return 1;
  const c = normInv(1 - q);
  const lam = phi(c) / (1 - q);
  return Math.max(0, 1 - c * lam - lam * lam);
}

/**
 * Per-block ratio of the block-field variance left after the old-timers' selection (design delta to §4.10.2, P0):
 * a worked block is one of the richest q of the paystreak and a passed-over paystreak block one of the rest, so the
 * block-field term z_b is truncated, not just shifted by the §4.10.2 offsets. Keeping the full σ_block² there
 * inflates the gold on worked ground by e^{(1 − ratio)σ²/2} per block. Passed blocks apply it with their probability
 * of being on the paystreak (pPS, under the hypothesis prior with the worked-block terms).
 */
export function selectionVarRatio(
  model: PriorModel,
  depl: DepletionModel,
  pPS: Float64Array,
  handCutEligible: Float64Array,
): Float64Array | null {
  const n = model.n;
  const out = new Float64Array(n).fill(1);
  let any = false;
  const kp = depl.kinds.map((k) => ({ ...kindParams(k.kind, model), kind: k.kind, p: k.p }));
  for (let b = 0; b < n; b++) {
    const st = depl.state[b];
    if (st === DEPL_WORKED) {
      const k = kp.find((x) => x.kind === depl.workedKind[b]);
      if (k === undefined || k.kind === 'recentCat' || k.q >= 1) continue;
      out[b] = upperTruncVar(k.q);
      any = true;
    } else if (st === DEPL_PASSED) {
      let loss = 0;
      for (const k of kp) {
        if (k.q >= 1) continue;
        const el = k.kind === 'handCut' ? (handCutEligible[b] as number) : 1;
        loss += k.p * el * (pPS[b] as number) * (1 - lowerTruncVar(k.q));
      }
      if (loss > 0) {
        out[b] = 1 - loss;
        any = true;
      }
    }
  }
  return any ? out : null;
}
