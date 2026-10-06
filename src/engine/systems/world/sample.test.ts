// DESIGN §3.8 drawSample and sampleGoldLines (§3.18 formula and property tests).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import type { BlockId } from '../../core/ids';
import { normInv } from '../../core/dmath';
import { rng } from '../../core/rng';
import { logVarMeas } from './closedForms';
import { snapshotGenParams } from './params';
import { DrawSampleError, UNTOUCHED_BLOCK, drawSample, sampleGoldLines, sampleInterval } from './sample';
import type { BlockState, BlockTruth, DrawContext, SampleMethodParams, SampleRequest, SampleResult } from './types';
import { positionMultProfile, profileOf } from './vertical';

const PHYS = snapshotGenParams(baseTuning, []).sample;
const CTX: DrawContext = { surface: 'u', climateBand: 'subarctic', physics: PHYS };
const CHANNEL: DrawContext = { ...CTX, surface: 'c' };
const BLOCK = 'blk_000001' as BlockId;

// T = 6, B = 1.5, s_b = 0.2, λg = 2 (the §3.8 example-3 block), unfrozen, 15 ft of cover.
const BT: BlockTruth = {
  overburdenFt: 15,
  payThicknessFt: 6,
  bedrockCleanupFt: 1.5,
  gradeOzPerBcy: 0.01,
  virginGradeOzPerBcy: 0.01,
  sizeMix: { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 },
  coarseMeanMg: 150,
  fineness: 0.86,
  permafrost: 0,
  clay: 0.15,
  boulders: 0.2,
  cementation: 0,
  bedrockType: 'schist',
  bedrockGoldShare: 0.2,
  verticalDecayFt: 2,
  paystreakFraction: 1,
  minedOutFraction: 0,
};

const PAN: SampleMethodParams = {
  id: 'pan',
  positionMode: 'exposure',
  exposureDepthFrac: 0.4,
  maxDepthFt: null,
  frozenOk: false,
  bedrockPenFt: 0,
  captureBySize: { coarse: 0.98, medium: 0.95, fine: 0.85, ultrafine: 0.5 },
  volumeCv: 0.15,
  weighCv: 0.1,
  geomCv: 0.15,
  biasMult: 1,
};
const PIT: SampleMethodParams = {
  id: 'pit3',
  positionMode: 'pit',
  maxDepthFt: 22,
  frozenOk: false,
  bedrockPenFt: 0.5,
  captureBySize: { coarse: 0.97, medium: 0.93, fine: 0.8, ultrafine: 0.45 },
  volumeCv: 0.15,
  weighCv: 0.05,
  geomCv: 0.1,
  biasMult: 1,
};
/** A perfect full-column sampler: capture 1, no noise, no bedrock. */
const IDEAL: SampleMethodParams = {
  id: 'ideal',
  positionMode: 'fullColumn',
  maxDepthFt: null,
  frozenOk: true,
  bedrockPenFt: 0,
  captureBySize: { coarse: 1, medium: 1, fine: 1, ultrafine: 1 },
  volumeCv: 0,
  weighCv: 0,
  geomCv: 0,
  thickCv: 0,
  biasMult: 1,
};

function req(volumeBcy: number, extra: Partial<SampleRequest> = {}): SampleRequest {
  return { blockId: BLOCK, volumeBcy, ...extra };
}

function draws(
  n: number,
  bt: BlockTruth,
  r: SampleRequest,
  m: SampleMethodParams,
  ctx = CTX,
  bs: BlockState = UNTOUCHED_BLOCK,
): SampleResult[] {
  const out: SampleResult[] = [];
  for (let k = 0; k < n; k++) out.push(drawSample(bt, bs, r, m, rng('test-sample', 'sample', m.id, k), ctx));
  return out;
}

const mean = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length;
const cvOf = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1)) / m;
};

