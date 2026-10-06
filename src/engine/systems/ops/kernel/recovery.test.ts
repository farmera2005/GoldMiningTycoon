// DESIGN §7 7.9 recovery (7.23 "Recovery", the overfeed curve, worked examples A and B) and the 7.14 re-run and audit
// fixtures. 7.9's tables leave out the oversize term, so the table fixtures run with ops.oversizeCoarseLoss = 0; the
// oversize test covers the DESIGN default separately.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import {
  auditEstimateBySize,
  captureBySize,
  circuitBlend,
  containedInWash,
  recoveryOfMix,
  riffleLossExp,
  splitRecovery,
  tailingsAuditSigma,
  type CaptureInput,
  type ConcentratorInput,
} from './recovery';
import { DESIGN_PARAMS, designParamsWith } from './testing/designTuning';
import type { Prep, SizeRecord } from './types';

const P = designParamsWith({ oversizeCoarseLoss: 0 });

const FINE_GOLD: SizeRecord = { coarse: 0.05, medium: 0.2, fine: 0.45, ultrafine: 0.3 };
const TYPICAL: SizeRecord = { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 };
const COARSE: SizeRecord = { coarse: 0.45, medium: 0.35, fine: 0.15, ultrafine: 0.05 };

const JIG_L: ConcentratorInput = { id: 'mch_000101', device: 'jig', fineTreatCapBcyHr: 70 };
const JIG_S: ConcentratorInput = { id: 'mch_000102', device: 'jig', fineTreatCapBcyHr: 25 };
const CEN_L: ConcentratorInput = { id: 'mch_000103', device: 'centrifuge', fineTreatCapBcyHr: 90 };
const CEN_M: ConcentratorInput = { id: 'mch_000104', device: 'centrifuge', fineTreatCapBcyHr: 35 };

function capture(
  opts: Partial<CaptureInput> & { prep?: Prep; concentrators?: ConcentratorInput[]; feed?: number } = {},
  p = P,
): SizeRecord {
  const prep = opts.prep ?? 'trommel';
  const blend = circuitBlend(
    { prep, concentrators: opts.concentrators ?? [], feedRateBcyHr: opts.feed ?? 40 },
    p,
  ).value;
  return captureBySize(
    {
      B: opts.B ?? blend.B,
      prep,
      phi: opts.phi ?? 1,
      omega: opts.omega ?? 1,
      skillMult: opts.skillMult ?? 1,
      tempBand: opts.tempBand ?? 'mild',
      clay: opts.clay ?? 0,
      hasScrubber: opts.hasScrubber ?? false,
      nuggetTrap: opts.nuggetTrap ?? false,
      riffle: opts.riffle ?? { bcyWashedSinceCleanup: 0, rEff: 40, gradePad: 0.01 },
      eventExpMult: opts.eventExpMult ?? 1,
      ...(opts.hardnessExp === undefined ? {} : { hardnessExp: opts.hardnessExp }),
    },
    p,
  ).value.capture;
}

describe('sluice capture and the overfeed curve (7.9)', () => {
  it('sluice capture at φ 1.2 = [0.9454, 0.8453, 0.4640, 0.1078] (7.23)', () => {
    const c = capture({ phi: 1.2 });
    expect(c.coarse).toBeCloseTo(0.9454, 4);
    expect(c.medium).toBeCloseTo(0.8453, 4);
    expect(c.fine).toBeCloseTo(0.464, 4);
    expect(c.ultrafine).toBeCloseTo(0.1078, 4);
  });

  // φ, coarse, medium, fine, ultrafine, fine-loss multiple
  const curve: [number, number, number, number, number, number][] = [
    [0.8, 0.952, 0.891, 0.669, 0.312, 0.87],
    [1.0, 0.95, 0.88, 0.62, 0.25, 1.0],
    [1.1, 0.948, 0.863, 0.542, 0.169, 1.21],
    [1.2, 0.945, 0.845, 0.464, 0.108, 1.41],
    [1.25, 0.944, 0.836, 0.426, 0.084, 1.51],
    [1.5, 0.939, 0.791, 0.254, 0.019, 1.96],
  ];
  it.each(curve)('φ %s → %s / %s / %s / %s, fine losses × %s', (phi, c, m, f, uf, lossX) => {
    const cap = capture({ phi });
    expect(cap.coarse).toBeCloseTo(c, 3);
    expect(cap.medium).toBeCloseTo(m, 3);
    expect(cap.fine).toBeCloseTo(f, 3);
    expect(cap.ultrafine).toBeCloseTo(uf, 3);
    expect((1 - cap.fine) / (1 - 0.62)).toBeCloseTo(lossX, 2);
  });

  it('lean water: ω 0.8 fine 0.505, ω 0.6 fine 0.339', () => {
    expect(capture({ omega: 0.8 }).fine).toBeCloseTo(0.505, 3);
    expect(capture({ omega: 0.6 }).fine).toBeCloseTo(0.339, 3);
  });
});

