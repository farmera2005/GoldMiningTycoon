// Evidence preparation (DESIGN §4.3, §4.4.3, §4.6, §4.7): samples folded in ascending SampleId order, the method
// rows at the logger's SHOWN skill (D-4.9), the false-bedrock check, the claim's bedrock-type posterior, pooled
// capture-corrected class masses for the size mix and the coarse mean mass. Pure functions of the evidence.
import { compareIds, type SampleId } from '../../core/ids';
import { sqrt } from '../../core/dmath';
import { BEDROCK_TYPES } from '../world/enums';
import type { BedrockType, SampleMethodParams } from '../world/types';
import { methodSpec, noiseMult, samplerCaptureMult } from './methods';
import type { EstimatorParams } from './params';
import type { PriorModel } from './prior';
import type { SampleInterval, SampleRecord } from './types';

export type Mass4 = [number, number, number, number];

export interface PreparedSample {
  readonly rec: SampleRecord;
  readonly b: number;
  readonly draw: SampleMethodParams;
  /** Capture per class as the estimator models it (row capture × the unlogged-crew multiplier, ≤ 1). */
  readonly cap: Mass4;
  readonly volumeCv: number;
  readonly weighCv: number;
  readonly geomCv: number;
  readonly thickCv: number;
  readonly V: number;
  readonly penFt: number;
  /** Interval after the false-bedrock check (a suspect "bedrock" is re-treated as upper pay, §4.6). */
  readonly interval: SampleInterval;
  readonly suspectFalseBedrock: boolean;
  readonly hasMasses: boolean;
  readonly colours: Mass4;
  /** Sieved masses as logged (null for colour-only methods). */
  readonly massMg: Mass4 | null;
  readonly reachedPay: boolean;
}

function four(r: { coarse: number; medium: number; fine: number; ultrafine: number }): Mass4 {
  return [r.coarse, r.medium, r.fine, r.ultrafine];
}

/** Sources the estimator admits (production rows are P1's incremental path; unverified seller data never). */
function admitted(rec: SampleRecord): boolean {
  return rec.source === 'own' || rec.source === 'recordsHistoric' || rec.source === 'sellerVerified';
}

export function sortSamples(samples: readonly SampleRecord[]): SampleRecord[] {
  return samples.slice().sort((a, b) => compareIds(a.id as SampleId, b.id as SampleId));
}

/**
 * The prepared, sorted sample list. `geologistOnClaim` enables the false-bedrock check: within a block, a logged
 * bedrock contact more than 3·√(sdA² + sdB²) shallower than the deepest is flagged and treated as upper pay (§4.6).
 */
export function prepareSamples(
  model: PriorModel,
  samples: readonly SampleRecord[],
  geologistOnClaim: boolean,
  params: EstimatorParams,
): PreparedSample[] {
  const out: PreparedSample[] = [];
  for (const rec of sortSamples(samples)) {
    if (!admitted(rec)) continue;
    const b = model.indexOf[rec.blockId];
    if (b === undefined) continue;
    const spec = methodSpec(rec.methodId);
    const draw = spec.draw;
    if (draw === null) continue;
    const nm = noiseMult(rec.loggedBy.kind, rec.loggedBy.shownSkill, params);
    const cm = samplerCaptureMult(rec.loggedBy.kind, params);
    const c = four(draw.captureBySize).map((x) => Math.min(1, x * cm)) as Mass4;
    // Verified seller samples carry extra weighing noise in quadrature (§4.10.1, P2).
    const wcv = draw.weighCv * nm;
    const weighCv =
      rec.source === 'sellerVerified'
        ? sqrt(wcv * wcv + params.sellerVerifiedExtraLogSd * params.sellerVerifiedExtraLogSd)
        : wcv;
    out.push({
      rec,
      b,
      draw,
      cap: c,
      volumeCv: draw.volumeCv * nm,
      weighCv,
      geomCv: draw.geomCv * nm,
      thickCv: (draw.thickCv ?? params.phys.defaultThickCv) * nm,
      V: rec.volumeBcy,
      penFt: rec.bedrockPenFt ?? draw.bedrockPenFt,
      interval: rec.interval,
      suspectFalseBedrock: false,
      hasMasses: rec.massMg !== null,
      colours: four(rec.colours),
      massMg: rec.massMg === null ? null : four(rec.massMg),
      reachedPay: rec.interval === 'fullColumn' || rec.interval === 'upperPay' || rec.interval === 'exposure',
    });
  }
  if (!geologistOnClaim) return out;
  return flagFalseBedrock(out);
}

function flagFalseBedrock(samples: PreparedSample[]): PreparedSample[] {
  const deepest: Record<number, PreparedSample> = {};
  for (const s of samples) {
    if (s.interval !== 'fullColumn' || s.rec.observed.depthToBedrockFt === undefined) continue;
    const d = deepest[s.b];
    if (d === undefined || (s.rec.observed.depthToBedrockFt as number) > (d.rec.observed.depthToBedrockFt as number))
      deepest[s.b] = s;
  }
  return samples.map((s) => {
    const d = deepest[s.b];
    const ds = s.rec.observed.depthToBedrockFt;
    if (s.interval !== 'fullColumn' || ds === undefined || d === undefined || d === s) return s;
    const dd = d.rec.observed.depthToBedrockFt as number;
    const sdA = ds * s.geomCv;
    const sdB = dd * d.geomCv;
    if (dd - ds > 3 * sqrt(sdA * sdA + sdB * sdB)) return { ...s, interval: 'upperPay', suspectFalseBedrock: true };
    return s;
  });
}

