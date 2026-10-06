// Explain-flag invariance across every explain-capable kernel formula (§2.8, §2.14 "explain-flag invariance"): the
// explanation never changes a value, is absent with explanations off, and under a truth context every node built from
// the inputs is tagged hidden (tuning constants stay public).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_OFF, EXPLAIN_ON, type Calc, type CalcNode, type ExplainCtx } from '../../../core/calc';
import type { BlockId, ClaimId } from '../../../core/ids';
import { blockGoldAtFirstDig, drawSubBlockFactor, goldShares, miningLossFrac, payColumn } from './column';
import { campUsd, consumablesUsd, siteMobilization, weekOpsCosts } from './costs';
import { hideTree, truthCtx, type KernelExplainCtx } from './explain';
import { feederCapacityBcy } from './feed';
import { goldRoom } from './goldRoom';
import { digCapacity, digMultColumn } from './ground';
import { truckCycle } from './haul';
import { foremanEfficiency, seasonFactor, usableFraction } from './hours';
import { plantEffectiveRate } from './plant';
import { captureBySize, circuitBlend } from './recovery';
import { pushFactor } from './strip';
import { DESIGN_PARAMS as P } from './testing/designTuning';
import { thawRateK } from './thaw';
import { waterBalance, waterNeedPerBcyHr, wellDrilling } from './water';

type Case = [string, (ex: KernelExplainCtx) => Calc<unknown>];

function cases(x: number): Case[] {
  const col = { gravelFt: 5 + x, bedrockFt: 1.5, thawedFt: 2 * x, permafrost: 0.6 };
  return [
    [
      'payColumn',
      (ex) =>
        payColumn(
          { overburdenFt: 10 * x, payThicknessFt: 5, bedrockTakeFt: x, policy: 'standard', sDig: 40 + x },
          P,
          ex,
        ),
    ],
    ['goldShares', (ex) => goldShares({ Tg: 5, B: 1.5, sb: 0.2, lambdaG: 2, lambdaB: 0.6 }, x, 0.07, ex)],
    ['miningLossFrac', (ex) => miningLossFrac(30 + 10 * x, 0.1, P, ex)],
    [
      'blockGoldAtFirstDig',
      (ex) =>
        blockGoldAtFirstDig(
          { gradeOzPerBcy: 0.01 * x, payThicknessFt: 5, bedrockCleanupFt: 1, minedBcy: 0, sampledBcy: 50 },
          ex,
        ),
    ],
    [
      'drawSubBlockFactor',
      (ex) =>
        drawSubBlockFactor('seed', Math.round(x * 10), 'clm_000001' as ClaimId, 'blk_000003' as BlockId, 0.25, ex),
    ],
    [
      'thawRateK',
      (ex) =>
        thawRateK(
          { tempBand: 'mild', surface: 'stripped', overburdenRemaining: x > 1, aspectMult: x, eventMult: 1 },
          P,
          ex,
        ),
    ],
    ['digMultColumn', (ex) => digMultColumn(col, 0.3, P, ex)],
    [
      'digCapacity',
      (ex) => digCapacity({ refRate: 150, boulders: 0.1, seqMult: 1, u: 0.9, column: col, ripCapBcy: 20 * x }, P, ex),
    ],
    [
      'usableFraction',
      (ex) =>
        usableFraction(
          {
            staffed: true,
            availability: 0.92,
            operatorAvail: 1,
            foremanEff: 0.95,
            weatherMult: 1 / (1 + x),
            seasonMult: 1,
          },
          ex,
        ),
    ],
    ['foremanEfficiency', (ex) => foremanEfficiency('hired', 30 * x, P, ex)],
    ['seasonFactor', (ex) => seasonFactor({ phase: 'freezeup', role: 'plant', tempBand: 'cold' }, P, ex)],
    ['pushFactor', (ex) => pushFactor(150 + 50 * x, P, ex)],
    [
      'truckCycle',
      (ex) => truckCycle({ payloadBcy: 18, loaderDigRateBcyHr: 120, haulFt: 1000 * x, cycleMult: 1, u: 0.9 }, P, ex),
    ],
    [
      'feederCapacityBcy',
      (ex) => feederCapacityBcy({ refRate: 170, u: 0.9, rehandleShare: x / 4, frozenShare: 0.1 }, P, ex),
    ],
    [
      'plantEffectiveRate',
      (ex) =>
        plantEffectiveRate(
          { ratedBcyHr: 75, cond: 0.96, clay: x / 4, boulders: 0.1, prep: 'trommel', eventMult: 1 },
          P,
          ex,
        ),
    ],
    [
      'waterNeedPerBcyHr',
      (ex) => waterNeedPerBcyHr({ clay: x / 4, prep: 'shakerDeck', recycleShare: 0.6, hasConcentrator: true }, P, ex),
    ],
    [
      'waterBalance',
      (ex) =>
        waterBalance(
          {
            s3AvailableGpm: 300 * x,
            wellYieldsGpm: [100],
            streamFlowFactor: 1,
            waterAvailMult: 1,
            maxWaterGpm: null,
            waterTrucksPerDay: 1,
            nearestFillMi: 6,
            benchLiftFt: 40,
            pumps: [{ gpm: 1500, u: 0.9 }],
            freshShare: 0.15,
          },
          P,
          ex,
        ),
    ],
    ['wellDrilling', (ex) => wellDrilling(100 * x, 1, P, ex)],
    [
      'circuitBlend',
      (ex) =>
        circuitBlend(
          {
            prep: 'trommel',
            concentrators: [{ id: 'mch_000009', device: 'jig', fineTreatCapBcyHr: 25 }],
            feedRateBcyHr: 20 * x,
          },
          P,
          ex,
        ),
    ],
    [
      'captureBySize',
      (ex) =>
        captureBySize(
          {
            B: P.baseCapture.sluice,
            prep: 'trommel',
            phi: 0.6 * x,
            omega: 0.9,
            skillMult: 1.05,
            tempBand: 'cool',
            clay: 0.2,
            hasScrubber: false,
            nuggetTrap: false,
            riffle: { bcyWashedSinceCleanup: 4000 * x, rEff: 50, gradePad: 0.01 },
            eventExpMult: 1,
          },
          P,
          ex,
        ),
    ],
    [
      'goldRoom',
      (ex) =>
        goldRoom(
          {
            box: { rawOz: { coarse: 5 * x, medium: 8, fine: 3, ultrafine: 0.5 }, fineOz: 14 },
            hasTable: x > 1,
            skillMult: 1,
            skimmed: false,
          },
          P,
          ex,
        ),
    ],
    [
      'consumablesUsd',
      (ex) =>
        consumablesUsd(
          {
            washedBcy: 3000 * x,
            dugBcy: 3000,
            dugHardBcy: 600,
            strippedBcy: 7000,
            strippedFrozenBcy: 2000,
            cpiIndex: 1,
          },
          P,
          ex,
        ),
    ],
    ['campUsd', (ex) => campUsd({ personDays: 49, tier: 'good', cpiIndex: 1, costMult: x, winter: false }, P, ex)],
    [
      'weekOpsCosts',
      (ex) =>
        weekOpsCosts(
          {
            machineFuelGal: 1600 * x,
            personDays: 49,
            deliveredUsdPerGal: 4.5,
            consumables: {
              washedBcy: 3000,
              dugBcy: 3000,
              dugHardBcy: 600,
              strippedBcy: 7000,
              strippedFrozenBcy: 2000,
              cpiIndex: 1,
            },
            campTier: 'standard',
            campCostMult: 1,
            winter: false,
            site: 'running',
            waterTrucksPerDay: 1,
            daysScheduled: 6,
            waterTruckCostMult: 1,
            cpiIndex: 1,
          },
          P,
          ex,
        ),
    ],
    ['siteMobilization', (ex) => siteMobilization({ mobMult: x, cpiIndex: 1, access: 'seasonalRoad' }, P, ex)],
  ];
}

