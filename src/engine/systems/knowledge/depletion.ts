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
import { exp, log, normInv } from '../../core/dmath';
import type { BlockId } from '../../core/ids';
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

  if (footprint !== null) {
    const dk = depletionKindOf(footprint.kind);
    kinds = dk === null ? [] : [{ kind: dk, p: 1 }];
    resolved = true;
    for (const id of footprint.blocks) {
      const b = model.indexOf[id];
      if (b !== undefined && dk !== null) markWorked(b, dk);
    }
  } else if (visible.some((v) => v) && kinds.length > 0 && prior.pNone === 0) {
    // Visible workings: the kind is the visible one and the worked blocks are the ones that show (§3.9).
    resolved = true;
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
  return { kinds, state, workedBlocks: worked.sort((a, b) => a - b), vDepl, lambdaMult, sbMult, sbFloor, workedKind };
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
 * μ_e per paystreak configuration (S × n): ln(f + (1 − f)·bgRatio) + o_depl, and the per-configuration log
 * likelihood penalty for known worked blocks off the paystreak.
 */
export function streakMeans(model: PriorModel, depl: DepletionModel): { mu: Float64Array; penalty: Float64Array } {
  const n = model.n;
  const S = model.S;
  const bg = model.priors.streak.bgRatio;
  const mu = new Float64Array(S * n);
  const penalty = new Float64Array(S);
  const kp = depl.kinds.map((k) => ({ ...kindParams(k.kind, model), kind: k.kind, p: k.p }));
  const lnPen = log(model.params.workedOffStreakLik);
  for (let s = 0; s < S; s++) {
    for (let b = 0; b < n; b++) {
      const f = model.streakF[s * n + b] as number;
      let o = 0;
      const st = depl.state[b];
      if (st === DEPL_UNKNOWN) {
        for (const k of kp) if (qualifies(k.kind, f, k.minF)) o += k.p * k.q * k.l;
      } else if (st === DEPL_WORKED) {
        const wk = depl.workedKind[b];
        const k = kp.find((x) => x.kind === wk) ?? kp[0];
        if (k !== undefined) o = k.worked;
      } else if (st === DEPL_PASSED) {
        for (const k of kp) if (qualifies(k.kind, f, k.minF)) o += k.p * k.passed;
      }
      mu[s * n + b] = log(f + (1 - f) * bg) + o;
    }
    let pen = 0;
    for (const b of depl.workedBlocks) {
      const wk = depl.workedKind[b];
      const k = kp.find((x) => x.kind === wk);
      const minF = k?.minF ?? model.params.streakMinF;
      const f = model.streakF[s * n + b] as number;
      if (!(wk === 'dredge' ? f > minF : f >= minF)) pen += lnPen;
    }
    penalty[s] = pen;
  }
  return { mu, penalty };
}

