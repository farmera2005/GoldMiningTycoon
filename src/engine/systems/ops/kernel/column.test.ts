// DESIGN §7 7.3 formula tests (7.23 "Contact", "Bedrock table", "Gold basis") and the ruled G0 rules (s07 #6, #7, #26).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { rng } from '../../../core/rng';
import type { BlockId, ClaimId } from '../../../core/ids';
import type { VerticalProfile } from '../../world/types';
import {
  SUB_BLOCK_FACTOR_MAX,
  SUB_BLOCK_FACTOR_MIN,
  availablePayBcy,
  blockGoldAtFirstDig,
  contactExpectation,
  contactSigmaFt,
  digSkill,
  drawSubBlockFactor,
  extractSlice,
  goldParcelOf,
  goldShares,
  minableAreaFraction,
  miningLossFrac,
  payColumn,
  s3PayBcy,
  strippedFraction,
  subBlockFactor,
  type BlockGoldState,
} from './column';
import { truthCtx } from './explain';
import { DESIGN_PARAMS as P } from './testing/designTuning';

// The 7.3 worked block: T_p 5, T_b 1.5, bedrock share 0.20, λg 2.0 (§3), λb 0.6, grade 0.012, boulders 0.1.
const PROFILE: VerticalProfile = { Tg: 5, B: 1.5, sb: 0.2, lambdaG: 2.0, lambdaB: 0.6 };
const GRADE = 0.012;

describe('contact error and dilution (7.3)', () => {
  it('σ 0.6, μ 0.5 → dilFt 0.568, lossFt 0.068 (7.23)', () => {
    expect(contactSigmaFt(50, P)).toBeCloseTo(0.6, 12);
    const e = contactExpectation(0.5, 0.6);
    expect(e.dilFt).toBeCloseTo(0.568, 3);
    expect(e.lossFt).toBeCloseTo(0.068, 3);
    expect(e.dilFt - e.lossFt).toBeCloseTo(0.5, 12);
  });

  it('skill narrows σ_c; σ = 0 is the deterministic limit', () => {
    expect(contactSigmaFt(100, P)).toBeCloseTo(0.6 * 0.4, 12);
    expect(contactSigmaFt(0, P)).toBeCloseTo(0.6 * 1.6, 12);
    expect(contactExpectation(0.5, 0)).toEqual({ dilFt: 0.5, lossFt: 0 });
    expect(contactExpectation(-0.2, 0)).toEqual({ dilFt: 0, lossFt: 0.2 });
  });

  it('S_dig = 0.8 × S_op + 0.2 × qF (§8 small-crew example: 55.2)', () => {
    expect(digSkill(60, 36)).toBeCloseTo(55.2, 12);
  });
});

