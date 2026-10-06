// DESIGN §4.7 old tailings piles (s04 #3): era prior medians, log-sd 0.7, footprint volume ±30%, §3's pile size mix;
// the minable test at strip 0 and §7.16's pileRawOzEst.
import { describe, expect, it } from 'vitest';
import { exp, log } from '../../core/dmath';
import { pileMinable, pilePrior, pileRawOzEst, tailingsEraOf, TAILINGS_GRADE_LOG_SD } from './tailings';

const P = {
  tailingsPriorMedian: { handEra: 0.012, dozer: 0.005, dredge: 0.0025 },
  pileMix: { coarse: 0.05, medium: 0.2, fine: 0.45, ultrafine: 0.3 },
};
const Z90 = 1.2815515655446004;

describe('old tailings pile prior (§4.7)', () => {
  it('maps old-timer kinds to eras', () => {
    expect(tailingsEraOf('drift')).toBe('handEra');
    expect(tailingsEraOf('handCut')).toBe('handEra');
    expect(tailingsEraOf('dryWash')).toBe('handEra');
    expect(tailingsEraOf('recentCat')).toBe('dozer');
    expect(tailingsEraOf('dredge')).toBe('dredge');
    expect(tailingsEraOf('none')).toBeNull();
  });

  it('grade: era median, log sd 0.7; contained: grade × volume with the footprint ±30% in quadrature', () => {
    const e = pilePrior('handEra', 4000, P);
    expect(e.gradeP50).toBe(0.012);
    expect(e.gradeP10).toBeCloseTo(0.012 * exp(-Z90 * 0.7), 12);
    expect(e.gradeP90).toBeCloseTo(0.012 * exp(Z90 * 0.7), 12);
    expect(e.gradeMean).toBeCloseTo(0.012 * exp(0.245), 12);
    expect(e.containedOzP50).toBeCloseTo(48, 9);
    const so = Math.sqrt(TAILINGS_GRADE_LOG_SD * TAILINGS_GRADE_LOG_SD + log(1.09));
    expect(e.containedOzP90).toBeCloseTo(48 * exp(Z90 * so), 9);
    expect(e.volumeLogSd).toBeCloseTo(Math.sqrt(log(1.09)), 12);
    expect(e.sizeMix).toEqual(P.pileMix);
    expect(pilePrior('dozer', 1000, P).gradeP50).toBe(0.005);
    expect(pilePrior('dredge', 1000, P).gradeP50).toBe(0.0025);
  });

  it('is minable when gradeP50 × rec × fineness × price × payable ≥ the wash cost (strip 0)', () => {
    const e = pilePrior('handEra', 4000, P);
    // 0.012 × 0.6 × 0.86 × 4,200 × 0.95 = 24.7 $/bcy
    expect(pileMinable(e, 0.6, 0.86, 4200, 0.95, 12)).toBe(true);
    expect(pileMinable(pilePrior('dredge', 4000, P), 0.6, 0.86, 4200, 0.95, 12)).toBe(false);
  });

  it('pileRawOzEst: bcy × mean grade × Σ mix·capture·(1 − loss) ÷ (1 − dirt) (§7.16)', () => {
    const e = pilePrior('handEra', 4000, P);
    const cap = { coarse: 0.95, medium: 0.88, fine: 0.62, ultrafine: 0.25 };
    const grl = { coarse: 0.01, medium: 0.01, fine: 0.01, ultrafine: 0.01 };
    const chain = (0.05 * 0.95 + 0.2 * 0.88 + 0.45 * 0.62 + 0.3 * 0.25) * 0.99;
    expect(pileRawOzEst(500, e, cap, grl, 0.04)).toBeCloseTo((500 * e.gradeMean * chain) / 0.96, 12);
    expect(pileRawOzEst(0, e, cap, grl, 0.04)).toBe(0);
  });
});