describe('worked example A: circuit vs particle size (7.9)', () => {
  it('fine-gold ground: sluice 0.5775, + jig 0.7795, + centrifuge 0.8470 (7.23); 12.71 oz of 22.0 by size', () => {
    expect(recoveryOfMix(FINE_GOLD, capture())).toBeCloseTo(0.5775, 4);
    expect(recoveryOfMix(FINE_GOLD, capture({ concentrators: [JIG_L] }))).toBeCloseTo(0.7795, 4);
    expect(recoveryOfMix(FINE_GOLD, capture({ concentrators: [CEN_L] }))).toBeCloseTo(0.847, 4);
    const contained: SizeRecord = { coarse: 1.1, medium: 4.4, fine: 9.9, ultrafine: 6.6 };
    const r = splitRecovery(contained, capture()).recovered;
    expect(r.coarse).toBeCloseTo(1.045, 3);
    expect(r.medium).toBeCloseTo(3.87, 2);
    expect(r.fine).toBeCloseTo(6.14, 2);
    expect(r.ultrafine).toBeCloseTo(1.65, 2);
  });

  it('undersized units blend: jigS on 40 bcy/hr treats 62.5% → 0.7037 (7.23); cenM treats 87.5% → 0.813', () => {
    const jig = circuitBlend({ prep: 'trommel', concentrators: [JIG_S], feedRateBcyHr: 40 }, P).value;
    expect(jig.treated[0]!.share).toBeCloseTo(0.625, 12);
    expect(jig.circuit).toBe('sluice+jig');
    expect(recoveryOfMix(FINE_GOLD, capture({ concentrators: [JIG_S] }))).toBeCloseTo(0.7037, 3);
    expect(recoveryOfMix(FINE_GOLD, capture({ concentrators: [CEN_M] }))).toBeCloseTo(0.813, 3);
  });

  it('typical creek 77.7 / 88.2 / 90.7%; coarse ground 84.1 / 90.9 / 92.4%', () => {
    expect(recoveryOfMix(TYPICAL, capture())).toBeCloseTo(0.777, 3);
    expect(recoveryOfMix(TYPICAL, capture({ concentrators: [JIG_L] }))).toBeCloseTo(0.882, 3);
    expect(recoveryOfMix(TYPICAL, capture({ concentrators: [CEN_L] }))).toBeCloseTo(0.907, 3);
    expect(recoveryOfMix(COARSE, capture())).toBeCloseTo(0.841, 3);
    expect(recoveryOfMix(COARSE, capture({ concentrators: [JIG_L] }))).toBeCloseTo(0.909, 3);
    expect(recoveryOfMix(COARSE, capture({ concentrators: [CEN_L] }))).toBeCloseTo(0.924, 3);
  });

  it('a grizzly dump box (unclassified feed) drops fine-gold ground to 0.5241 on the sluice (7.23)', () => {
    expect(recoveryOfMix(FINE_GOLD, capture({ prep: 'grizzly' }))).toBeCloseTo(0.5241, 4);
  });

  it('fills concentrators best-first: a centrifuge before a jig, the sluice takes the rest', () => {
    const b = circuitBlend({ prep: 'trommel', concentrators: [JIG_S, CEN_M], feedRateBcyHr: 40 }, P).value;
    expect(b.treated.map((t) => t.id)).toEqual([CEN_M.id, JIG_S.id]);
    expect(b.treated[0]!.share).toBeCloseTo(0.875, 12);
    expect(b.treated[1]!.share).toBeCloseTo(0.125, 12);
    expect(b.sluiceShare).toBeCloseTo(0, 12);
    expect(b.circuit).toBe('sluice+jig+centrifuge');
  });

  it('a dry washer uses its own base capture and no concentrators', () => {
    const b = circuitBlend({ prep: 'dryWasher', concentrators: [CEN_L], feedRateBcyHr: 20 }, P).value;
    expect(b.circuit).toBe('dryWasher');
    expect(b.B).toEqual(DESIGN_PARAMS.baseCapture.dryWasher);
    const dry = capture({ prep: 'dryWasher', omega: 0.5, tempBand: 'cold' });
    expect(dry.fine).toBeCloseTo(0.35, 12);
  });
});

