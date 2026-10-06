// Observation rows of the grade posterior (DESIGN §4.4.2–4.4.5, §4.5.2): one non-coarse composite per block from its
// non-exposure samples, one exposure composite per block (sharing the claim's exposure position error), and the
// creek-history record on the claim mean. Each grade row is h·x = m + e_b − p_b·r with y = y_nc + E[w_b].
import { exp, log, pow, sqrt } from '../../core/dmath';
import { BCY_PER_ACRE_FT, MG_PER_OZ } from '../world/constants';
import { positionMultProfile } from '../world/vertical';
import type { VerticalProfile } from '../world/types';
import type { CoarseTerms } from './coarse';
import type { DepletionModel } from './depletion';
import type { GeometryPosterior } from './geometry';
import type { PriorModel } from './prior';
import { classMasses, nonCoarseMass, type Mass4, type PreparedSample } from './samples';
import { smallCount } from './smallCount';
import type { RecordFinding } from './types';

/** Physicists' 5-point Gauss–Hermite nodes and weights (∫ e^{−x²} f), §4.4.2 upper-pay quadrature. */
const GH_X = [-2.0201828704560856, -0.9585724646138185, 0, 0.9585724646138185, 2.0201828704560856];
const GH_W = [0.019953242059045913, 0.39361932315224116, 0.9453087204829419, 0.39361932315224116, 0.019953242059045913];
const SQRT2 = 1.4142135623730951;

export interface Position {
  readonly pm: number;
  /** Position log-variance of this sample (independent). */
  readonly v: number;
  /** Shared exposure variance (the claim's exposure error group), 0 for other intervals. */
  readonly shared: number;
}

export function blockProfile(model: PriorModel, geo: GeometryPosterior, depl: DepletionModel, sbHat: number, b: number, lnT: number): VerticalProfile {
  const Tc = exp(lnT);
  const B = geo.bHat;
  return {
    Tg: Math.max(0.5, Tc - B),
    B,
    sb: Math.max(depl.sbFloor[b] as number, sbHat * (depl.sbMult[b] as number)),
    lambdaG: model.priors.verticalDecayFt * (depl.lambdaMult[b] as number),
    lambdaB: model.params.phys.bedrockDecayFt,
  };
}

/** Position multiplier of a sample on the estimated profile (§4.4.2 table). */
export function positionOf(
  model: PriorModel,
  geo: GeometryPosterior,
  depl: DepletionModel,
  sbHat: number,
  s: PreparedSample,
): Position | null {
  const b = s.b;
  const lnT = geo.T.mean[b] as number;
  const prof = blockProfile(model, geo, depl, sbHat, b, lnT);
  const P = model.params;
  switch (s.interval) {
    case 'fullColumn': {
      const pm = positionMultProfile(prof, -Math.min(prof.B, s.penFt), prof.Tg);
      return pm > 0 ? { pm, v: P.posFullLogSd * P.posFullLogSd, shared: 0 } : null;
    }
    case 'upperPay': {
      // Quadrature over the pay-column posterior given the gravel actually penetrated p (observed).
      const sdT = sqrt(geo.T.varDiag[b] as number);
      const obObs = s.rec.observed.overburdenFt ?? exp(geo.D.mean[b] as number) - prof.Tg;
      const pen = Math.max(0.1, s.rec.depthReachedFt - obObs);
      let sw = 0;
      let e1 = 0;
      let e2 = 0;
      for (let q = 0; q < 5; q++) {
        const tq = Math.max(0.5, exp(lnT + SQRT2 * sdT * (GH_X[q] as number)) - prof.B);
        const h1 = Math.min(Math.max(0.02 * tq, tq - pen), 0.98 * tq);
        const pmq = positionMultProfile({ ...prof, Tg: tq }, h1, tq);
        const lp = log(Math.max(pmq, 1e-12));
        const wq = GH_W[q] as number;
        sw += wq;
        e1 += wq * lp;
        e2 += wq * lp * lp;
      }
      e1 /= sw;
      e2 /= sw;
      return {
        pm: exp(e1),
        v: Math.max(0, e2 - e1 * e1) + P.posFullLogSd * P.posFullLogSd + P.posUpperExtraLogSd * P.posUpperExtraLogSd,
        shared: 0,
      };
    }
    case 'exposure': {
      const frac = s.draw.exposureDepthFrac ?? P.phys.exposureDepthFrac;
      const pm = positionMultProfile(prof, (1 - frac) * prof.Tg, prof.Tg);
      const vT = geo.T.varDiag[b] as number;
      return {
        pm,
        v: 0,
        shared: P.exposureLambdaLogSd * P.exposureLambdaLogSd + P.exposureThickElast * P.exposureThickElast * vT,
      };
    }
    case 'overburdenOnly':
    case 'tailings':
      return null;
  }
}

