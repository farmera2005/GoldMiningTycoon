// Geometry estimation (DESIGN §4.6): Gaussian fields on ln D (depth to bedrock from the current surface) and ln T
// (pay column T = Tg + B). Each field is a claim-level deviation scaled per block by the delta method plus an iid
// block term; observations combine per block. Solve order: T, then D (with upper-pay samples observing OB + T̂g),
// then the censored-depth pseudo-observation for samples that never reached pay. The pay-column prior mean follows
// each paystreak configuration (grade and thickness both rise with f, D-4.30), sharing one covariance.
import { exp, log, normCdf, sqrt } from '../../core/dmath';
import type { PriorModel } from './prior';
import type { BedrockPosterior, PreparedSample } from './samples';

/** A field with prior x_b = μ_b + u_b·c + e_b, c ~ N(0, 1), e_b ~ N(0, tb_b), observed per block with noise v̄_b. */
export interface FieldPosterior {
  readonly mean: Float64Array;
  /** Full n × n covariance. */
  readonly cov: Float64Array;
  readonly varDiag: Float64Array;
  /** Pieces to re-solve the mean for another prior mean vector (same covariance). */
  readonly lam: Float64Array;
  readonly u: Float64Array;
  readonly tb: Float64Array;
  readonly ybar: Float64Array;
  readonly vbar: Float64Array;
  readonly observed: Uint8Array;
  readonly Pc: number;
}

interface ObsAcc {
  prec: Float64Array;
  precY: Float64Array;
}

function newAcc(n: number): ObsAcc {
  return { prec: new Float64Array(n), precY: new Float64Array(n) };
}

function addObs(acc: ObsAcc, b: number, y: number, v: number): void {
  acc.prec[b] = (acc.prec[b] as number) + 1 / v;
  acc.precY[b] = (acc.precY[b] as number) + y / v;
}

export function solveField(mu: Float64Array, u: Float64Array, tb: Float64Array, acc: ObsAcc): FieldPosterior {
  const n = mu.length;
  const ybar = new Float64Array(n);
  const vbar = new Float64Array(n);
  const observed = new Uint8Array(n);
  const lam = new Float64Array(n);
  let Pc = 1;
  let num = 0;
  for (let b = 0; b < n; b++) {
    const p = acc.prec[b] as number;
    if (!(p > 0)) continue;
    observed[b] = 1;
    ybar[b] = (acc.precY[b] as number) / p;
    vbar[b] = 1 / p;
    const d = (tb[b] as number) + (vbar[b] as number);
    Pc += ((u[b] as number) * (u[b] as number)) / d;
    num += ((u[b] as number) * ((ybar[b] as number) - (mu[b] as number))) / d;
    lam[b] = (tb[b] as number) / d;
  }
  const chat = num / Pc;
  const mean = new Float64Array(n);
  const g = new Float64Array(n);
  const varDiag = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const l = lam[b] as number;
    const ub = u[b] as number;
    mean[b] = (mu[b] as number) + l * ((ybar[b] as number) - (mu[b] as number)) + (1 - l) * ub * chat;
    g[b] = (1 - l) * ub;
  }
  const cov = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) cov[a * n + b] = ((g[a] as number) * (g[b] as number)) / Pc;
    const d = observed[a] === 1 ? (lam[a] as number) * (vbar[a] as number) : (tb[a] as number);
    cov[a * n + a] = (cov[a * n + a] as number) + d;
    varDiag[a] = cov[a * n + a] as number;
  }
  return { mean, cov, varDiag, lam, u, tb, ybar, vbar, observed, Pc };
}

/** The posterior mean for another prior mean vector (same observations and covariance): one O(n) pass. */
export function remean(field: FieldPosterior, mu: Float64Array, out: Float64Array, offset: number): void {
  const n = mu.length;
  let num = 0;
  for (let b = 0; b < n; b++) {
    if (field.observed[b] !== 1) continue;
    const d = (field.tb[b] as number) + (field.vbar[b] as number);
    num += ((field.u[b] as number) * ((field.ybar[b] as number) - (mu[b] as number))) / d;
  }
  const chat = num / field.Pc;
  for (let b = 0; b < n; b++) {
    const l = field.lam[b] as number;
    out[offset + b] =
      (mu[b] as number) + l * ((field.ybar[b] as number) - (mu[b] as number)) + (1 - l) * (field.u[b] as number) * chat;
  }
}