export interface BedrockPosterior {
  readonly pType: Readonly<Record<BedrockType, number>>;
  readonly logged: boolean;
  /** Expected cleanup depth B̂, ft, and its sd (claim-level: one bedrock per claim, §3.5.3). */
  readonly bHat: number;
  readonly sdB: number;
  readonly sbHat: number;
}

/**
 * Claim-level bedrock-type posterior from logged types (each right w.p. §3's bedrockIdP, else one of the other
 * types at random). DESIGN §4.4.2 reads the type per block; §3 draws one type per claim, so every log informs every
 * block (design delta). No logs: the template's mix-weighted means and estGeomBSdUnknownFt.
 */
export function bedrockPosterior(samples: readonly PreparedSample[], model: PriorModel): BedrockPosterior {
  const params = model.params;
  const mix = model.priors.bedrockMix;
  const idP = params.phys.bedrockIdP;
  const wrong = (1 - idP) / (BEDROCK_TYPES.length - 1);
  const logw: Record<BedrockType, number> = {
    schist: 0,
    slatePhyllite: 0,
    granite: 0,
    basaltVolcanic: 0,
    clayFalse: 0,
    karstLimestone: 0,
  };
  let logged = false;
  const w: Record<BedrockType, number> = { ...logw };
  for (const t of BEDROCK_TYPES) w[t] = mix[t] ?? 0;
  for (const s of samples) {
    if (s.interval !== 'fullColumn') continue;
    const lt = s.rec.observed.bedrockType;
    if (lt === undefined) continue;
    logged = true;
    for (const t of BEDROCK_TYPES) w[t] *= t === lt ? idP : wrong;
  }
  let total = 0;
  for (const t of BEDROCK_TYPES) total += w[t];
  if (!(total > 0)) {
    for (const t of BEDROCK_TYPES) w[t] = mix[t] ?? 0;
    total = 0;
    for (const t of BEDROCK_TYPES) total += w[t];
  }
  let bHat = 0;
  let sbHat = 0;
  for (const t of BEDROCK_TYPES) {
    const p = w[t] / total;
    logw[t] = p;
    bHat += p * params.bedrock[t].cleanupFt;
    sbHat += p * params.bedrock[t].goldShare;
  }
  let sdB = params.bSdUnknownFt;
  if (logged) {
    let v = 0;
    for (const t of BEDROCK_TYPES) {
      const b0 = params.bedrock[t].cleanupFt;
      const k = b0 * params.bLogSdKnown;
      v += (logw[t] as number) * (k * k + (b0 - bHat) * (b0 - bHat));
    }
    sdB = sqrt(v);
  }
  return { pType: logw, logged, bHat, sbHat, sdB };
}

/** Pooled capture-corrected masses of mass-reporting samples that reached pay (size mix, coarse mean mass). */
export interface PooledMasses {
  readonly massByClass: Mass4;
  readonly coarseColoursCorrected: number;
}

export function pooledMasses(samples: readonly PreparedSample[]): PooledMasses {
  const m: Mass4 = [0, 0, 0, 0];
  let cc = 0;
  for (const s of samples) {
    if (!s.reachedPay || s.massMg === null) continue;
    for (let k = 0; k < 4; k++) m[k] = (m[k] as number) + (s.massMg[k] as number) / (s.cap[k] as number);
    cc += (s.colours[0] as number) / (s.cap[0] as number);
  }
  return { massByClass: m, coarseColoursCorrected: cc };
}

/**
 * Class masses of a sample as the estimator reads them: sieved masses, or (colour-only methods) the recovered total
 * split by colours_c × μ_c (§4.4.3) with the estimated coarse particle mass. No colours: all non-coarse, split by
 * the current non-coarse shares.
 */
export function classMasses(s: PreparedSample, coarseMeanMg: number, ncShare: Mass4, particleMeanMg: readonly number[]): Mass4 {
  if (s.massMg !== null) return s.massMg;
  const mu = [coarseMeanMg, particleMeanMg[0] as number, particleMeanMg[1] as number, particleMeanMg[2] as number];
  let den = 0;
  for (let k = 0; k < 4; k++) den += (s.colours[k] as number) * (mu[k] as number);
  const total = s.rec.recoveredMg;
  if (!(den > 0)) return [0, total * (ncShare[1] as number), total * (ncShare[2] as number), total * (ncShare[3] as number)];
  return [0, 1, 2, 3].map((k) => (total * (s.colours[k] as number) * (mu[k] as number)) / den) as Mass4;
}

/** Capture-corrected non-coarse mass Σ_{c≠coarse} M_c / cap_c (§4.4.3). */
export function nonCoarseMass(m: Mass4, cap: Mass4): number {
  return (m[1] as number) / (cap[1] as number) + (m[2] as number) / (cap[2] as number) + (m[3] as number) / (cap[3] as number);
}
