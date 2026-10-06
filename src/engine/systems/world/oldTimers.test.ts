// DESIGN §3.6 old-timer depletion, tailings piles and the drift worked example (§3.18 depletion tests).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { rng } from '../../core/rng';
import type { GenClaim } from './genTypes';
import { applyOldTimers, depleteAgain, deplete, depletionRemoval, tailingsPile } from './oldTimers';
import { snapshotGenParams, templateOf } from './params';
import type { Mix4, WorkBlock } from './truth';
import type { RegionTemplate } from './types';

const HAND: Mix4 = [1.3, 1.1, 0.7, 0.3];
const DREDGE: Mix4 = [1.1, 1.05, 0.9, 0.6];
const CAP = 0.95;

function block(virgin: number, mix: Mix4, T = 6, B = 1.5): WorkBlock {
  return {
    i: 0,
    j: 0,
    gStreak: virgin,
    overburdenFt: 8,
    payThicknessFt: T,
    bedrockCleanupFt: B,
    gradeOzPerBcy: virgin,
    virginGradeOzPerBcy: virgin,
    mix: [...mix] as Mix4,
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
    pocket: null,
    oldTailings: null,
  };
}

const sum = (m: readonly number[]): number => m.reduce((a, x) => a + x, 0);

describe('deplete: water-filling removal (§3.6)', () => {
  it('removes exactly x of the gold for any mix and x ≤ 0.92, capping each class at 95%', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0.01, max: 1, noNaN: true }),
          fc.double({ min: 0.01, max: 1, noNaN: true }),
          fc.double({ min: 0.01, max: 1, noNaN: true }),
          fc.double({ min: 0.01, max: 1, noNaN: true }),
        ),
        fc.double({ min: 0, max: 0.92, noNaN: true }),
        fc.boolean(),
        (raw, x, dredge) => {
          const s = sum(raw);
          const mix = raw.map((v) => v / s);
          const w = dredge ? DREDGE : HAND;
          const removed = depletionRemoval(mix, x, w, CAP);
          expect(Math.abs(sum(removed) - x)).toBeLessThan(1e-9);
          removed.forEach((r, k) => {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(CAP * (mix[k] as number) + 1e-12);
          });
        },
      ),
      { seed: 3601, numRuns: 500 },
    );
  });

  it('handles a dredge x = 0.92 on a 45%-coarse mix by passing capped excess to finer classes', () => {
    const mix = [0.45, 0.35, 0.15, 0.05];
    const removed = depletionRemoval(mix, 0.92, DREDGE, CAP);
    expect(Math.abs(sum(removed) - 0.92)).toBeLessThan(1e-9);
    // Coarse and medium hit the 95% cap; the rest of the 0.92 comes from fine and ultrafine gold.
    expect(removed[0]).toBeCloseTo(0.95 * 0.45, 12);
    expect(removed[1]).toBeCloseTo(0.95 * 0.35, 12);
  });

  it('leaves the current grade at virgin × (1 − x) and a normalized post-depletion mix', () => {
    const b = block(0.03, [0.25, 0.4, 0.27, 0.08]);
    deplete(b, 0.56, HAND, CAP);
    expect(b.gradeOzPerBcy).toBeCloseTo(0.03 * 0.44, 15);
    expect(b.minedOutFraction).toBe(0.56);
    expect(sum(b.mix)).toBeCloseTo(1, 12);
    // Hand methods take coarse gold preferentially: the coarse share falls.
    expect(b.mix[0]).toBeLessThan(0.25);
  });
});

describe('the drift worked example (§3.6)', () => {
  it('gives in-place 0.0132 and a 0.0115 oz/bcy dump', () => {
    // Virgin 0.030, T + B = 7.5 ft (payBcy 12,098), extraction x = 0.75 × 0.75 ≈ 0.56, hand recovery 75%,
    // dump 5 × 1,613 × 0.55 = 4,436 bcy.
    const b = block(0.03, [0.25, 0.4, 0.27, 0.08], 6, 1.5);
    const x = 0.56;
    deplete(b, x, HAND, CAP);
    tailingsPile(b, x, 0.75, 5 * 1613 * 0.55, [0.05, 0.2, 0.45, 0.3]);
    expect(b.gradeOzPerBcy).toBeCloseTo(0.0132, 4);
    expect(b.oldTailings?.gradeOzPerBcy).toBeCloseTo(0.0115, 4);
    // 203 oz removed, 51 oz lost to the dump.
    expect(0.56 * 0.03 * 7.5 * 1613).toBeCloseTo(203.2, 1);
    expect((b.oldTailings?.gradeOzPerBcy ?? 0) * (b.oldTailings?.bcy ?? 0)).toBeCloseTo(50.8, 1);
  });
});

