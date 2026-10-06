// DESIGN §3.9 visible priors and claimPriors (§3.18 priors tests): template constants and visible facts only.
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { regionTemplates } from '../../../data/regions';
import type { ClaimId, DistrictId } from '../../core/ids';
import { generateWorld } from './generate';
import { snapshotGenParams } from './params';
import { claimPriors, oldTimerOdds, priorContainedOz, visiblePrior, visiblePriorFor } from './priors';
import type { Claim, Creek, District, WorldSlice } from './types';

const GP = snapshotGenParams(baseTuning, ['northernFederal', 'aridFederal']);
const N = regionTemplates.northernFederal;
const A = regionTemplates.aridFederal;
const WORLD = generateWorld(
  'priors-seed',
  { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] },
  baseTuning,
);

/** The world with every hidden field of claims, creeks and districts replaced by different values. */
function scrambled(w: WorldSlice): WorldSlice {
  const claims = {} as Record<ClaimId, Claim>;
  for (const id of w.claimIds) {
    const c = w.claims[id] as Claim;
    claims[id] = {
      ...c,
      water: { ...c.water, hidden: { wellYieldGpm: 999, depthToWaterFt: 1 } },
      hidden: {
        ...c.hidden,
        depositType: c.hidden.depositType === 'creek' ? 'deepMuck' : 'creek',
        oldTimerKind: 'drift',
        oldTimerEra: [1900, 1901],
        truthPack: w.claims[w.claimIds[0] as ClaimId]?.hidden.truthPack ?? '',
        truthHash: 'scrambled',
        trueHistory: [],
        econClass: c.hidden.econClass === 'uneconomic' ? 'excellent' : 'uneconomic',
        permitStub: { status: 'planApproved', bondPostedCents: null },
      },
    };
  }
  const creeks = {} as Record<string, Creek>;
  for (const [id, c] of Object.entries(w.creeks)) {
    creeks[id] = {
      ...c,
      hidden: { goldBearing: !c.hidden.goldBearing, gradeFactor: 9, obFactor: 0.1, payFactor: 3, history: null },
    };
  }
  const districts = {} as Record<DistrictId, District>;
  for (const id of w.districtIds) {
    const d = w.districts[id] as District;
    districts[id] = { ...d, hidden: { gradeFactor: 7, obFactor: 0.2, finenessMean: 0.71 } };
  }
  return { ...w, claims, creeks: creeks as WorldSlice['creeks'], districts };
}

describe('visiblePrior (§3.9)', () => {
  it('gives the template medians and spreads', () => {
    const held = visiblePriorFor(N, 'valleyBottom', 'held', GP);
    expect(held.gradeMedOzBcy).toBeCloseTo(0.0095, 12);
    expect(held.gradeSigLn).toBeCloseTo(0.76, 2);
    expect(held.meanCleanupFt).toBeCloseTo(1.535, 9);
    expect(visiblePriorFor(A, 'fan', 'held', GP).gradeSigLn).toBeCloseTo(0.92, 2);
    expect(visiblePriorFor(A, 'fan', 'held', GP).meanCleanupFt).toBeCloseTo(0.68, 9);
    expect(visiblePriorFor(N, 'bench', 'held', GP).gradeMedOzBcy).toBeCloseTo(0.0095 * 0.8, 12);
    expect(visiblePriorFor(N, 'valleyBottom', 'open', GP).gradeMedOzBcy).toBeCloseTo(0.0095 * 0.6, 12);
    expect(visiblePriorFor(N, 'valleyBottom', 'listed', GP).gradeMedOzBcy).toBeCloseTo(0.0095 * 0.92, 12);
  });

  it('gives the §3.9 contained-oz example: ≈ 600 / 550 / 360 raw oz held / listed / open', () => {
    const id = WORLD.claimIds.find((k) => {
      const c = WORLD.claims[k];
      return (
        c !== undefined &&
        c.acres === 20 &&
        c.setting === 'valleyBottom' &&
        c.visibleFeatures.length === 0 &&
        WORLD.districts[c.districtId]?.templateId === 'northernFederal'
      );
    }) as ClaimId;
    expect(id).toBeDefined();
    expect(priorContainedOz(WORLD, id, 'held')).toBeCloseTo(20 * 0.3 * (5 + 1.535) * 1613 * 0.0095, 6);
    expect(Math.round(priorContainedOz(WORLD, id, 'held') / 10) * 10).toBe(600);
    expect(Math.round(priorContainedOz(WORLD, id, 'listed') / 10) * 10).toBe(550);
    expect(Math.round(priorContainedOz(WORLD, id, 'open') / 10) * 10).toBe(360);
  });
});