describe('worked example B: overfeeding at 120% (7.9)', () => {
  it('fine-gold ground: 57.8% → 45.7%, gold per hour 0.231 → 0.220; underfeed at 80% → 62.0% and 0.199', () => {
    const at1 = recoveryOfMix(FINE_GOLD, capture());
    const over = recoveryOfMix(FINE_GOLD, capture({ phi: 1.2 }));
    const under = recoveryOfMix(FINE_GOLD, capture({ phi: 0.8 }));
    // DESIGN prints 45.8% and 62.1%; the unrounded model gives 45.75% and 62.05%.
    expect(over).toBeCloseTo(0.4575, 3);
    expect(under).toBeCloseTo(0.6205, 3);
    expect(40 * 0.01 * at1).toBeCloseTo(0.231, 3);
    expect(48 * 0.01 * over).toBeCloseTo(0.22, 3);
    expect(32 * 0.01 * under).toBeCloseTo(0.199, 3);
  });

  it('coarse ground: 84.1% → 79.6%, gold per hour 0.336 → 0.382', () => {
    const over = recoveryOfMix(COARSE, capture({ phi: 1.2 }));
    expect(over).toBeCloseTo(0.796, 3);
    expect(48 * 0.01 * over).toBeCloseTo(0.382, 3);
  });
});

describe('re-running tailings (7.14)', () => {
  // The 7.9 A fine-gold sluice-only plant left 9.30 oz in 2,200 bcy (mix 1/6/40/53%).
  const contained: SizeRecord = { coarse: 1.1, medium: 4.4, fine: 9.9, ultrafine: 6.6 };
  const lost = splitRecovery(contained, capture()).lost;
  const lostOz = lost.coarse + lost.medium + lost.fine + lost.ultrafine;

  it('the sluice loses 9.30 oz, mostly fine and ultrafine', () => {
    expect(lostOz).toBeCloseTo(9.295, 3);
    expect(lost.ultrafine / lostOz).toBeCloseTo(0.53, 2);
  });

  it('re-run through the same sluice: 31.7%; through a centrifuge: 71.3% (hardness exponent 1.5)', () => {
    const mix: SizeRecord = {
      coarse: lost.coarse / lostOz,
      medium: lost.medium / lostOz,
      fine: lost.fine / lostOz,
      ultrafine: lost.ultrafine / lostOz,
    };
    const hard = DESIGN_PARAMS.rerunHardnessExp;
    expect(recoveryOfMix(mix, capture({ hardnessExp: hard }))).toBeCloseTo(0.317, 3);
    expect(recoveryOfMix(mix, capture({ hardnessExp: hard, concentrators: [CEN_L] }))).toBeCloseTo(0.713, 3);
  });

  it('an old hand-era pile at 0.008 oz/bcy (no hardness penalty): $16.5/bcy on a sluice, $24.2 with a centrifuge', () => {
    const usd = (r: number) => 0.008 * r * 0.85 * 4200;
    expect(usd(recoveryOfMix(FINE_GOLD, capture()))).toBeCloseTo(16.5, 1);
    expect(usd(recoveryOfMix(FINE_GOLD, capture({ concentrators: [CEN_L] })))).toBeCloseTo(24.2, 1);
  });
});