describe('a second depletion (§3.6, §3.6.1)', () => {
  it('removes Δ more of the virgin gold: Δ = 0.10 on x = 0.56 gives minedOutFraction 0.66', () => {
    const b = block(0.03, [0.25, 0.4, 0.27, 0.08]);
    deplete(b, 0.56, HAND, CAP);
    depleteAgain(b, 0.1, HAND, CAP, 0.92);
    expect(b.minedOutFraction).toBeCloseTo(0.66, 12);
    expect(b.gradeOzPerBcy).toBeCloseTo(0.03 * 0.34, 12);
    expect(sum(b.mix)).toBeCloseTo(1, 12);
  });

  it('never exceeds the 0.92 ceiling', () => {
    const b = block(0.03, [0.25, 0.4, 0.27, 0.08]);
    deplete(b, 0.9, DREDGE, CAP);
    depleteAgain(b, 0.1, HAND, CAP, 0.92);
    expect(b.minedOutFraction).toBeCloseTo(0.92, 12);
  });
});

describe('dredge workings (§3.6)', () => {
  const gp = snapshotGenParams(baseTuning, ['northernFederal']);
  const north = templateOf(gp, 'northernFederal');
  // Every dredged parcel on this template is worked by a dredge.
  const tpl: RegionTemplate = { ...north, oldTimerMix: { ...north.oldTimerMix, dredgedGround: { dredge: 1 } } };
  const K = { depositType: 'dredgedGround', nAlong: 2, nAcross: 4 } as unknown as GenClaim;
  const minF = gp.oldTimer.kinds.dredge.minF;
  const fx = gp.oldTimer.dredgeEffects;

  /** A 2 × 4 claim whose blocks straddle the dredge's f > minF threshold (row 0 outside, row 1 on the paystreak). */
  function claimBlocks(): WorkBlock[] {
    const fs = [0, 0.02, minF, 0.04, 0.06, 0.4, 0.8, 1];
    return fs.map((f, k) => ({
      ...block(0.02, [0.25, 0.4, 0.27, 0.08]),
      i: Math.floor(k / 4),
      j: k % 4,
      paystreakFraction: f,
      overburdenFt: 9 + k,
      permafrost: 0.7,
      boulders: 0.3,
    }));
  }

  it('works and strips only the blocks with f > minF; the valley fill beside them keeps its cover and frost', () => {
    for (let s = 0; s < 20; s++) {
      const before = claimBlocks();
      const after = claimBlocks();
      const res = applyOldTimers(rng('dredge-unit', 'world', 'oldtimers', s), K, after, tpl, gp);
      expect(res.kind).toBe('dredge');
      after.forEach((b, k) => {
        const orig = before[k] as WorkBlock;
        if (orig.paystreakFraction > minF) {
          expect(b.minedOutFraction).toBeGreaterThanOrEqual(0.8);
          expect(b.overburdenFt).toBe(0);
          expect(b.permafrost).toBe(0);
          expect(b.boulders).toBeCloseTo(orig.boulders * fx.boulderMult, 12);
          expect(b.verticalDecayFt).toBe(fx.decayFt);
          expect(b.bedrockGoldShare).toBeGreaterThanOrEqual(fx.minBedrockShare);
        } else {
          expect(b).toEqual(orig);
        }
      });
    }
  });

  it('takes one extraction draw per block whatever the paystreak', () => {
    const count = (fs: number): number => {
      const r = rng('dredge-draws', 'world', 'oldtimers', 0);
      applyOldTimers(
        r,
        K,
        claimBlocks().map((b) => ({ ...b, paystreakFraction: fs })),
        tpl,
        gp,
      );
      return r.drawCount;
    };
    expect(count(0)).toBe(count(1));
  });
});
