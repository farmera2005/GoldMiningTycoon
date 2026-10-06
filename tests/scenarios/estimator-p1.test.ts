// DESIGN §4.22 fixtures on engine-generated claims that P1 adds: pruning at 1e-4 changes claim P50 by < 0.5%; the
// geologist flag of the false-bedrock check is derived from the samples (s04 #10); the production support gates
// (§4.8: processed volume, production on the footprint, own-fleet bulk samples, the block's measured class).
import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { canonicalJson } from '../../src/engine/core/hash';
import { formatId, type BlockId, type ProgramId, type SampleId } from '../../src/engine/core/ids';
import {
  claimPriors,
  claimTruth,
  drawContextFor,
  generateWorld,
  type Claim,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { UNTOUCHED_BLOCK } from '../../src/engine/systems/world/sample';
import {
  emptyEvidence,
  estimateFromEvidence,
  executeSample,
  executionParams,
  geologistOnClaim,
  productionRecords,
  type CleanupResult,
  type EvidenceSet,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { CAL_LOGGER, harnessContext, planningFor } from '../../sim/calibration/estimator-stages';

const OPTS = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
const world = generateWorld('4022', OPTS, baseTuning);
const exec = executionParams(baseTuning);

function held(w: WorldSlice, template: string): Claim[] {
  return w.claimIds
    .map((id) => w.claims[id] as Claim)
    .filter(
      (c) =>
        c.status === 'heldNpc' &&
        c.acres <= 40 &&
        (w.districts[c.districtId] as { templateId: string }).templateId === template,
    );
}

/** A 5-bcy pit on every block (22-ft reach) by `logger`. */
function pitGrid(claim: Claim, logger = CAL_LOGGER): SampleRecord[] {
  const truth = claimTruth(world, claim.id);
  const out: SampleRecord[] = [];
  for (let i = 0; i < claim.nAlong * claim.nAcross; i++) {
    const blockId = formatId('blk', claim.blockIdBase + i) as BlockId;
    out.push(
      executeSample(
        truth.blocks[i] as (typeof truth.blocks)[number],
        world.blockStates[blockId] ?? UNTOUCHED_BLOCK,
        drawContextFor(world, blockId),
        {
          seed: '4022',
          sampleId: formatId('smp', i + 1) as SampleId,
          claimId: claim.id,
          blockId,
          methodId: 'excavatorPit',
          k: 0,
          turn: 0,
          availableTurn: 0,
          logger,
          volumeBcy: 5,
          machineReachFt: 22,
        },
        exec,
      ).record,
    );
  }
  return out;
}

function evidence(claim: Claim, samples: readonly SampleRecord[], geologist = true): EvidenceSet {
  return { ...emptyEvidence(claim.id), samples, geologistOnClaim: geologist };
}

describe('hypothesis pruning (§4.22)', () => {
  it('pruning at 1e-4 changes claim P50 by < 0.5% against no pruning', () => {
    const noPrune: TuningResolved = {
      ...baseTuning,
      'geology.estHypPruneWeight': 0,
      'geology.estHypPruneWeightLarge': 0,
    };
    const h = harnessContext(world, baseTuning);
    const h0 = harnessContext(world, noPrune);
    let compared = 0;
    for (const c of [...held(world, 'northernFederal').slice(0, 5), ...held(world, 'aridFederal').slice(0, 5)]) {
      const priors = claimPriors(world, c.id, 'held');
      const ev = evidence(c, pitGrid(c));
      const a = estimateFromEvidence(priors, ev, planningFor(h, priors), h.ctx);
      const b = estimateFromEvidence(priors, ev, planningFor(h0, priors), h0.ctx);
      expect(b.claim.hypotheses.surviving).toBeGreaterThanOrEqual(a.claim.hypotheses.surviving);
      expect(Math.abs(a.claim.containedOzP50 / b.claim.containedOzP50 - 1)).toBeLessThan(0.005);
      compared++;
    }
    expect(compared).toBe(10);
  });
});

describe('the geologist flag is derived from the evidence (s04 #10)', () => {
  const claim = held(world, 'northernFederal')[0] as Claim;
  const priors = claimPriors(world, claim.id, 'held');
  const h = harnessContext(world, baseTuning);

  it('true when a bedrock-logged sample was logged by a geologist, false for unlogged crews', () => {
    const logged = pitGrid(claim);
    expect(geologistOnClaim(logged)).toBe(logged.some((s) => s.bedrockLogged));
    const unlogged = pitGrid(claim, { kind: 'none', trueSkill: 0, shownSkill: 0 });
    expect(geologistOnClaim(unlogged)).toBe(false);
    expect(geologistOnClaim([])).toBe(false);
  });

  it('the evidence set’s own flag never changes the estimate', () => {
    const recs = pitGrid(claim);
    const a = estimateFromEvidence(priors, evidence(claim, recs, true), planningFor(h, priors), h.ctx);
    const b = estimateFromEvidence(priors, evidence(claim, recs, false), planningFor(h, priors), h.ctx);
    expect(canonicalJson({ ...b.claim, evidenceHash: '' })).toBe(canonicalJson({ ...a.claim, evidenceHash: '' }));
    expect(canonicalJson(b.blocks)).toBe(canonicalJson(a.blocks));
  });
});

describe('production support gates (§4.8)', () => {
  const claim = held(world, 'northernFederal')[1] as Claim;
  const priors = claimPriors(world, claim.id, 'held');
  const h = harnessContext(world, baseTuning);

  /** One cleanup over the listed blocks at `frac` of an assumed 8,000-bcy pay column each, at the estimate's P50s. */
  function cleanupRecords(
    est: ReturnType<typeof estimateFromEvidence>,
    blocks: readonly number[],
    turn: number,
    firstId: number,
    bulk?: ProgramId,
  ): SampleRecord[] {
    const inSitu: Partial<Record<BlockId, number>> = {};
    for (const i of blocks) inSitu[formatId('blk', claim.blockIdBase + i) as BlockId] = 3000;
    const cap = h.ctx.recoveryBySize;
    const grl = { coarse: 0.01, medium: 0.01, fine: 0.01, ultrafine: 0.01 };
    const c: CleanupResult = {
      turn,
      lineId: 'L1',
      purpose: bulk === undefined ? 'production' : 'bulkSample',
      rawOzWeighed: 40,
      rawOzBySize: { coarse: 10, medium: 16, fine: 11, ultrafine: 3 },
      interestsTaken: [],
      bcyWashedSince: 3300 * blocks.length,
      bcyByBlock: {},
      recoveredGradeOzPerBcy: 0,
      inSituBcyByBlock: inSitu,
      pileBcyWashed: 0,
      pileRawOzEst: 0,
      modeledChainFactor: 0.74,
      modeledChain: {
        miningFactorByBlock: {},
        sizeMixP50: est.claim.sizeMixP50,
        captureBySize: cap,
        goldRoomLossBySize: grl,
        estDirtFrac: 0.04,
      },
      foremanEstimateOz: 0,
      nominalRecoveryBySize: cap,
      skimOz: 0,
    };
    const p50 = new Map(est.blocks.map((b) => [b.blockId, b.gradeP50]));
    return productionRecords({
      claimId: claim.id,
      cleanup: c,
      gradeP50: (id) => p50.get(id),
      ...(bulk !== undefined ? { bulkSampleProgramId: bulk } : {}),
    }).map((d, k) => ({ ...d, id: formatId('smp', firstId + k) as SampleId }));
  }

  it('production joins processed volume and the production gate; bulk-sample cleanups count as bulk blocks', () => {
    const pits = pitGrid(claim);
    const e0 = estimateFromEvidence(priors, evidence(claim, pits), planningFor(h, priors), h.ctx);
    const prod = cleanupRecords(e0, [5, 6], 10, 500);
    const bulk = cleanupRecords(e0, [9], 11, 600, 'prog_000003' as ProgramId);
    const e1 = estimateFromEvidence(
      priors,
      evidence(claim, [...pits, ...prod, ...bulk]),
      planningFor(h, priors),
      h.ctx,
    );
    expect(e1.claim.gates.processedBcy).toBeCloseTo(e0.claim.gates.processedBcy + 9000, 6);
    const F = new Set(e1.claim.minableBlockIds.length > 0 ? e1.claim.minableBlockIds : e1.blocks.map((b) => b.blockId));
    const onF = [...prod, ...bulk].filter((r) => F.has(r.blockId)).reduce((s, r) => s + r.volumeBcy, 0);
    expect(e1.claim.gates.productionBcy).toBeCloseTo(onF, 6);
    const bulkOnF = F.has(formatId('blk', claim.blockIdBase + 9) as BlockId) ? 1 : 0;
    expect(e1.claim.gates.bulkBlocks).toBe(e0.claim.gates.bulkBlocks + bulkOnF);
    // Production is not a bedrock-logged sample.
    expect(e1.claim.gates.bedrockSamples).toBe(e0.claim.gates.bedrockSamples);
    // A produced block with a tight posterior is measured (§4.8 block class: "a production or ≥ 100-bcy sample").
    for (const i of [5, 6, 9]) {
      const b = e1.blocks[i];
      if (b !== undefined && b.lnGradeSd <= 0.25) expect(b.confidence).toBe('measured');
    }
  });

  it('production pins the block it mined', () => {
    const pits = pitGrid(claim);
    const e0 = estimateFromEvidence(priors, evidence(claim, pits), planningFor(h, priors), h.ctx);
    let samples = pits;
    let e = e0;
    for (let k = 0; k < 4; k++) {
      samples = [...samples, ...cleanupRecords(e, [7], 10 + k, 700 + k)];
      e = estimateFromEvidence(priors, evidence(claim, samples), planningFor(h, priors), h.ctx);
    }
    expect(e.blocks[7]?.lnGradeSd ?? 1).toBeLessThan((e0.blocks[7]?.lnGradeSd ?? 0) / 2);
  });
});