describe('sampling position (§3.8 steps 1–2)', () => {
  it('an exposure pan on an unstripped non-channel block reports only overburden colours', () => {
    const rs = draws(400, BT, req(0.0067), PAN);
    for (const r of rs) {
      expect(r.reachedPay).toBe(false);
      expect(r.extractedBcy).toBe(0);
      expect(r.hidden).toEqual({ drawnRawOz: 0, recoveredRawOz: 0, accountingRawOz: 0 });
      expect(r.intervalDepthFt).toBeNull();
    }
    // obGrade = 0.03 × g: the odd colour, mostly blanks.
    const iv = sampleInterval(BT, UNTOUCHED_BLOCK, req(0.0067), PAN, CTX, 1, 0);
    expect(iv.kind).toBe('overburden');
  });

  it('on a channel block the pan samples the upper 40% of the gravel (posMult 0.304)', () => {
    const iv = sampleInterval(BT, UNTOUCHED_BLOCK, req(0.0067), PAN, CHANNEL, 1, 0);
    expect(iv.kind).toBe('inSitu');
    expect(iv.h1).toBeCloseTo(3.6, 12);
    expect(iv.h2).toBe(6);
    expect(positionMultProfile(profileOf(BT, PHYS.bedrockDecayFt), iv.h1, iv.h2)).toBeCloseTo(0.304, 3);
  });

  it('from an open cut with no interval, the face sample spans [−min(B, bedrockPenFt), T]', () => {
    const iv = sampleInterval(
      BT,
      UNTOUCHED_BLOCK,
      req(0.0067, { fromOpenCut: true }),
      { ...PAN, bedrockPenFt: 0.5 },
      CTX,
      1,
      0,
    );
    expect([iv.h1, iv.h2]).toEqual([-0.5, 6]);
    const stripped: BlockState = { ...UNTOUCHED_BLOCK, strippedBcy: 15 * 1613 };
    const iv2 = sampleInterval(BT, stripped, req(0.0067), { ...PAN, bedrockPenFt: 3 }, CTX, 1, 0);
    expect([iv2.h1, iv2.h2]).toEqual([-1.5, 6]);
  });

  it('a pit stops at its reach, the active layer in frozen ground, or water', () => {
    // 21 ft to bedrock: a 19-ft reach stops 2 ft above bedrock.
    expect(sampleInterval(BT, UNTOUCHED_BLOCK, req(3), { ...PIT, maxDepthFt: 19 }, CTX, 1, 0)).toMatchObject({
      h1: 2,
      stopReason: 'reach',
      kind: 'inSitu',
    });
    const frozen = { ...BT, permafrost: 0.8 };
    expect(sampleInterval(frozen, UNTOUCHED_BLOCK, req(3), PIT, CTX, 1, 0)).toMatchObject({
      kind: 'overburden',
      stopReason: 'frozen',
    });
    const thawed: BlockState = { ...UNTOUCHED_BLOCK, strippedBcy: 15 * 1613, thawProgress: 4 };
    expect(sampleInterval(frozen, thawed, req(3), PIT, CTX, 1, 0)).toMatchObject({
      kind: 'inSitu',
      h1: 2,
      stopReason: 'frozen',
    });
    // Water inflow (north: P 0.25 below a 6-ft water table) stops 3 ft above bedrock.
    expect(sampleInterval(BT, UNTOUCHED_BLOCK, req(3), PIT, CTX, 0.1, 3)).toMatchObject({ h1: 3, stopReason: 'water' });
    expect(sampleInterval(BT, UNTOUCHED_BLOCK, req(3), PIT, CTX, 0.3, 3)).toMatchObject({
      h1: -0.5,
      stopReason: 'none',
    });
  });
});