describe('the other loss terms (7.9)', () => {
  it('oversize takes 1% of the coarse gold (0.2% with a nugget trap) at the DESIGN default', () => {
    expect(capture({}, DESIGN_PARAMS).coarse).toBeCloseTo(0.95 * 0.99, 12);
    expect(capture({ nuggetTrap: true }, DESIGN_PARAMS).coarse).toBeCloseTo(0.95 * 0.998, 12);
    expect(capture({}, DESIGN_PARAMS).fine).toBeCloseTo(0.62, 12);
  });

  it('clay loss = clay × 0.20 × the scrub factor of the prep (a scrubber 0.10)', () => {
    expect(capture({ clay: 0.5 }).medium).toBeCloseTo(0.88 * (1 - 0.5 * 0.2 * 0.3), 12);
    expect(capture({ clay: 0.5, prep: 'grizzly' }).medium).toBeCloseTo(0.88 * (1 - 0.1), 12);
    expect(capture({ clay: 0.5, hasScrubber: true }).medium).toBeCloseTo(0.88 * (1 - 0.01), 12);
  });

  it('cold water raises the fine and ultrafine exponent only', () => {
    const cold = capture({ tempBand: 'cold' });
    expect(cold.coarse).toBeCloseTo(0.95, 12);
    expect(cold.fine).toBeCloseTo(Math.pow(0.62, 1.12), 12);
    expect(capture({ tempBand: 'cool' }).ultrafine).toBeCloseTo(Math.pow(0.25, 1.05), 12);
  });

  it('riffle loading: none until H*, then +0.10 per 25 h (coarse half), capped at 1.6', () => {
    const p = P;
    const r = (bcy: number, grade = 0.01) => ({ bcyWashedSinceCleanup: bcy, rEff: 50, gradePad: grade });
    expect(riffleLossExp(r(5000), 'fine', p)).toBe(1);
    expect(riffleLossExp(r(6250), 'fine', p)).toBeCloseTo(1.1, 12);
    expect(riffleLossExp(r(6250), 'coarse', p)).toBeCloseTo(1.05, 12);
    expect(riffleLossExp(r(1e7), 'fine', p)).toBe(1.6);
    // Rich ground (0.04 oz/bcy) loads the riffles twice as fast: H* = 50 h.
    expect(riffleLossExp(r(3750, 0.04), 'fine', p)).toBeCloseTo(1.1, 12);
    // P3 wear: a half-worn riffle set × (1 + 0.6 × 0.5).
    expect(riffleLossExp({ bcyWashedSinceCleanup: 0, rEff: 50, gradePad: 0.01, health: 0.5 }, 'fine', p)).toBeCloseTo(
      1.3,
      12,
    );
  });

  it('events scale the exponent', () => {
    expect(capture({ eventExpMult: 2 }).fine).toBeCloseTo(0.62 * 0.62, 12);
  });
});