describe('oldTimerOdds (§3.9, D-3.45)', () => {
  it('renormalizes the template mix over the kinds consistent with what is visible', () => {
    const none = oldTimerOdds(N, 'creek', []);
    expect(none['none']).toBeCloseTo(0.25 / 0.55, 12);
    expect(none['drift']).toBeCloseTo(0.3 / 0.55, 12);
    expect(Object.keys(none).sort()).toEqual(['drift', 'none']);
    expect(oldTimerOdds(N, 'dredgedGround', ['dredgeTailings'])).toEqual({ dredge: 1 });
    expect(oldTimerOdds(N, 'creek', ['tailingsPiles'])).toEqual({ handCut: 1 });
    expect(oldTimerOdds(N, 'creek', ['tailingsPiles', 'recentDisturbance', 'ponds'])).toEqual({ recentCat: 1 });
    expect(oldTimerOdds(A, 'gulch', ['tailingsPiles'])).toEqual({ dryWash: 1 });
  });
});

describe('claimPriors (§3.9, §4 4.5.1)', () => {
  it('gives a listed north valley claim logGradeMedian = ln(0.0095 × 0.92) = −4.740', () => {
    const id = WORLD.claimIds.find((k) => {
      const c = WORLD.claims[k];
      return (
        c !== undefined &&
        c.setting === 'valleyBottom' &&
        WORLD.districts[c.districtId]?.templateId === 'northernFederal'
      );
    }) as ClaimId;
    expect(claimPriors(WORLD, id, 'listed').logGradeMedian).toBeCloseTo(-4.74, 3);
    expect(claimPriors(WORLD, id, 'listed').sigma.claim).toBeCloseTo(0.2, 12);
  });

  it('fills one block row per block with visible geometry and is memoized', () => {
    for (const id of WORLD.claimIds.slice(0, 30)) {
      const c = WORLD.claims[id] as Claim;
      const p = claimPriors(WORLD, id);
      expect(p.blocks).toHaveLength(c.nAlong * c.nAcross);
      expect(p.blocks[0]?.blockId).toBe(`blk_${String(c.blockIdBase).padStart(6, '0')}`);
      expect(p.blocks.map((b) => b.surface).join('')).toBe(c.env.surfaceCodes);
      expect(claimPriors(WORLD, id)).toBe(p);
    }
  });

  it('is byte-identical when any hidden field of the claim, creek or district is perturbed', () => {
    const s = scrambled(WORLD);
    for (const id of WORLD.claimIds) {
      for (const status of ['held', 'listed', 'open'] as const) {
        expect(JSON.stringify(claimPriors(s, id, status))).toBe(JSON.stringify(claimPriors(WORLD, id, status)));
      }
      expect(priorContainedOz(s, id)).toBe(priorContainedOz(WORLD, id));
    }
    for (const d of WORLD.districtIds) {
      for (const setting of [
        'bench',
        'dredgedGround',
        WORLD.districts[d]?.templateId === 'aridFederal' ? 'fan' : 'valleyBottom',
      ] as const) {
        expect(JSON.stringify(visiblePrior(s, d, setting, 'listed'))).toBe(
          JSON.stringify(visiblePrior(WORLD, d, setting, 'listed')),
        );
      }
    }
  });
});