describe('bedrock depth and dilution (7.3 worked example)', () => {
  const g0 = blockGoldAtFirstDig({
    gradeOzPerBcy: GRADE,
    payThicknessFt: 5,
    bedrockCleanupFt: 1.5,
    minedBcy: 0,
    sampledBcy: 0,
  }).value.g0;
  const lambda = miningLossFrac(50, 0.1, P).value;

  it('G0 = 0.012 × 6.5 × 1,613 = 125.8 raw oz; λ = 0.032', () => {
    expect(g0).toBeCloseTo(125.814, 3);
    expect(lambda).toBeCloseTo(0.032, 12);
  });

  // [bedrockTakeFt, pay bcy dug, extracted, head grade, left in pit]
  const rows: [number, number, number, number, number][] = [
    [0, 9226, 97.1, 0.01053, 28.4],
    [0.5, 10065, 112.1, 0.01114, 13.4],
    [1.0, 10904, 118.7, 0.01088, 6.9],
    [1.5, 11742, 121.5, 0.01035, 4.0],
    [2.0, 12581, 121.5, 0.00966, 4.0],
  ];
  it.each(rows)('bedrock take %s ft → %s bcy, %s oz extracted (±0.1 oz)', (xb, bcy, extracted, head, left) => {
    const col = payColumn(
      { overburdenFt: 15, payThicknessFt: 5, bedrockTakeFt: xb, policy: 'standard', sDig: 50 },
      P,
    ).value;
    expect(col.payBcyTotal).toBeCloseTo(bcy, -0.5);
    expect(col.lossFt).toBeCloseTo(0.068, 3);
    const sh = goldShares(PROFILE, xb, col.lossFt).value;
    const slice = extractSlice({ goldRemaining: g0, aRemaining: 1 }, col.payBcyTotal, col.payBcyTotal, 1, sh, lambda);
    expect(slice.finished).toBe(true);
    expect(Math.abs(slice.extracted - extracted)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(slice.leftInPit - left)).toBeLessThanOrEqual(0.1);
    expect(slice.extracted / col.payBcyTotal).toBeCloseTo(head, 5);
    // 0.31 oz of the top of the pay goes to waste with the overburden.
    expect(slice.lostToWaste).toBeCloseTo(0.311, 3);
  });

  it('gold shares cover the column exactly', () => {
    for (const xb of [0, 0.7, 1.5, 3]) {
      const sh = goldShares(PROFILE, xb, 0.068).value;
      expect(sh.shareTaken + sh.shareWaste + sh.shareLeft).toBeCloseTo(1, 12);
    }
  });
});

describe('G0 rules (s07 #6, #26, D-7.4)', () => {
  it('a drifted block (current grade 0.0132, minedOutFraction 0.56) starts at G0 = 0.0132 × payBcy', () => {
    const payBcy = s3PayBcy(5, 1.5);
    const g = blockGoldAtFirstDig({
      gradeOzPerBcy: 0.0132,
      payThicknessFt: 5,
      bedrockCleanupFt: 1.5,
      minedBcy: 0,
      sampledBcy: 0,
    });
    expect(g.value.g0).toBeCloseTo(0.0132 * payBcy, 9);
    expect(g.value.g0).not.toBeCloseTo(0.0132 * payBcy * 0.44, 3);
  });

  it('nets pre-game mining and sampling, and starts areaMined at minedBcy / payBcy', () => {
    const payBcy = s3PayBcy(5, 1.5);
    const g = blockGoldAtFirstDig({
      gradeOzPerBcy: 0.01,
      payThicknessFt: 5,
      bedrockCleanupFt: 1.5,
      minedBcy: payBcy * 0.25,
      sampledBcy: 100,
    }).value;
    expect(g.areaMined0).toBeCloseTo(0.25, 12);
    expect(g.g0).toBeCloseTo(0.01 * (payBcy * 0.75 - 100), 9);
    expect(g.minedOut).toBe(false);
    const out = blockGoldAtFirstDig({
      gradeOzPerBcy: 0.01,
      payThicknessFt: 5,
      bedrockCleanupFt: 1.5,
      minedBcy: payBcy,
      sampledBcy: 0,
    }).value;
    expect(out).toEqual({ g0: 0, areaMined0: 1, minedOut: true });
  });
});

