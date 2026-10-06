// The tabulated Φ and φ of the mixture quantiles (normal.ts): within their interpolation error of dmath's exact forms
// everywhere on the table, 0/1 beyond it, and Φ monotone.
import { describe, expect, it } from 'vitest';
import { exp, normCdf } from '../../core/dmath';
import { NORMAL_Z_FAR, stdNormCdf, stdNormCdfPdf, stdNormPdf } from './normal';

const INV_SQRT_2PI = 0.3989422804014327;

describe('tabulated standard normal (normal.ts)', () => {
  it('matches dmath Φ to 6e-12 and φ to 2e-11 on a fine grid', () => {
    let worstCdf = 0;
    let worstPdf = 0;
    for (let k = -90000; k <= 90000; k++) {
      const z = k / 10000 + 0.0000137;
      worstCdf = Math.max(worstCdf, Math.abs(stdNormCdf(z) - normCdf(z)));
      worstPdf = Math.max(worstPdf, Math.abs(stdNormPdf(z) - INV_SQRT_2PI * exp(-0.5 * z * z)));
    }
    expect(worstCdf).toBeLessThan(6e-12);
    expect(worstPdf).toBeLessThan(2e-11);
  });

  it('is 0 and 1 beyond ±8.5 and monotone inside', () => {
    expect(stdNormCdf(-NORMAL_Z_FAR - 1e-9)).toBe(0);
    expect(stdNormCdf(NORMAL_Z_FAR)).toBe(1);
    expect(stdNormPdf(9)).toBe(0);
    let prev = -1;
    for (let k = -8500; k <= 8500; k++) {
      const v = stdNormCdf(k / 1000);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('the paired form equals the two single forms', () => {
    const out = new Float64Array(2);
    for (const z of [-8.49, -3.3, -0.1, 0, 0.77, 2.5, 8.4999]) {
      stdNormCdfPdf(z, out);
      expect(out[0]).toBe(stdNormCdf(z));
      expect(out[1]).toBe(stdNormPdf(z));
    }
  });
});