export interface GeometryPosterior {
  readonly T: FieldPosterior;
  readonly D: FieldPosterior;
  /** Pay-column posterior mean per paystreak configuration (S × n), ln ft. */
  readonly TbyStreak: Float64Array;
  /** Gravel thickness prior median by block (marginal f̄), ft. */
  readonly tg50: Float64Array;
  readonly bHat: number;
  readonly sdB: number;
  readonly censored: number;
}

const INV_SQRT_2PI = 0.3989422804014327;

/**
 * The Gaussian site (y, v) on x that turns the prior N(mu, s2) into the moments of the prior truncated to x < L
 * (moment matching, as expectation propagation does); null when the bound barely cuts the prior.
 */
export function upperBoundSite(mu: number, s2: number, L: number): { y: number; v: number } | null {
  const s = sqrt(s2);
  const a = (L - mu) / s;
  const Z = normCdf(a);
  if (!(Z < 0.995) || !(Z > 1e-12)) return null;
  const lam = (INV_SQRT_2PI * exp(-0.5 * a * a)) / Z;
  const mt = mu - s * lam;
  const vt = s2 * Math.max(1e-6, 1 - a * lam - lam * lam);
  const tau = 1 / vt - 1 / s2;
  if (!(tau > 1e-9)) return null;
  return { y: (mt / vt - mu / s2) / tau, v: 1 / tau };
}

/**
 * Geometry posterior. `opts.thinCover` lists blocks whose original overburden is known to be under `maxObFt`: §3's
 * hand-cutters worked only paystreak blocks under thin cover (§3.6, geology.oldTimer.kinds.handCut.maxObFt), so a
 * visibly hand-cut block bounds its depth (design delta, P0). Through the claim-level depth factor the bound also
 * thins the cover expected on the rest of the claim, which is what the workings say: hand-cut ground is shallow.
 */
