// DESIGN §3.8 closed forms for §4's estimator (§3.18 formula tests and worked example 1).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { classLambdas, deWijsVar, effectiveMassMg, logVarMeas, medianRatio, nEff, particleCv } from './closedForms';
import { snapshotGenParams } from './params';
import type { SizeRecord } from './types';

const PHYS = snapshotGenParams(baseTuning, []).sample;
const MID: SizeRecord = { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 };
const PROX: SizeRecord = { coarse: 0.45, medium: 0.35, fine: 0.15, ultrafine: 0.05 };
const FAN: SizeRecord = { coarse: 0.1, medium: 0.3, fine: 0.4, ultrafine: 0.2 };

describe('particle statistics (§3.8)', () => {
  it('m_eff (mid-reach, 150 mg coarse) = 189.9 mg, coarse gold 99% of it', () => {
    const m = effectiveMassMg(MID, 150, PHYS);
    expect(m).toBeCloseTo(189.94, 2);
    expect((0.25 * 150 * 5) / m).toBeGreaterThan(0.98);
  });

  it('particleCv(0.01, 10, mid, 150) = 0.247 ± 0.002 and N_eff = 1 / CV²', () => {
    const cv = particleCv(0.01, 10, MID, 150, PHYS);
    expect(Math.abs(cv - 0.247)).toBeLessThan(0.002);
    expect(nEff(0.01, 10, MID, 150, PHYS)).toBeCloseTo(1 / (cv * cv), 9);
  });

  it('matches worked example 1 (g 0.01, coarse 150 mg): particle CV proximal / mid / fan', () => {
    const rows: [number, number, number, number][] = [
      // V, proximal, mid, fan
      [0.0067, 12.8, 9.6, 6.1],
      [0.5, 1.48, 1.11, 0.7],
      [3, 0.6, 0.45, 0.29],
      [10, 0.33, 0.25, 0.16],
      [300, 0.06, 0.05, 0.03],
    ];
    // The table prints two significant figures (or two decimals below 0.1).
    const near = (got: number, want: number): void => {
      expect(Math.abs(got - want)).toBeLessThanOrEqual(want >= 0.1 ? 0.051 * want : 0.0051);
    };
    for (const [V, p, m, f] of rows) {
      near(particleCv(0.01, V, PROX, 150, PHYS), p);
      near(particleCv(0.01, V, MID, 150, PHYS), m);
      near(particleCv(0.01, V, FAN, 150, PHYS), f);
    }
  });

  it('scales as 1/√(g·V)', () => {
    const a = particleCv(0.01, 3, MID, 150, PHYS);
    expect(particleCv(0.04, 3, MID, 150, PHYS)).toBeCloseTo(a / 2, 12);
    expect(particleCv(0.01, 12, MID, 150, PHYS)).toBeCloseTo(a / 2, 12);
  });
});

describe('local variability, the de Wijs law (D-3.10)', () => {
  it('σL²(V = Vb) = 0 and σL(1 bcy, Vb 8,000) = 0.502', () => {
    expect(deWijsVar(8000, 8000, PHYS.deWijsAlpha)).toBe(0);
    expect(deWijsVar(9000, 8000, PHYS.deWijsAlpha)).toBe(0);
    expect(Math.sqrt(deWijsVar(1, 8000, PHYS.deWijsAlpha))).toBeCloseTo(0.502, 3);
  });

  it('gives worked example 1’s σL column (Vb 8,000)', () => {
    const rows: [number, number][] = [
      [0.0067, 0.63],
      [0.5, 0.52],
      [3, 0.47],
      [10, 0.43],
      [30, 0.4],
      [300, 0.3],
      [1000, 0.24],
    ];
    for (const [V, s] of rows) expect(Math.sqrt(deWijsVar(V, 8000, PHYS.deWijsAlpha))).toBeCloseTo(s, 2);
  });

  it('logVarMeas adds the particle, local and measurement terms', () => {
    const method = { volumeCv: 0.15, weighCv: 0.05 };
    const cv = particleCv(0.01, 3, MID, 150, PHYS);
    const want =
      Math.log(1 + cv * cv) + 0.028 * Math.log(8000 / 3) + Math.log(1 + 0.15 * 0.15) + Math.log(1 + 0.05 * 0.05);
    expect(logVarMeas(0.01, 3, MID, 150, method, 8000, PHYS)).toBeCloseTo(want, 12);
    // Total CV for the mid-reach 3-bcy pit ≈ 0.71 without measurement noise (worked example 1).
    const noiseless = logVarMeas(0.01, 3, MID, 150, { volumeCv: 0, weighCv: 0 }, 8000, PHYS);
    expect(Math.sqrt(Math.exp(noiseless) - 1)).toBeCloseTo(0.71, 1);
  });
});

describe('medianRatio (§3.8)', () => {
  it('drops classes with λ < 0.7: a proximal pan keeps only fine and ultrafine colours', () => {
    const lam = classLambdas(0.01, 0.0067, PROX, 150, PHYS);
    // Worked example 2 (proximal, 150 mg coarse): λ ≈ 0.006 coarse, 0.24 medium, 3.1 fine, 26 ultrafine per pan.
    expect(lam[0]).toBeCloseTo(0.006, 3);
    expect(lam[1]).toBeCloseTo(0.243, 2);
    expect(lam[2]).toBeCloseTo(3.13, 1);
    expect(lam[3]).toBeCloseTo(26.1, 0);
    const pan = { coarse: 0.98, medium: 0.95, fine: 0.85, ultrafine: 0.5 };
    expect(medianRatio(0.01, 0.0067, PROX, 150, pan, PHYS)).toBeCloseTo(0.15 * 0.85 + 0.05 * 0.5, 12);
    // A 10-bcy pit sees every class.
    expect(medianRatio(0.01, 10, PROX, 150, pan, PHYS)).toBeCloseTo(
      0.45 * 0.98 + 0.35 * 0.95 + 0.15 * 0.85 + 0.05 * 0.5,
      12,
    );
  });
});