describe('drawSample results (§3.8)', () => {
  it('uses the pile grade and size mix for target oldTailings, and errors without a pile', () => {
    const pileMix = { coarse: 0.05, medium: 0.2, fine: 0.45, ultrafine: 0.3 };
    const withPile: BlockTruth = { ...BT, oldTailings: { bcy: 4000, gradeOzPerBcy: 0.0115, sizeMix: pileMix } };
    const rs = draws(300, withPile, req(10, { target: 'oldTailings' }), IDEAL);
    for (const r of rs) {
      expect(r.hidden.accountingRawOz).toBeCloseTo(0.0115 * 10, 12);
      expect(r.reachedPay).toBe(false);
    }
    expect(Math.abs(mean(rs.map((r) => r.reportedGradeOzPerBcy)) / 0.0115 - 1)).toBeLessThan(0.05);
    expect(() =>
      drawSample(BT, UNTOUCHED_BLOCK, req(10, { target: 'oldTailings' }), IDEAL, rng('t', 'sample', 0), CTX),
    ).toThrow(DrawSampleError);
    expect(() => drawSample(BT, UNTOUCHED_BLOCK, req(0), IDEAL, rng('t', 'sample', 0), CTX)).toThrow(DrawSampleError);
  });

  it('captures no more than was drawn, even with samplerCaptureMult 1.5', () => {
    for (const r of draws(300, BT, req(3, { samplerCaptureMult: 1.5 }), PIT)) {
      expect(r.hidden.recoveredRawOz).toBeLessThanOrEqual(r.hidden.drawnRawOz + 1e-15);
    }
  });

  it('logs pay thickness exactly with thickCv 0, and an absent thickCv behaves as 0.10', () => {
    const exact = draws(20, BT, req(3), IDEAL);
    for (const r of exact) expect(r.observed.payThicknessFt).toBe(6);
    const absent: SampleMethodParams = { ...PIT };
    const explicit: SampleMethodParams = { ...PIT, thickCv: 0.1 };
    for (let k = 0; k < 20; k++) {
      const a = drawSample(BT, UNTOUCHED_BLOCK, req(3), absent, rng('tc', 'sample', k), CTX);
      const b = drawSample(BT, UNTOUCHED_BLOCK, req(3), explicit, rng('tc', 'sample', k), CTX);
      expect(a).toEqual(b);
    }
  });

  it('is deterministic for a key, never negative, and keeps truth only under hidden', () => {
    const allowed = [
      'blockId',
      'methodId',
      'volumeBcy',
      'volumeMeasuredBcy',
      'intervalDepthFt',
      'reachedPay',
      'reachedBedrock',
      'stopReason',
      'reportedGradeOzPerBcy',
      'recoveredMg',
      'colorsBySize',
      'massBySizeMg',
      'observed',
      'extractedBcy',
      'hidden',
    ].sort();
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e6 }),
        fc.constantFrom(PAN, PIT, IDEAL),
        fc.double({ min: 0.005, max: 50, noNaN: true }),
        fc.boolean(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (k, m, V, channel, pf) => {
          const bt = { ...BT, permafrost: pf };
          const ctx = channel ? CHANNEL : CTX;
          const a = drawSample(bt, UNTOUCHED_BLOCK, req(V), m, rng('prop', 'sample', k), ctx);
          const b = drawSample(bt, UNTOUCHED_BLOCK, req(V), m, rng('prop', 'sample', k), ctx);
          expect(a).toEqual(b);
          expect(Object.keys(a).sort()).toEqual(allowed);
          expect(a.reportedGradeOzPerBcy).toBeGreaterThanOrEqual(0);
          expect(a.recoveredMg).toBeGreaterThanOrEqual(0);
          for (const v of Object.values(a.colorsBySize)) expect(v).toBeGreaterThanOrEqual(0);
          if (a.reachedBedrock) expect(a.intervalDepthFt?.[1] ?? 0).toBeGreaterThanOrEqual(a.intervalDepthFt?.[0] ?? 0);
          if (a.reachedBedrock) expect(a.reachedPay).toBe(true);
        },
      ),
      { seed: 3801, numRuns: 300 },
    );
  });
});

describe('sample statistics (§3.18 properties)', () => {
  it('is unbiased with capture 1 and no noise: the mean of 20,000 draws is within 2% of g × posMult', () => {
    const rs = draws(20_000, BT, req(3), IDEAL);
    const posMult = positionMultProfile(profileOf(BT, PHYS.bedrockDecayFt), 0, 6);
    const m = mean(rs.map((r) => r.reportedGradeOzPerBcy));
    expect(Math.abs(m / (0.01 * posMult) - 1)).toBeLessThan(0.02);
  });

  it('hits P(no coarse particle) = e^(−λ) within 1 point', () => {
    // λ_coarse at g 0.01, posMult 0.8 (full gravel column), 0.5 bcy: 0.01 × 0.8 × 0.5 × 0.25 × 31,103.5 / 150 = 0.207.
    const rs = draws(20_000, BT, req(0.5), IDEAL);
    const posMult = positionMultProfile(profileOf(BT, PHYS.bedrockDecayFt), 0, 6);
    const lambda = (0.01 * posMult * 0.5 * 0.25 * 31103.5) / 150;
    // The local factor makes λ itself lognormal; integrate e^(−λ·L) over it with the same de Wijs σ.
    const s2 = 0.028 * Math.log((7.5 * 1613) / 0.5);
    let pExpected = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const z = normInv((i + 0.5) / n);
      pExpected += Math.exp(-lambda * Math.exp(Math.sqrt(s2) * z - s2 / 2)) / n;
    }
    const pZero = rs.filter((r) => r.colorsBySize.coarse === 0).length / rs.length;
    expect(Math.abs(pZero - pExpected)).toBeLessThan(0.01);
  });

  it('matches the closed-form CV within 10% for V ≥ 3 bcy', () => {
    for (const V of [3, 10, 30]) {
      const rs = draws(6000, BT, req(V), IDEAL);
      const mc = cvOf(rs.map((r) => r.reportedGradeOzPerBcy));
      const posMult = positionMultProfile(profileOf(BT, PHYS.bedrockDecayFt), 0, 6);
      const lv = logVarMeas(0.01 * posMult, V, BT.sizeMix, 150, IDEAL, 7.5 * 1613, PHYS);
      const cf = Math.sqrt(Math.exp(lv) - 1);
      expect(Math.abs(mc / cf - 1)).toBeLessThan(0.1);
    }
  });

  it('switches Poisson and CLT approximations without bias around the thresholds', () => {
    // An all-ultrafine block with no bedrock zone: λ = g V K / m straddles the Poisson switch (30) and the exact-sum
    // limit (40 particles) across these volumes, and the mean count must follow λ on both sides.
    const ultra: BlockTruth = {
      ...BT,
      sizeMix: { coarse: 0, medium: 0, fine: 0, ultrafine: 1 },
      bedrockCleanupFt: 0,
      bedrockGoldShare: 0,
    };
    for (const V of [0.0002, 0.00035, 0.00045, 0.0006]) {
      const rs = draws(5000, ultra, req(V), IDEAL);
      // posMult 1 (no bedrock zone, full gravel), so E[N] = λ = g V K / m (the local factor has mean 1):
      // λ ≈ 16, 27, 35 and 47 particles.
      const lambda = (0.01 * V * 31103.5) / 0.004;
      const mCount = mean(rs.map((r) => r.colorsBySize.ultrafine));
      expect(Math.abs(mCount / lambda - 1)).toBeLessThan(0.04);
      const mGrade = mean(rs.map((r) => r.reportedGradeOzPerBcy));
      expect(Math.abs(mGrade / 0.01 - 1)).toBeLessThan(0.04);
    }
  });
});