function walk(n: CalcNode, visit: (c: CalcNode) => void): void {
  visit(n);
  for (const c of n.children ?? []) walk(c, visit);
}

describe('explain-flag invariance (every explain-capable kernel formula)', () => {
  it('values are identical with explanations off, on, and on under a truth context; off builds nothing', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.2, max: 2, noNaN: true }), (x) => {
        for (const [name, run] of cases(x)) {
          const off = run(EXPLAIN_OFF);
          const on = run(EXPLAIN_ON);
          const hid = run(truthCtx(EXPLAIN_ON));
          expect(off.calc, name).toBeUndefined();
          expect(on.value, name).toEqual(off.value);
          expect(hid.value, name).toEqual(off.value);
          expect(on.calc, name).toBeDefined();
        }
      }),
      { numRuns: 40 },
    );
  });

  it('a truth context tags every input-derived node hidden and leaves tuning constants public', () => {
    for (const [name, run] of cases(1.3)) {
      const on = run(EXPLAIN_ON).calc!;
      const hid = run(truthCtx(EXPLAIN_ON)).calc!;
      walk(on, (c) => expect(c.hidden, name).toBeUndefined());
      walk(hid, (c) => {
        if (c.source?.kind === 'tuning') expect(c.hidden, name).toBeUndefined();
        else expect(c.hidden, name).toBe(true);
      });
    }
  });

  it('a truth context keeps the explain flag', () => {
    const ex: ExplainCtx = truthCtx(EXPLAIN_OFF);
    expect(ex.on).toBe(false);
    expect(
      payColumn({ overburdenFt: 1, payThicknessFt: 1, bedrockTakeFt: 0, policy: 'tight', sDig: 50 }, P, ex).calc,
    ).toBeUndefined();
  });

  it('hideTree tags a whole tree and sets its known alternative', () => {
    const t = payColumn(
      { overburdenFt: 10, payThicknessFt: 5, bedrockTakeFt: 1, policy: 'standard', sDig: 50 },
      P,
      EXPLAIN_ON,
    ).calc;
    const alt: CalcNode = { label: 'Estimated', value: 1, unit: 'bcy' };
    const h = hideTree(t, alt)!;
    walk(h, (c) => expect(c.hidden).toBe(true));
    expect(h.knownAlt).toBe(alt);
    expect(hideTree(undefined)).toBeUndefined();
  });
});
