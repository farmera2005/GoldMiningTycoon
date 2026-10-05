// Closed forms of §3's sample draw (DESIGN §3.8), for §4's estimator. These are formulas only: §4 feeds them its own
// estimates, never truth (D-4.15). The physics constants come from the world snapshot (world.genParams.sample).
import { log, sqrt } from '../../core/dmath';
import { MG_PER_OZ } from './constants';
import type { SamplePhysics, SizeRecord } from './types';

/** A class drops out of the typical sample when P(N = 0) > ½, i.e. λ < ln 2 ≈ 0.7 (§3.8 medianRatio). */
export const MEDIAN_LAMBDA = 0.7;

function masses(coarseMg: number, phys: SamplePhysics): [number, number, number, number] {
  return [coarseMg, phys.particleMeanMg[0], phys.particleMeanMg[1], phys.particleMeanMg[2]];
}

function shares(mix: SizeRecord): [number, number, number, number] {
  return [mix.coarse, mix.medium, mix.fine, mix.ultrafine];
}

/** m_eff = Σ_k mix_k · m_k · (1 + c_k²) in mg: the compound-Poisson effective particle mass. */
export function effectiveMassMg(mix: SizeRecord, coarseMg: number, phys: SamplePhysics): number {
  const m = masses(coarseMg, phys);
  const s = shares(mix);
  let out = 0;
  for (let k = 0; k < 4; k++) {
    const c = phys.massCv[k] as number;
    out += (s[k] as number) * (m[k] as number) * (1 + c * c);
  }
  return out;
}

/** particleCv(g, V, mix, coarseMg) = √(m_eff / (g · V · 31,103.5)). */
export function particleCv(g: number, V: number, mix: SizeRecord, coarseMg: number, phys: SamplePhysics): number {
  return sqrt(effectiveMassMg(mix, coarseMg, phys) / (g * V * MG_PER_OZ));
}

/** N_eff = g · V · K / m_eff, the equivalent particle count (±50% at 95% needs ≈ 16–20, Clifton 1969). */
export function nEff(g: number, V: number, mix: SizeRecord, coarseMg: number, phys: SamplePhysics): number {
  return (g * V * MG_PER_OZ) / effectiveMassMg(mix, coarseMg, phys);
}

/** De Wijs local log-variance σL² = α · ln(Vb / V) for V < Vb, else 0 (D-3.10). */
export function deWijsVar(V: number, Vb: number, alpha: number): number {
  return V < Vb ? alpha * log(Vb / V) : 0;
}

/** logVarMeas ≈ ln(1 + particleCv²) + α ln(Vb/V) + ln(1 + volumeCv²) + ln(1 + weighCv²) (§3.8). */
export function logVarMeas(
  g: number,
  V: number,
  mix: SizeRecord,
  coarseMg: number,
  method: { readonly volumeCv: number; readonly weighCv: number },
  Vb: number,
  phys: SamplePhysics,
): number {
  const cv = particleCv(g, V, mix, coarseMg, phys);
  return (
    log(1 + cv * cv) +
    deWijsVar(V, Vb, phys.deWijsAlpha) +
    log(1 + method.volumeCv * method.volumeCv) +
    log(1 + method.weighCv * method.weighCv)
  );
}

/** Expected particles per class: λ_k = g · V · mix_k · K / m_k. */
export function classLambdas(g: number, V: number, mix: SizeRecord, coarseMg: number, phys: SamplePhysics): [number, number, number, number] {
  const m = masses(coarseMg, phys);
  const s = shares(mix);
  return [0, 1, 2, 3].map((k) => (g * V * (s[k] as number) * MG_PER_OZ) / (m[k] as number)) as [number, number, number, number];
}

/** medianRatio ≈ Σ_k mix_k · capture_k · [λ_k ≥ 0.7]: what a typical sample reports ÷ truth (§3.8). */
export function medianRatio(
  g: number,
  V: number,
  mix: SizeRecord,
  coarseMg: number,
  capture: SizeRecord,
  phys: SamplePhysics,
): number {
  const lam = classLambdas(g, V, mix, coarseMg, phys);
  const s = shares(mix);
  const c = shares(capture);
  let out = 0;
  for (let k = 0; k < 4; k++) if ((lam[k] as number) >= MEDIAN_LAMBDA) out += (s[k] as number) * (c[k] as number);
  return out;
}
