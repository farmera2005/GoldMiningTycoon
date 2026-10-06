import { describe, expect, it } from 'vitest';
import { digamma, invTrigamma, trigamma } from './special';
import { lognormalLimit, smallCount } from './smallCount';
import { smallCountTable } from '../../../data/prospecting/smallCountTable';

describe('digamma and trigamma (§4.5.3)', () => {
  it('match known values', () => {
    expect(digamma(1)).toBeCloseTo(-0.5772156649015329, 12);
    expect(digamma(0.5)).toBeCloseTo(-1.9635100260214235, 12);
    expect(digamma(10)).toBeCloseTo(2.251752589066721, 12);
    expect(trigamma(1)).toBeCloseTo((Math.PI * Math.PI) / 6, 12);
    expect(trigamma(0.5)).toBeCloseTo((Math.PI * Math.PI) / 2, 12);
    expect(trigamma(10)).toBeCloseTo(0.10516633568168575, 12);
  });

  it('inverts trigamma', () => {
    for (const a of [0.3, 1, 4.2, 11.66, 50, 400]) expect(invTrigamma(trigamma(a))).toBeCloseTo(a, 6);
  });

  // DESIGN §4.5.3 / §4.22 print α0 = 11.66 and β0 = 34.13; the exact inverse is 11.60 (ψ₁(11.66) = 0.0895, not 0.09), and
  // β0 = e^ψ(α0)/R0 = 33.92 at R0 0.3275 (design delta: rounding in the DESIGN figures).
  it('gives the §4.5.3 Gamma prior: α0 = ψ₁⁻¹(0.30²) ≈ 11.60, β0 = e^ψ(α0)/R0', () => {
    const a0 = invTrigamma(0.3 * 0.3);
    expect(a0).toBeCloseTo(11.6036, 3);
    expect(trigamma(a0)).toBeCloseTo(0.09, 12);
    expect(Math.exp(digamma(a0)) / 0.3275).toBeCloseTo(33.92, 2);
  });
});

describe('small-count table (§4.4.4)', () => {
  const rows = smallCountTable;
  it('interpolation reproduces the grid', () => {
    for (const r of rows.slice(0, -1)) {
      const sc = smallCount(rows, r.n);
      expect(sc.b).toBeCloseTo(r.b, 12);
      expect(sc.v).toBeCloseTo(r.v, 12);
    }
  });

  it('keeps β ≥ 0.05 everywhere', () => {
    for (let x = -5; x <= 6; x += 0.05) expect(smallCount(rows, Math.exp(x)).beta).toBeGreaterThanOrEqual(0.05);
  });

  it('equals the lognormal limit to 1e-3 for N_eff ≥ 50', () => {
    for (const n of [50, 60, 100, 1000]) {
      const sc = smallCount(rows, n);
      const ln = lognormalLimit(n);
      expect(Math.abs(sc.b - ln.b)).toBeLessThan(1e-3);
      expect(Math.abs(sc.v - ln.v)).toBeLessThan(1e-3);
    }
    const last = rows[rows.length - 1] as { n: number; b: number; v: number };
    expect(Math.abs(last.b + 0.5 * Math.log(1 + 1 / last.n))).toBeLessThan(1e-3);
    expect(Math.abs(last.v - Math.log(1 + 1 / last.n))).toBeLessThan(1e-3);
  });

  it('flattens β at low counts (a zero-colour hole says only "not rich")', () => {
    expect(smallCount(rows, 0.05).beta).toBeLessThan(0.1);
    expect(smallCount(rows, 1000).beta).toBeCloseTo(1, 2);
  });
});