export interface RowInfo {
  readonly nEff: number;
  readonly lgObs: number;
  readonly Ew: number;
  readonly Veff: number;
  readonly muStar: number;
  /** ½ ln((1 + CV²_L)(1 + CV²_M)). */
  readonly corr: number;
  /** Variance terms other than the particle term. */
  readonly vOther: number;
}

export interface Rows {
  readonly R: number;
  /** Block of a grade row; −1 for the records row (claim mean only). */
  readonly blk: Int32Array;
  /** p_b: the row's coefficient on r is −p_b. */
  readonly pr: Float64Array;
  readonly y: Float64Array;
  readonly v: Float64Array;
  /** 1 = the claim's exposure error group. */
  readonly group: Int8Array;
  readonly gv: Float64Array;
  readonly info: readonly (RowInfo | null)[];
}

interface RowDraft {
  blk: number;
  pr: number;
  y: number;
  v: number;
  group: number;
  gv: number;
  info: RowInfo | null;
}

/**
 * The non-coarse composite of samples on one block (§4.4.3) with the small-count correction (§4.4.4). `gt` is the
 * working non-coarse grade G̃nc of the pass.
 */
function composite(
  model: PriorModel,
  geo: GeometryPosterior,
  list: readonly { s: PreparedSample; pos: Position; mass: Mass4 }[],
  b: number,
  gt: number,
  ct: CoarseTerms,
  ncShare: Mass4,
): RowDraft | null {
  const P = model.params;
  const mu = P.phys.particleMeanMg;
  const cv = P.phys.massCv;
  let mncTotal = 0;
  let Veff = 0;
  let Pm = 0;
  for (const q of list) {
    const ve = q.s.V * q.pos.pm;
    mncTotal += nonCoarseMass(q.mass, q.s.cap);
    Veff += ve;
    let muK = 0;
    for (let c = 1; c < 4; c++) {
      const cc = cv[c] as number;
      muK += ((ncShare[c] as number) * (mu[c - 1] as number) * (1 + cc * cc)) / (q.s.cap[c] as number);
    }
    Pm += ve * muK;
  }
  if (!(Veff > 0)) return null;
  const Vb = exp(geo.T.mean[b] as number) * BCY_PER_ACRE_FT * (model.acres[b] as number);
  let cvL = 0;
  let cvM = 0;
  let vpos = 0;
  let shared = 0;
  for (const q of list) {
    const w = (q.s.V * q.pos.pm) / Veff;
    if (q.s.V < Vb) cvL += w * w * (pow(Vb / q.s.V, P.phys.deWijsAlpha) - 1);
    cvM += w * w * ((1 + q.s.volumeCv * q.s.volumeCv) * (1 + q.s.weighCv * q.s.weighCv) - 1);
    vpos += w * w * q.pos.v;
    shared += w * q.pos.shared;
  }
  const muStar = Pm / Veff;
  const nEff = (gt * MG_PER_OZ * Veff) / muStar;
  const ghat = Math.max(mncTotal, 0.5 * muStar) / (Veff * MG_PER_OZ);
  const sc = smallCount(P.smallCount, nEff);
  const lG = log(gt);
  const lgObs = log(ghat);
  const lnLM = log((1 + cvL) * (1 + cvM));
  const pb = ct.p[b] as number;
  const Ew = ct.Ew[b] as number;
  const vOther =
    lnLM + vpos + P.modelErrorLogSd * P.modelErrorLogSd + pb * pb * P.coarseBlockLogSd * P.coarseBlockLogSd;
  return {
    blk: b,
    pr: pb,
    y: lG + (lgObs - lG - sc.b) / sc.beta + 0.5 * lnLM + Ew,
    v: sc.v / (sc.beta * sc.beta) + vOther,
    group: shared > 0 ? 1 : 0,
    gv: shared,
    info: { nEff, lgObs, Ew, Veff, muStar, corr: 0.5 * lnLM, vOther },
  };
}

export interface PocketHits {
  /** Sample indices treated as pocket hits (out of the composites and the coarse update). */
  readonly excluded: Uint8Array;
  /** Confirmed pocket oz per block (0 = none). */
  readonly confirmedOz: Float64Array;
}

/**
 * Pocket hits (§4.4.5): a small sample whose capture-corrected NON-COARSE grade is far above the most favourable
 * prior P90 of its block. A pocket lifts the non-coarse grade (§3's pocket mix is 40% non-coarse); a lone nugget
 * does not, so drill holes with one coarse colour never qualify.
 */