describe('pay column edge cases', () => {
  it('a pre-stripped block is stripped to the contact (μ_c = 0, σ_c kept; s07 #7)', () => {
    const col = payColumn(
      { overburdenFt: 15, payThicknessFt: 5, bedrockTakeFt: 1.5, policy: 'generous', sDig: 50, preStripped: true },
      P,
    ).value;
    expect(col.muFt).toBe(0);
    expect(col.stripFt).toBe(15);
    expect(col.columnFt).toBeCloseTo(6.5, 12);
    expect(col.dilFt).toBeCloseTo(0.6 / Math.sqrt(2 * Math.PI), 9);
    expect(col.lossFt).toBeCloseTo(col.dilFt, 12);
    expect(strippedFraction(15 * 1613, col.stripBcyTotal)).toBe(1);
  });

  it('the contact offset never exceeds the overburden; no overburden means no contact error', () => {
    const thin = payColumn(
      { overburdenFt: 0.3, payThicknessFt: 4, bedrockTakeFt: 1, policy: 'generous', sDig: 50 },
      P,
    ).value;
    expect(thin.muFt).toBeCloseTo(0.3, 12);
    expect(thin.stripFt).toBe(0);
    const bare = payColumn(
      { overburdenFt: 0, payThicknessFt: 4, bedrockTakeFt: 1, policy: 'standard', sDig: 50 },
      P,
    ).value;
    expect(bare).toMatchObject({ muFt: 0, sigmaFt: 0, dilFt: 0, lossFt: 0, stripFt: 0, columnFt: 5 });
  });

  it('clamps the bedrock take to ops.bedrockTakeFtMax', () => {
    const col = payColumn(
      { overburdenFt: 10, payThicknessFt: 4, bedrockTakeFt: 9, policy: 'tight', sDig: 50 },
      P,
    ).value;
    expect(col.bedrockFt).toBe(5);
  });
});

describe('exposure ramp (7.3)', () => {
  it('minable area ramps from strippedFrac 0.5 to 1', () => {
    expect(minableAreaFraction(0.4, P)).toBe(0);
    expect(minableAreaFraction(0.75, P)).toBeCloseTo(0.5, 12);
    expect(minableAreaFraction(1, P)).toBe(1);
    expect(availablePayBcy(0.5, 0.2, 10000)).toBeCloseTo(3000, 9);
    expect(availablePayBcy(0.2, 0.5, 10000)).toBe(0);
    expect(strippedFraction(5000, 0)).toBe(1);
    expect(strippedFraction(30000, 20000)).toBe(1);
  });
});

describe('weekly extraction (7.3, D-7.5)', () => {
  const sh = goldShares(PROFILE, 1.5, 0.068).value;
  const lambda = 0.032;

  it('conserves block gold exactly over any sequence of slices and factors (property)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.double({ min: 0, max: 4000, noNaN: true }), fc.double({ min: 0.4, max: 2.5, noNaN: true })),
          {
            minLength: 1,
            maxLength: 30,
          },
        ),
        (steps) => {
          const g0 = 125.814;
          const payBcyTotal = 11742.6;
          let st: BlockGoldState = { goldRemaining: g0, aRemaining: 1 };
          let ext = 0;
          let waste = 0;
          let left = 0;
          for (const [bcy, f] of steps) {
            const s = extractSlice(st, bcy, payBcyTotal, f, sh, lambda);
            expect(s.extracted).toBeGreaterThanOrEqual(0);
            expect(s.lostToWaste).toBeGreaterThanOrEqual(0);
            expect(s.leftInPit).toBeGreaterThanOrEqual(0);
            expect(s.goldRemaining).toBeGreaterThanOrEqual(0);
            ext += s.extracted;
            waste += s.lostToWaste;
            left += s.leftInPit;
            st = { goldRemaining: s.goldRemaining, aRemaining: s.aRemaining };
          }
          // Finish the block: the last slice takes all remaining gold.
          const last = extractSlice(st, payBcyTotal, payBcyTotal, 1, sh, lambda);
          ext += last.extracted;
          waste += last.lostToWaste;
          left += last.leftInPit;
          expect(last.goldRemaining).toBe(0);
          expect(last.aRemaining).toBe(0);
          expect(Math.abs(ext + waste + left - g0)).toBeLessThan(1e-9);
        },
      ),
    );
  });

  it('the dug area does not depend on the grade factor (re-seeding ops-grade moves ounces only)', () => {
    const st: BlockGoldState = { goldRemaining: 100, aRemaining: 0.8 };
    const a = extractSlice(st, 1200, 11742, 0.6, sh, lambda);
    const b = extractSlice(st, 1200, 11742, 1.9, sh, lambda);
    expect(a.deltaA).toBe(b.deltaA);
    expect(a.aRemaining).toBe(b.aRemaining);
    expect(a.sliceGold).not.toBe(b.sliceGold);
  });

  it('splits extracted metal by size and carries the alloy fineness', () => {
    const g = goldParcelOf(10, { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 }, 0.86);
    expect(g.rawOz.medium).toBeCloseTo(4, 12);
    expect(g.fineOz).toBeCloseTo(8.6, 12);
  });
});