export function geometryPosterior(
  model: PriorModel,
  samples: readonly PreparedSample[],
  bed: BedrockPosterior,
  strippedFt: Float64Array,
  opts: {
    readonly thinCover?: { readonly blocks: readonly number[]; readonly maxObFt: number; readonly weight: number };
    /** Moments of f per block to build the pay column on (default: the configuration prior's, model.fbar/fsd). */
    readonly streak?: { readonly fbar: Float64Array; readonly fsd: Float64Array };
  } = {},
): GeometryPosterior {
  const thinCover = opts.thinCover ?? null;
  const fbarOf = opts.streak?.fbar ?? model.fbar;
  const fsdOf = opts.streak?.fsd ?? model.fsd;
  const n = model.n;
  const g = model.priors.geometry;
  const w = model.params.payStreakWeight;
  const bHat = bed.bHat;
  const sdB = bed.sdB;
  const tg50 = new Float64Array(n);
  const muT = new Float64Array(n);
  const muD = new Float64Array(n);
  const uT = new Float64Array(n);
  const tbT = new Float64Array(n);
  const uD = new Float64Array(n);
  const tbD = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const fb = fbarOf[b] as number;
    const tg = g.payMedFt * (1 - w + w * fb);
    tg50[b] = tg;
    const T50 = tg + bHat;
    const ob = Math.max(0, (model.ob50[b] as number) - (strippedFt[b] as number));
    const D50 = ob + tg;
    const sf = (w * (fsdOf[b] as number)) / (1 - w + w * fb);
    muT[b] = log(T50);
    muD[b] = log(D50);
    uT[b] = sqrt((tg * tg * g.paySigClaim * g.paySigClaim + sdB * sdB) / (T50 * T50));
    tbT[b] = (tg * tg * (g.paySigBlock * g.paySigBlock + sf * sf)) / (T50 * T50);
    uD[b] = sqrt((ob * ob * g.obSigClaim * g.obSigClaim + tg * tg * g.paySigClaim * g.paySigClaim) / (D50 * D50));
    tbD[b] =
      (ob * ob * g.obSigBlock * g.obSigBlock + tg * tg * (g.paySigBlock * g.paySigBlock + sf * sf)) / (D50 * D50);
  }

  // T observations: bedrock-logged samples log Tg with the method's thickCv (§4.6 table).
  const accT = newAcc(n);
  for (const s of samples) {
    const tgObs = s.rec.observed.payThicknessFt;
    if (s.interval !== 'fullColumn' || tgObs === undefined || !(tgObs > 0)) continue;
    const T = tgObs + bHat;
    const v = (tgObs / T) * (tgObs / T) * log(1 + s.thickCv * s.thickCv) + (sdB / T) * (sdB / T);
    addObs(accT, s.b, log(T), v);
  }
  const T = solveField(muT, uT, tbT, accT);

  // D observations.
  const accD = newAcc(n);
  for (const s of samples) {
    const d = s.rec.observed.depthToBedrockFt;
    if (s.interval === 'fullColumn' && d !== undefined && d > 0) {
      addObs(accD, s.b, log(d), log(1 + s.geomCv * s.geomCv));
    }
  }
  for (const s of samples) {
    const ob = s.rec.observed.overburdenFt;
    if (s.interval !== 'upperPay' || ob === undefined) continue;
    const Tc = exp(T.mean[s.b] as number);
    const tg = Math.max(0.5, Tc - bHat);
    const Dv = ob + tg;
    const vT = T.varDiag[s.b] as number;
    const v = (ob * s.geomCv * (ob * s.geomCv) + tg * tg * vT * ((Tc / tg) * (Tc / tg))) / (Dv * Dv);
    addObs(accD, s.b, log(Dv), v);
  }
  if (thinCover !== null) {
    // OB_orig < maxObFt ⇔ D_now < max(0, maxObFt − stripped) + Tg: one moment-matched site on ln D per block, from the
    // block's prior marginal (claim factor and block term) and the prior gravel thickness.
    for (const b of thinCover.blocks) {
      const bound = Math.max(0.5, thinCover.maxObFt - (strippedFt[b] as number)) + (tg50[b] as number);
      const site = upperBoundSite(
        muD[b] as number,
        (uD[b] as number) * (uD[b] as number) + (tbD[b] as number),
        log(bound),
      );
      if (site !== null && thinCover.weight > 0) addObs(accD, b, site.y, site.v / thinCover.weight);
    }
  }
  let D = solveField(muD, uD, tbD, accD);
  // Censoring (§4.6): a sample that never reached pay says only D > h; add ln(1.15 h) when the median sits below 1.1 h.
  let censored = 0;
  for (const s of samples) {
    if (s.interval !== 'overburdenOnly' || s.rec.methodId === 'pan') continue;
    const h = s.rec.depthReachedFt;
    if (!(h > 0)) continue;
    if (exp(D.mean[s.b] as number) < model.params.censorTrigger * h) {
      addObs(accD, s.b, log(model.params.censorPadFactor * h), model.params.censorLogSd * model.params.censorLogSd);
      censored++;
    }
  }
  if (censored > 0) D = solveField(muD, uD, tbD, accD);

  // Pay column by paystreak configuration (same observations, configuration-specific prior mean).
  const S = model.S;
  const TbyStreak = new Float64Array(S * n);
  const muS = new Float64Array(n);
  for (let s = 0; s < S; s++) {
    for (let b = 0; b < n; b++) {
      const f = model.streakF[s * n + b] as number;
      muS[b] = log(g.payMedFt * (1 - w + w * f) + bHat);
    }
    remean(T, muS, TbyStreak, s * n);
  }
  return { T, D, TbyStreak, tg50, bHat, sdB, censored };
}
