// Fineness (DESIGN §4.7 "Fineness"; s04 #4, owner question Q1 answered 2026-10-06): a normal model on the claim's
// ALLOY fineness (fine oz per metal oz, §2.4) with the template prior N(mean, districtSd² + claimSd²); sample-gold
// assays observe it with sd √(assaySd² + particleSd²/n_eff), melted cleanup gold with prodSd. The assay of sample gold
// is the one draw here, keyed rng(seed, 'prospect', claimId, 'assay', n) with n = knowledge.assayCount[claimId] (a
// per-claim counter in state, §2.3 c): one normal() per assay (2 u32), always taken.
import type { ClaimId } from '../../core/ids';
import { rng } from '../../core/rng';
import type { SizeRecord } from '../world/types';
import type { ClaimPriors, FinenessAssay } from './types';

export interface FinenessParams {
  /** Lab assay error (geology.estFinenessAssaySd). */
  readonly finenessAssaySd: number;
  /** Particle-to-particle fineness spread (geology.estFinenessParticleSd). */
  readonly finenessParticleSd: number;
  /** Melted cleanup gold (geology.estFinenessProdSd). */
  readonly finenessProdSd: number;
  /** New sample gold that triggers an assay (geology.finenessAssayMinMg). */
  readonly finenessAssayMinMg: number;
}

/** Posterior P50 and sd of the claim's alloy fineness: precision-weighted normal update over the assays. */
export function finenessPosterior(
  prior: ClaimPriors['fineness'],
  assays: readonly FinenessAssay[],
): { readonly p50: number; readonly sd: number } {
  let prec = 1 / (prior.districtSd * prior.districtSd + prior.claimSd * prior.claimSd);
  let num = prior.mean * prec;
  for (const a of assays) {
    if (!(a.sd > 0)) continue;
    const p = 1 / (a.sd * a.sd);
    prec += p;
    num += a.value * p;
  }
  return { p50: num / prec, sd: Math.sqrt(1 / prec) };
}

/**
 * Effective particle count of pooled sample gold, n_eff = (Σ_c M_c)² / Σ_c (M_c² / n_c), over the sieved samples
 * weighed since the last assay (pooled class masses M_c and colours n_c; a class with mass but no logged colour counts
 * as one particle).
 */
export function assayNEff(
  samples: readonly { readonly massMg: SizeRecord | null; readonly colours: SizeRecord }[],
): number {
  const M = [0, 0, 0, 0];
  const N = [0, 0, 0, 0];
  const classes = ['coarse', 'medium', 'fine', 'ultrafine'] as const;
  for (const s of samples) {
    if (s.massMg === null) continue;
    classes.forEach((c, k) => {
      M[k] = (M[k] as number) + Math.max(0, s.massMg?.[c] ?? 0);
      N[k] = (N[k] as number) + Math.max(0, s.colours[c]);
    });
  }
  let tot = 0;
  let den = 0;
  for (let k = 0; k < 4; k++) {
    const m = M[k] as number;
    if (!(m > 0)) continue;
    tot += m;
    den += (m * m) / Math.max(1, N[k] as number);
  }
  return den > 0 ? (tot * tot) / den : 0;
}

/** Observation sd of a sample-gold assay: √(assaySd² + particleSd² / n_eff). */
export function sampleAssaySd(nEff: number, P: FinenessParams): number {
  const n = Math.max(nEff, 1);
  return Math.sqrt(P.finenessAssaySd * P.finenessAssaySd + (P.finenessParticleSd * P.finenessParticleSd) / n);
}

/** Has enough new sample gold accumulated on the claim for an automatic assay (§4.7: ≥ 300 mg)? */
export function sampleAssayDue(mgSinceAssay: number, P: FinenessParams): boolean {
  return mgSinceAssay >= P.finenessAssayMinMg;
}

/**
 * The n-th sample-gold assay of a claim (§4.7; s04 #4): the pooled gold's true alloy fineness read with the
 * observation's own error, value = truth + sd × Z, Z from rng(seed, 'prospect', claimId, 'assay', n) (one normal(),
 * 2 u32), reported to 4 dp and clamped to (0, 1). `trueAlloyFineness` is the hidden fine ÷ metal content of the
 * concentrate (knowledge.sampleConc[claimId].hidden); the result carries no truth beyond the noisy value.
 */
export function drawSampleAssay(
  seed: string,
  claimId: ClaimId,
  n: number,
  trueAlloyFineness: number,
  nEff: number,
  P: FinenessParams,
): FinenessAssay {
  const sd = sampleAssaySd(nEff, P);
  const z = rng(seed, 'prospect', claimId, 'assay', n).normal();
  const value = Math.min(0.9999, Math.max(0.0001, Math.round((trueAlloyFineness + sd * z) * 1e4) / 1e4));
  return { value, sd, source: 'sample' };
}

/** A melted cleanup lot's assay as a fineness observation (sd geology.estFinenessProdSd, §4.7). */
export function cleanupAssay(value: number, P: FinenessParams): FinenessAssay {
  return { value, sd: P.finenessProdSd, source: 'cleanup' };
}
