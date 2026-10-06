// The coarse factor (DESIGN §4.5.3, D-4.2): R = coarse ÷ non-coarse gold of the paystreak centre, block b's ratio
// a_b·R with a_b = thin + (1 − thin)·f̄_b (§3 thins coarse gold off the channel). Exact Gamma–Poisson on effective
// counts: κ = 1 + cv² of the coarse mass for sieved samples, raw colour counts for colour-only samples; a per-block
// cap φ_b keeps one block from pinning the claim.
import { exp, log } from '../../core/dmath';
import type { PriorModel } from './prior';
import { classMasses, nonCoarseMass, type Mass4, type PreparedSample, type PooledMasses } from './samples';
import { digamma, trigamma } from './special';

export interface CoarsePosterior {
  readonly alpha: number;
  readonly beta: number;
  /** E[ln R] = ψ(α) − ln β and Var[ln R] = ψ₁(α). */
  readonly mr: number;
  readonly vr: number;
  /** μ̂_c, mg: coarse mean particle mass shrunk toward the template's. */
  readonly coarseMeanMg: number;
  readonly coarseColours: number;
}

/** μ̂_c = (n0·coarseMg_tpl + Σ coarse mass) / (n0 + Σ coarse colours / cap) over sieved samples. */
export function coarseMeanMass(model: PriorModel, pooled: PooledMasses): number {
  const n0 = model.params.coarseMassPriorCount;
  return (n0 * model.priors.coarseMeanMg + (pooled.massByClass[0] as number)) / (n0 + pooled.coarseColoursCorrected);
}

/** One production row's sieved masses as the coarse factor reads them (DESIGN §4.4.6 "Coarse factor"). */
export interface ProductionCoarse {
  readonly b: number;
  /** Coarse metal mg as caught, and the chain's coarse capture (recovered ÷ in-situ metal). */
  readonly coarseMg: number;
  readonly coarseCap: number;
  /** Capture-corrected (in-situ) non-coarse metal mg: Σ_{s≠coarse} M_s / c_s. */
  readonly ncInSituMg: number;
}

/**
 * The Gamma–Poisson update of §4.5.3 on per-block effective counts N_b and exposures E_b: each block is capped by
 * φ_b = 1 / (1 + R̃ E_b σ²_coarseBlock) so no block pins the claim (D-4.37); α = α0 + Σ φ_b N_b, β = β0 + Σ φ_b E_b,
 * E[ln R] = ψ(α) − ln β, Var[ln R] = ψ₁(α).
 */
export function gammaPoissonUpdate(
  alpha0: number,
  beta0: number,
  N: Float64Array,
  E: Float64Array,
  rTilde: number,
  blockLogVar: number,
): { alpha: number; beta: number; mr: number; vr: number } {
  let alpha = alpha0;
  let beta = beta0;
  for (let b = 0; b < N.length; b++) {
    const e = E[b] as number;
    if (!(e > 0) && !((N[b] as number) > 0)) continue;
    const phi = 1 / (1 + rTilde * e * blockLogVar);
    alpha += phi * (N[b] as number);
    beta += phi * e;
  }
  return { alpha, beta, mr: digamma(alpha) - log(beta), vr: trigamma(alpha) };
}

export function coarsePosterior(
  model: PriorModel,
  samples: readonly PreparedSample[],
  aBlock: Float64Array,
  rTilde: number,
  coarseMeanMg: number,
  ncShare: Mass4,
  excluded: Uint8Array,
  production: readonly ProductionCoarse[] = [],
): CoarsePosterior {
  const kappa = 1 + (model.params.phys.massCv[0] as number) * (model.params.phys.massCv[0] as number);
  const n = model.n;
  const N = new Float64Array(n);
  const E = new Float64Array(n);
  let colours = 0;
  samples.forEach((s, k) => {
    if (!s.reachedPay || s.interval === 'exposure' || excluded[k] === 1) return;
    const m = classMasses(s, coarseMeanMg, ncShare, model.params.phys.particleMeanMg);
    const mnc = nonCoarseMass(m, s.cap);
    const a = aBlock[s.b] as number;
    const cap0 = s.cap[0] as number;
    if (s.massMg !== null) {
      N[s.b] = (N[s.b] as number) + (s.massMg[0] as number) / (coarseMeanMg * kappa);
      E[s.b] = (E[s.b] as number) + (cap0 * mnc * a) / (coarseMeanMg * kappa);
    } else {
      N[s.b] = (N[s.b] as number) + (s.colours[0] as number);
      E[s.b] = (E[s.b] as number) + (cap0 * mnc * a) / coarseMeanMg;
    }
    colours += s.colours[0] as number;
  });
  // Production: the sieved masses of each cleanup attributed to b, read like a bulk sample's class masses (§4.4.6).
  for (const p of production) {
    const a = aBlock[p.b] as number;
    N[p.b] = (N[p.b] as number) + p.coarseMg / (coarseMeanMg * kappa);
    E[p.b] = (E[p.b] as number) + (p.coarseCap * p.ncInSituMg * a) / (coarseMeanMg * kappa);
  }
  const c2 = model.params.coarseBlockLogSd * model.params.coarseBlockLogSd;
  const g = gammaPoissonUpdate(model.coarse.alpha0, model.coarse.beta0, N, E, rTilde, c2);
  return { alpha: g.alpha, beta: g.beta, mr: g.mr, vr: g.vr, coarseMeanMg, coarseColours: colours };
}

export interface CoarseTerms {
  /** p_b = a_b e^{m_r} / (1 + a_b e^{m_r}): the block's coarse share at the posterior. */
  readonly p: Float64Array;
  /** E[w_b] = ln(1 + a_b e^{m_r}) + ½ p_b(1 − p_b) v_r: the total ÷ non-coarse log-grade offset. */
  readonly Ew: Float64Array;
}

export function coarseTerms(aBlock: Float64Array, mr: number, vr: number): CoarseTerms {
  const n = aBlock.length;
  const p = new Float64Array(n);
  const Ew = new Float64Array(n);
  const R = exp(mr);
  for (let b = 0; b < n; b++) {
    const Rb = (aBlock[b] as number) * R;
    const pb = Rb / (1 + Rb);
    p[b] = pb;
    Ew[b] = log(1 + Rb) + 0.5 * pb * (1 - pb) * vr;
  }
  return { p, Ew };
}
