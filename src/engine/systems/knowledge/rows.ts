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
const GH_W = [0.019953242059045913, 0.3936193231522412, 0.9453087204829419, 0.3936193231522412, 0.019953242059045913];
const SQRT2 = 1.4142135623730951;

export interface Position {
  readonly pm: number;
  /** Position log-variance of this sample (independent). */
  readonly v: number;
  /**
   * Shared position variance: the claim's exposure error group for exposures (§4.4.2), and for upper-pay samples the
   * profile term estPosUpperExtraLogSd² (design delta: §3 draws λg once per claim, so every short pit on a claim
   * shares its error; DESIGN treats it as independent per sample, which over-trusts many short pits).
   */
  readonly shared: number;
}

export function blockProfile(
  model: PriorModel,
  geo: GeometryPosterior,
  depl: DepletionModel,
  sbHat: number,
  b: number,
  lnT: number,
): VerticalProfile {
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

/** Physicists' 3-point Gauss–Hermite nodes and weights, for the penetration's logging error. */
const GH3_X = [-1.224744871391589, 0, 1.224744871391589];
const GH3_W = [0.2954089751509193, 1.1816359006036774, 0.2954089751509193];

/**
 * Upper-pay position (§4.4.2, D-4.32): Gauss–Hermite average of ln positionMult(Tg_q − p, Tg_q) over the pay-column
 * posterior (5 points, Tg_q = exp(ln T̂ + √2·sd·z_q) − B̂) and over the penetration p (3 points, sd `penSdFt`). p is the
 * dug depth (known exactly, §3.8 logged interval) less the logged cover, so it carries the cover's logging error
 * (design delta, P0): where a pit stops a foot or two into the gravel, as on covered ground at the machine's reach,
 * ln positionMult is steep in p, and the average and its variance account for that error instead of trusting p.
 */
export function upperPayPosition(
  prof: VerticalProfile,
  lnT: number,
  sdT: number,
  penetratedFt: number,
  P: { readonly posFullLogSd: number; readonly posUpperExtraLogSd: number },
  penSdFt = 0,
): Position {
  let sw = 0;
  let e1 = 0;
  let e2 = 0;
  const kMax = penSdFt > 0 ? 3 : 1;
  for (let k = 0; k < kMax; k++) {
    const pen = Math.max(0.1, penetratedFt + (kMax > 1 ? SQRT2 * penSdFt * (GH3_X[k] as number) : 0));
    const wk = kMax > 1 ? (GH3_W[k] as number) : 1;
    for (let q = 0; q < 5; q++) {
      const tq = Math.max(0.5, exp(lnT + SQRT2 * sdT * (GH_X[q] as number)) - prof.B);
      const h1 = Math.min(Math.max(0.02 * tq, tq - pen), 0.98 * tq);
      const pmq = positionMultProfile({ ...prof, Tg: tq }, h1, tq);
      const lp = log(Math.max(pmq, 1e-12));
      const wq = wk * (GH_W[q] as number);
      sw += wq;
      e1 += wq * lp;
      e2 += wq * lp * lp;
    }
  }
  e1 /= sw;
  e2 /= sw;
  return {
    pm: exp(e1),
    v: Math.max(0, e2 - e1 * e1) + P.posFullLogSd * P.posFullLogSd,
    shared: P.posUpperExtraLogSd * P.posUpperExtraLogSd,
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
      const logged = s.rec.observed.overburdenFt;
      const obObs = logged ?? exp(geo.D.mean[b] as number) - prof.Tg;
      // The cover's logging error (geomCv) is the penetration's; without a logged cover, the depth posterior's.
      const obSd = logged !== undefined ? logged * s.geomCv : obObs * sqrt(geo.D.varDiag[b] as number);
      return upperPayPosition(prof, lnT, sqrt(geo.T.varDiag[b] as number), s.rec.depthReachedFt - obObs, P, obSd);
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

/** Shared error groups of the rows (§4.4.2, §4.4.6): each is one claim-level error its rows share. */
export const GROUP_NONE = 0;
export const GROUP_EXPOSURE = 1;
export const GROUP_UPPER_PAY = 2;
/** The claim's production recovery error, `prodRecovery:claimId` (estProdRecoveryLogSd², §4.4.6). */
export const GROUP_PROD_RECOVERY = 3;

export interface Rows {
  readonly R: number;
  /** Block of a grade row; −1 for the records row (claim mean only). */
  readonly blk: Int32Array;
  /** p_b: the row's coefficient on r is −p_b. */
  readonly pr: Float64Array;
  readonly y: Float64Array;
  readonly v: Float64Array;
  /** Shared error group (GROUP_*). */
  readonly group: Int8Array;
  readonly gv: Float64Array;
  /**
   * Variance of the claim-level error every SAMPLE row shares (estClaimSharedLogSd², §4.4.3): block and exposure
   * composites, not the creek-history row and not production rows, which carry their own recovery error instead
   * (capture, profile and lab errors of sampling do not touch a plant's cleanup).
   */
  readonly common: number;
  readonly info: readonly (RowInfo | null)[];
}

/** Does row j carry the claim-shared sample error? */
export function isSampleRow(rows: Rows, j: number): boolean {
  return (rows.blk[j] as number) >= 0 && rows.group[j] !== GROUP_PROD_RECOVERY;
}

/** One production row of the posterior (§4.4.6): m + e_b with no coarse term. */
export interface ProductionRowInput {
  readonly blk: number;
  readonly y: number;
  readonly v: number;
  /** estProdRecoveryLogSd²: the claim's shared recovery error. */
  readonly shared: number;
}

/** `rows` with production rows appended, in the given order (each pass appends the same rows). */
export function withProductionRows(rows: Rows, prod: readonly ProductionRowInput[]): Rows {
  if (prod.length === 0) return rows;
  const R = rows.R + prod.length;
  const out = {
    R,
    blk: new Int32Array(R),
    pr: new Float64Array(R),
    y: new Float64Array(R),
    v: new Float64Array(R),
    group: new Int8Array(R),
    gv: new Float64Array(R),
    common: rows.common,
    info: [...rows.info, ...prod.map(() => null)],
  };
  out.blk.set(rows.blk);
  out.pr.set(rows.pr);
  out.y.set(rows.y);
  out.v.set(rows.v);
  out.group.set(rows.group);
  out.gv.set(rows.gv);
  prod.forEach((p, i) => {
    const j = rows.R + i;
    out.blk[j] = p.blk;
    out.pr[j] = 0;
    out.y[j] = p.y;
    out.v[j] = p.v;
    out.group[j] = GROUP_PROD_RECOVERY;
    out.gv[j] = p.shared;
  });
  return out;
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

/** One sample's part in a composite (§4.4.3). */
export interface CompositePart {
  readonly V: number;
  readonly pm: number;
  readonly vPos: number;
  readonly shared: number;
  readonly cap: Mass4;
  readonly volumeCv: number;
  readonly weighCv: number;
  /** Class masses as read (sieved, or the colour split), mg. */
  readonly mass: Mass4;
}

export interface CompositeObservation {
  /** y_nc + E[w_b]: the observation of m + e_b − p_b·r. */
  readonly y: number;
  readonly v: number;
  readonly shared: number;
  readonly nEff: number;
  readonly muStar: number;
  readonly cvL: number;
  readonly cvM: number;
  readonly info: RowInfo;
}

export interface CompositeConstants {
  readonly particleMeanMg: readonly number[];
  readonly massCv: readonly number[];
  readonly deWijsAlpha: number;
  readonly smallCount: Parameters<typeof smallCount>[0];
  readonly modelErrorLogSd: number;
  readonly coarseBlockLogSd: number;
}

/**
 * The non-coarse composite of samples on one block (§4.4.3) with the small-count correction (§4.4.4): `gt` is the
 * working non-coarse grade G̃nc of the pass, Vb the block's pay-column volume, Ew and p the block's coarse terms.
 */
export function compositeObservation(
  parts: readonly CompositePart[],
  Vb: number,
  gt: number,
  Ew: number,
  pb: number,
  ncShare: Mass4,
  K: CompositeConstants,
): CompositeObservation | null {
  const mu = K.particleMeanMg;
  const cv = K.massCv;
  let mncTotal = 0;
  let Veff = 0;
  let Pm = 0;
  for (const q of parts) {
    const ve = q.V * q.pm;
    mncTotal += nonCoarseMass(q.mass, q.cap);
    Veff += ve;
    let muK = 0;
    for (let c = 1; c < 4; c++) {
      const cc = cv[c] as number;
      muK += ((ncShare[c] as number) * (mu[c - 1] as number) * (1 + cc * cc)) / (q.cap[c] as number);
    }
    Pm += ve * muK;
  }
  if (!(Veff > 0)) return null;
  let cvL = 0;
  let cvM = 0;
  let vpos = 0;
  let load = 0;
  for (const q of parts) {
    const w = (q.V * q.pm) / Veff;
    if (q.V < Vb) cvL += w * w * (pow(Vb / q.V, K.deWijsAlpha) - 1);
    cvM += w * w * ((1 + q.volumeCv * q.volumeCv) * (1 + q.weighCv * q.weighCv) - 1);
    vpos += w * w * q.vPos;
    load += w * sqrt(q.shared);
  }
  // A common position factor with loading √shared per sample: the composite's loading is Σ w_k √shared_k.
  const shared = load * load;
  const muStar = Pm / Veff;
  const nEff = (gt * MG_PER_OZ * Veff) / muStar;
  const ghat = Math.max(mncTotal, 0.5 * muStar) / (Veff * MG_PER_OZ);
  const sc = smallCount(K.smallCount, nEff);
  const lG = log(gt);
  const lgObs = log(ghat);
  const lnLM = log((1 + cvL) * (1 + cvM));
  const vOther =
    lnLM + vpos + K.modelErrorLogSd * K.modelErrorLogSd + pb * pb * K.coarseBlockLogSd * K.coarseBlockLogSd;
  return {
    y: lG + (lgObs - lG - sc.b) / sc.beta + 0.5 * lnLM + Ew,
    v: sc.v / (sc.beta * sc.beta) + vOther,
    shared,
    nEff,
    muStar,
    cvL,
    cvM,
    info: { nEff, lgObs, Ew, Veff, muStar, corr: 0.5 * lnLM, vOther },
  };
}

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
  const Vb = exp(geo.T.mean[b] as number) * BCY_PER_ACRE_FT * (model.acres[b] as number);
  const parts: CompositePart[] = list.map((q) => ({
    V: q.s.V,
    pm: q.pos.pm,
    vPos: q.pos.v,
    shared: q.pos.shared,
    cap: q.s.cap,
    volumeCv: q.s.volumeCv,
    weighCv: q.s.weighCv,
    mass: q.mass,
  }));
  const o = compositeObservation(parts, Vb, gt, ct.Ew[b] as number, ct.p[b] as number, ncShare, {
    particleMeanMg: P.phys.particleMeanMg,
    massCv: P.phys.massCv,
    deWijsAlpha: P.phys.deWijsAlpha,
    smallCount: P.smallCount,
    modelErrorLogSd: P.modelErrorLogSd,
    coarseBlockLogSd: P.coarseBlockLogSd,
  });
  if (o === null) return null;
  return {
    blk: b,
    pr: ct.p[b] as number,
    y: o.y,
    v: o.v,
    group: o.shared > 0 ? GROUP_UPPER_PAY : GROUP_NONE,
    gv: o.shared,
    info: o.info,
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
  for (const r of records)
    if (r.item === 'creekHistory' && (r.payload.histOz ?? 0) > 0 && (r.payload.histBcy ?? 0) > 0) hist = r;
  if (hist === null) return null;
  const P = model.params;
  const s = model.priors.sigma;
  // The history observes the creek median gMed × district × creek factors (§3.6). The claim mean m also carries the
  // visible deposit and status multipliers of the prior (logGradeMedian − ln gMed; design delta: DESIGN §4.5.2 omits
  // them, which reads benches 0.8× and deep muck 1.3× off) and the claim deviation (in the variance); the rich stretch
  // term lives in the block field. The calibration valve estPriorMedianAdj moves the prior only, not this observation.
  const y =
    log((hist.payload.histOz as number) / (hist.payload.histBcy as number)) -
    log(P.historicGradeRatio) +
    (model.priors.logGradeMedian - log(model.tpl.gMed));
  const v = P.creekProdLogSd * P.creekProdLogSd + s.claim * s.claim;
  return { blk: -1, pr: 0, y, v, group: GROUP_NONE, gv: 0, info: null };
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
    if (s.interval === 'exposure') (exp_[s.b] as (typeof nonExp)[number]).push(item);
    else (nonExp[s.b] as (typeof nonExp)[number]).push(item);
  });
  const drafts: RowDraft[] = [];
  for (let b = 0; b < n; b++) {
    const list = nonExp[b] as (typeof nonExp)[number];
    if (list.length > 0) {
      const r = composite(inp.model, inp.geo, list, b, gt[b] as number, ct, inp.ncShare);
      if (r !== null) drafts.push(r);
    }
  }
  for (let b = 0; b < n; b++) {
    const list = exp_[b] as (typeof nonExp)[number];
    if (list.length > 0) {
      const r = composite(inp.model, inp.geo, list, b, gt[b] as number, ct, inp.ncShare);
      if (r !== null) drafts.push({ ...r, group: GROUP_EXPOSURE });
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
    common: inp.model.params.claimSharedLogSd * inp.model.params.claimSharedLogSd,
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