export function pocketHits(
  model: PriorModel,
  samples: readonly PreparedSample[],
  muE: Float64Array,
  Vm: number,
  coarseMeanMg: number,
  ncShare: Mass4,
): PocketHits {
  const P = model.params;
  const n = model.n;
  const excluded = new Uint8Array(samples.length);
  const confirmedOz = new Float64Array(n);
  const maxMu = new Float64Array(n).fill(-Infinity);
  for (let s = 0; s < model.S; s++) {
    for (let b = 0; b < n; b++) maxMu[b] = Math.max(maxMu[b] as number, muE[s * n + b] as number);
  }
  samples.forEach((s, k) => {
    if (!s.reachedPay || !(s.V < 0.5 * P.pocketBcyMean) || !(s.V > 0)) return;
    const mass = classMasses(s, coarseMeanMg, ncShare, P.phys.particleMeanMg);
    const ncg = nonCoarseMass(mass, s.cap) / (s.V * MG_PER_OZ);
    const b = s.b;
    const p90 = exp(model.M + (maxMu[b] as number) + 1.2816 * sqrt(Vm + (model.Se[b * n + b] as number)));
    if (ncg >= P.pocketHitNcGrade && ncg >= P.pocketHitMult * 0.75 * p90) {
      excluded[k] = 1;
      // Pocket grade ≈ ncGrade / 0.4 (the pocket mix is 40% non-coarse) over the mean pocket volume.
      confirmedOz[b] = Math.max(confirmedOz[b] as number, (ncg / 0.4) * P.pocketBcyMean);
    }
  });
  return { excluded, confirmedOz };
}

/** The creek-history row on m (§4.5.2): y = ln(histOz/histBcy) − ln historicGradeRatio + (M − ln gMed). */
function recordsRow(model: PriorModel, records: readonly RecordFinding[]): RowDraft | null {
  let hist: RecordFinding | null = null;
  for (const r of records) if (r.item === 'creekHistory' && (r.payload.histOz ?? 0) > 0 && (r.payload.histBcy ?? 0) > 0) hist = r;
  if (hist === null) return null;
  const P = model.params;
  const s = model.priors.sigma;
  // The history observes the creek median (district × creek factors). The claim mean m also carries the deposit,
  // status and valve offsets the prior applies (M − ln gMed) and the rich and claim deviations (in the variance).
  const y =
    log((hist.payload.histOz as number) / (hist.payload.histBcy as number)) -
    log(P.historicGradeRatio) +
    (model.M - log(model.tpl.gMed));
  const v = P.creekProdLogSd * P.creekProdLogSd + s.rich * s.rich + s.claim * s.claim;
  return { blk: -1, pr: 0, y, v, group: 0, gv: 0, info: null };
}

export interface RowInputs {
  readonly model: PriorModel;
  readonly geo: GeometryPosterior;
  readonly depl: DepletionModel;
  readonly sbHat: number;
  readonly samples: readonly PreparedSample[];
  readonly positions: readonly (Position | null)[];
  readonly masses: readonly Mass4[];
  readonly excluded: Uint8Array;
  readonly records: readonly RecordFinding[];
  readonly ncShare: Mass4;
}

export function buildRows(inp: RowInputs, gt: Float64Array, ct: CoarseTerms): Rows {
  const n = inp.model.n;
  const nonExp: { s: PreparedSample; pos: Position; mass: Mass4 }[][] = [];
  const exp_: { s: PreparedSample; pos: Position; mass: Mass4 }[][] = [];
  for (let b = 0; b < n; b++) {
    nonExp.push([]);
    exp_.push([]);
  }
  inp.samples.forEach((s, k) => {
    const pos = inp.positions[k];
    if (pos === null || pos === undefined || inp.excluded[k] === 1 || !s.reachedPay || !(s.V > 0)) return;
    const item = { s, pos, mass: inp.masses[k] as Mass4 };
    if (s.interval === 'exposure') (exp_[s.b] as typeof nonExp[number]).push(item);
    else (nonExp[s.b] as typeof nonExp[number]).push(item);
  });
  const drafts: RowDraft[] = [];
  for (let b = 0; b < n; b++) {
    const list = nonExp[b] as typeof nonExp[number];
    if (list.length > 0) {
      const r = composite(inp.model, inp.geo, list, b, gt[b] as number, ct, inp.ncShare);
      if (r !== null) drafts.push(r);
    }
  }
  for (let b = 0; b < n; b++) {
    const list = exp_[b] as typeof nonExp[number];
    if (list.length > 0) {
      const r = composite(inp.model, inp.geo, list, b, gt[b] as number, ct, inp.ncShare);
      if (r !== null) drafts.push({ ...r, group: 1 });
    }
  }
  const rec = recordsRow(inp.model, inp.records);
  if (rec !== null) drafts.push(rec);
  const R = drafts.length;
  const out = {
    R,
    blk: new Int32Array(R),
    pr: new Float64Array(R),
    y: new Float64Array(R),
    v: new Float64Array(R),
    group: new Int8Array(R),
    gv: new Float64Array(R),
    info: drafts.map((d) => d.info),
  };
  drafts.forEach((d, j) => {
    out.blk[j] = d.blk;
    out.pr[j] = d.pr;
    out.y[j] = d.y;
    out.v[j] = d.v;
    out.group[j] = d.group;
    out.gv[j] = d.gv;
  });
  return out;
}