describe('sampleGoldLines (§3.8, D-3.37)', () => {
  it('splits accounting gold exactly for a credited pit and an uncredited pan', () => {
    const pit = drawSample(BT, UNTOUCHED_BLOCK, req(5), PIT, rng('lines', 'sample', 1), CTX);
    const l = sampleGoldLines(pit, true);
    expect(l.accountingRawOz).toBeCloseTo(0.01 * 5, 15);
    expect(
      Math.abs(l.creditedRawOz + l.sampleCaptureLoss + l.sampleProcessingLoss + l.samplingVariance - l.accountingRawOz),
    ).toBeLessThan(1e-9);
    expect(l.sampleProcessingLoss).toBe(0);

    const pan = drawSample(BT, UNTOUCHED_BLOCK, req(0.0067), PAN, rng('lines', 'sample', 2), CHANNEL);
    const p = sampleGoldLines(pan, false);
    expect(p.creditedRawOz).toBe(0);
    expect(p.sampleProcessingLoss).toBe(pan.hidden.recoveredRawOz);
    expect(
      Math.abs(p.creditedRawOz + p.sampleCaptureLoss + p.sampleProcessingLoss + p.samplingVariance - p.accountingRawOz),
    ).toBeLessThan(1e-9);
  });

  it('books all zeros for an overburden-only pan', () => {
    const r = drawSample(BT, UNTOUCHED_BLOCK, req(0.0067), PAN, rng('lines', 'sample', 3), CTX);
    expect(sampleGoldLines(r, false)).toEqual({
      accountingRawOz: 0,
      creditedRawOz: 0,
      sampleCaptureLoss: 0,
      sampleProcessingLoss: 0,
      samplingVariance: 0,
    });
  });

  it('conserves a block’s gold over any sequence of samples (§2.14 sample terms)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.constantFrom(PAN, PIT, IDEAL), fc.double({ min: 0.005, max: 20, noNaN: true }), fc.boolean()),
          { maxLength: 12 },
        ),
        (seq) => {
          const payBcy = 7.5 * 1613;
          let sampled = 0;
          let lines = 0;
          seq.forEach(([m, V, credited], k) => {
            const bs: BlockState = { ...UNTOUCHED_BLOCK, sampledBcy: sampled };
            const r = drawSample(BT, bs, req(V), m, rng('cons', 'sample', k), CHANNEL);
            const l = sampleGoldLines(r, credited);
            sampled += r.extractedBcy;
            lines += l.creditedRawOz + l.sampleCaptureLoss + l.sampleProcessingLoss + l.samplingVariance;
          });
          const contained0 = BT.gradeOzPerBcy * payBcy;
          const remaining = BT.gradeOzPerBcy * (payBcy - sampled);
          expect(Math.abs(contained0 - remaining - lines)).toBeLessThan(1e-6);
        },
      ),
      { seed: 3802, numRuns: 200 },
    );
  });
});
