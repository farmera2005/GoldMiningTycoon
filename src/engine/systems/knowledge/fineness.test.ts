// DESIGN §4.7 fineness: the worked update (prior 0.86 ± 0.032, pooled pit gold 0.835 ± 0.0158 → 0.840 ± 0.014), the
// sample-assay observation sd and n_eff, and the assay draw's key rng(seed, 'prospect', claimId, 'assay', n) (s04 #4,
// owner question Q1): deterministic, one draw per assay, isolated from the claim's other draws and other claims.
import { describe, expect, it } from 'vitest';
import type { ClaimId } from '../../core/ids';
import { rng } from '../../core/rng';
import {
  assayNEff,
  cleanupAssay,
  drawSampleAssay,
  finenessPosterior,
  sampleAssayDue,
  sampleAssaySd,
  type FinenessParams,
} from './fineness';

const P: FinenessParams = {
  finenessAssaySd: 0.008,
  finenessParticleSd: 0.08,
  finenessProdSd: 0.005,
  finenessAssayMinMg: 300,
};
// North template: N(0.86, districtSd² + claimSd²) with sd 0.032.
const NORTH = { mean: 0.86, districtSd: 0.025, claimSd: Math.sqrt(0.032 * 0.032 - 0.025 * 0.025) };

describe('fineness posterior (§4.7 worked example)', () => {
  it('prior 0.86 ± 0.032 and an assay of 0.835 ± 0.0158 give 0.840 ± 0.014', () => {
    const post = finenessPosterior(NORTH, [{ value: 0.835, sd: 0.0158, source: 'sample' }]);
    expect(post.p50).toBeCloseTo(0.84, 3);
    expect(post.sd).toBeCloseTo(0.014, 3);
  });

  it('no assay: the prior', () => {
    const post = finenessPosterior(NORTH, []);
    expect(post.p50).toBe(0.86);
    expect(post.sd).toBeCloseTo(0.032, 12);
  });

  it('a melted cleanup lot observes with sd 0.005', () => {
    expect(cleanupAssay(0.85, P)).toEqual({ value: 0.85, sd: 0.005, source: 'cleanup' });
  });
});

describe('sample-gold assays (§4.7)', () => {
  it('observation sd √(0.008² + 0.08²/n_eff): 0.0158 at n_eff 34.5', () => {
    expect(sampleAssaySd(34.5, P)).toBeCloseTo(0.0158, 4);
    expect(sampleAssaySd(1e9, P)).toBeCloseTo(0.008, 6);
  });

  it('n_eff = (Σ M_c)² / Σ (M_c² / n_c) over pooled sieved samples', () => {
    const s = {
      massMg: { coarse: 150, medium: 60, fine: 20, ultrafine: 2 },
      colours: { coarse: 1, medium: 20, fine: 200, ultrafine: 500 },
    };
    const M = [150, 60, 20, 2];
    const N = [1, 20, 200, 500];
    const tot = M.reduce((a, b) => a + b, 0);
    const den = M.reduce((a, m, i) => a + (m * m) / (N[i] as number), 0);
    expect(assayNEff([s])).toBeCloseTo((tot * tot) / den, 12);
    // Pooling two identical samples doubles every count and mass: n_eff doubles.
    expect(assayNEff([s, s])).toBeCloseTo((2 * (tot * tot)) / den, 9);
    // Colour-only samples carry no masses.
    expect(assayNEff([{ massMg: null, colours: s.colours }])).toBe(0);
  });

  it('runs at ≥ 300 mg of new sample gold', () => {
    expect(sampleAssayDue(299.99, P)).toBe(false);
    expect(sampleAssayDue(300, P)).toBe(true);
  });

  it('draws on rng(seed, prospect, claimId, assay, n): deterministic, one normal per assay', () => {
    const claim = 'clm_000042' as ClaimId;
    const a = drawSampleAssay('seed-1', claim, 0, 0.86, 40, P);
    const b = drawSampleAssay('seed-1', claim, 0, 0.86, 40, P);
    expect(b).toEqual(a);
    const z = rng('seed-1', 'prospect', claim, 'assay', 0).normal();
    expect(a.value).toBeCloseTo(Math.round((0.86 + sampleAssaySd(40, P) * z) * 1e4) / 1e4, 12);
    expect(a.sd).toBeCloseTo(sampleAssaySd(40, P), 12);
    expect(a.source).toBe('sample');
    // The next assay of the claim (counter n + 1) is a fresh draw; another claim's are its own.
    const next = drawSampleAssay('seed-1', claim, 1, 0.86, 40, P);
    const other = drawSampleAssay('seed-1', 'clm_000043' as ClaimId, 0, 0.86, 40, P);
    expect(next.value).not.toBe(a.value);
    expect(other.value).not.toBe(a.value);
  });

  it('never leaves (0, 1)', () => {
    for (let n = 0; n < 50; n++) {
      const v = drawSampleAssay('s', 'clm_000001' as ClaimId, n, 0.9995, 0.01, P).value;
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });
});