describe('sub-block grade factor (7.3, s07 #9)', () => {
  it('is exp(σz − σ²/2) clamped to [0.4, 2.5]', () => {
    expect(subBlockFactor(0, 0.25)).toBeCloseTo(Math.exp(-0.03125), 12);
    expect(subBlockFactor(-20, 0.25)).toBe(SUB_BLOCK_FACTOR_MIN);
    expect(subBlockFactor(20, 0.25)).toBe(SUB_BLOCK_FACTOR_MAX);
  });

  it('takes exactly one normal from ops-grade keyed (turn, claimId, blockId)', () => {
    const claim = 'clm_000007' as ClaimId;
    const block = 'blk_000123' as BlockId;
    const d = drawSubBlockFactor('seed-1', 40, claim, block, 0.25).value;
    const z = rng('seed-1', 'ops-grade', 40, claim, block).normal();
    expect(d.z).toBe(z);
    expect(d.f).toBe(subBlockFactor(z, 0.25));
  });

  it('is isolated: other blocks, turns and streams never shift a block draw', () => {
    const claim = 'clm_000007' as ClaimId;
    const b1 = 'blk_000001' as BlockId;
    const b2 = 'blk_000002' as BlockId;
    const first = drawSubBlockFactor('s', 12, claim, b1, 0.25).value.z;
    rng('s', 'world', 'x').next();
    drawSubBlockFactor('s', 12, claim, b2, 0.25);
    drawSubBlockFactor('s', 13, claim, b1, 0.25);
    expect(drawSubBlockFactor('s', 12, claim, b1, 0.25).value.z).toBe(first);
    expect(drawSubBlockFactor('s', 13, claim, b1, 0.25).value.z).not.toBe(first);
  });

  it('has mean near one before the clamp over many keys', () => {
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++)
      sum += drawSubBlockFactor('mean', i, 'clm_000001' as ClaimId, 'blk_000001' as BlockId, 0.25).value.f;
    expect(sum / n).toBeGreaterThan(0.98);
    expect(sum / n).toBeLessThan(1.02);
  });
});

describe('explanations (§2.8)', () => {
  it('never change values, and a truth context tags input-derived nodes hidden', () => {
    const input = { overburdenFt: 15, payThicknessFt: 5, bedrockTakeFt: 1.5, policy: 'standard' as const, sDig: 50 };
    const off = payColumn(input, P);
    const on = payColumn(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(off.value);
    expect(off.calc).toBeUndefined();
    expect(on.calc?.value).toBeCloseTo(off.value.payBcyTotal, 9);
    expect(on.calc?.hidden).toBeUndefined();
    const hid = payColumn(input, P, truthCtx(EXPLAIN_ON));
    expect(hid.calc?.hidden).toBe(true);
    const tuningLeaves = (hid.calc?.children ?? []).filter((c) => c.source?.kind === 'tuning');
    expect(tuningLeaves.every((c) => c.hidden === undefined)).toBe(true);
    const draw = drawSubBlockFactor(
      's',
      1,
      'clm_000001' as ClaimId,
      'blk_000001' as BlockId,
      0.25,
      truthCtx(EXPLAIN_ON),
    );
    expect(draw.calc?.source).toEqual({ kind: 'rng', stream: 'ops-grade', key: [1, 'clm_000001', 'blk_000001'] });
    expect(draw.calc?.hidden).toBe(true);
  });
});