describe('recovery properties (7.23)', () => {
  const arb = fc.record({
    phi: fc.double({ min: 0, max: 1.5, noNaN: true }),
    omega: fc.double({ min: 0.3, max: 1.2, noNaN: true }),
    skill: fc.double({ min: 0, max: 100, noNaN: true }),
    clay: fc.double({ min: 0, max: 1, noNaN: true }),
    bcy: fc.double({ min: 0, max: 20000, noNaN: true }),
    prep: fc.constantFrom<Prep>('trommel', 'shakerDeck', 'grizzly', 'dryWasher'),
  });
  // §8 skillRecoveryMult (D-7.20): 1.5 at 0 … 1.0 at 55 … 0.75 at 100.
  const skillMult = (s: number) => (s <= 55 ? 1.5 - s / 110 : 1 - (s - 55) / 180);

  it('capture stays in [0, 1] and higher plant-operator skill never lowers any capture', () => {
    fc.assert(
      fc.property(arb, fc.double({ min: 0, max: 100, noNaN: true }), (a, more) => {
        const base = {
          phi: a.phi,
          omega: a.omega,
          clay: a.clay,
          prep: a.prep,
          riffle: { bcyWashedSinceCleanup: a.bcy, rEff: 50, gradePad: 0.01 },
        };
        const lo = capture({ ...base, skillMult: skillMult(a.skill) });
        const hi = capture({ ...base, skillMult: skillMult(Math.min(100, a.skill + more)) });
        for (const s of ['coarse', 'medium', 'fine', 'ultrafine'] as const) {
          expect(lo[s]).toBeGreaterThanOrEqual(0);
          expect(lo[s]).toBeLessThanOrEqual(1);
          expect(hi[s]).toBeGreaterThanOrEqual(lo[s] - 1e-12);
        }
      }),
    );
  });

  it('a rising φ above 1 never raises fine or ultrafine capture', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1.5, noNaN: true }),
        fc.double({ min: 1, max: 1.5, noNaN: true }),
        (a, b) => {
          const lo = capture({ phi: Math.min(a, b) });
          const hi = capture({ phi: Math.max(a, b) });
          expect(hi.fine).toBeLessThanOrEqual(lo.fine + 1e-12);
          expect(hi.ultrafine).toBeLessThanOrEqual(lo.ultrafine + 1e-12);
        },
      ),
    );
  });

  it('per week, contained = recovered + lost', () => {
    fc.assert(
      fc.property(
        fc.record({
          coarse: fc.double({ min: 0, max: 50, noNaN: true }),
          medium: fc.double({ min: 0, max: 50, noNaN: true }),
          fine: fc.double({ min: 0, max: 50, noNaN: true }),
          ultrafine: fc.double({ min: 0, max: 50, noNaN: true }),
        }),
        fc.double({ min: 0, max: 1.5, noNaN: true }),
        (c, phi) => {
          const r = splitRecovery(c, capture({ phi }));
          for (const s of ['coarse', 'medium', 'fine', 'ultrafine'] as const) {
            expect(r.recovered[s] + r.lost[s]).toBeCloseTo(c[s], 12);
            expect(r.lost[s]).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });
});

describe('washing and the audit', () => {
  it('washing W bcy from a well-mixed pad takes W / pad of its gold', () => {
    const c = containedInWash(500, { coarse: 2, medium: 4, fine: 2, ultrafine: 0.8 }, 2000);
    expect(c.medium).toBeCloseTo(1, 12);
    expect(containedInWash(5000, { coarse: 2, medium: 4, fine: 2, ultrafine: 0.8 }, 2000).fine).toBe(2);
    expect(containedInWash(10, { coarse: 1, medium: 1, fine: 1, ultrafine: 1 }, 0).coarse).toBe(0);
  });

  it('the audit noise narrows with plant skill; z = 0 gives the mean-one estimate', () => {
    expect(tailingsAuditSigma(0, P)).toBe(0.5);
    expect(tailingsAuditSigma(100, P)).toBeCloseTo(0.15, 12);
    expect(tailingsAuditSigma(55, P)).toBeCloseTo(0.3075, 12);
    const e = auditEstimateBySize(
      { coarse: 0.1, medium: 0.5, fine: 2, ultrafine: 3 },
      { coarse: 0, medium: 0, fine: 0, ultrafine: 1 },
      0.2,
    );
    expect(e.fine).toBeCloseTo(2 * Math.exp(-0.02), 12);
    expect(e.ultrafine).toBeCloseTo(3 * Math.exp(0.2 - 0.02), 12);
  });

  it('explanations never change the capture', () => {
    const input: CaptureInput = {
      B: P.baseCapture.sluice,
      prep: 'trommel',
      phi: 1.1,
      omega: 0.9,
      skillMult: 1.04,
      tempBand: 'cool',
      clay: 0.2,
      hasScrubber: false,
      nuggetTrap: false,
      riffle: { bcyWashedSinceCleanup: 4000, rEff: 40, gradePad: 0.012 },
      eventExpMult: 1,
    };
    const on = captureBySize(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(captureBySize(input, P).value);
    expect(on.calc?.children).toHaveLength(4);
  });
});
