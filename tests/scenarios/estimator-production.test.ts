// DESIGN §4.22 production reconciliation and the incremental path (§4.4.6, §4.5.2) on claims from §3's engine
// generator, with a scripted cleanup stub standing in for §7: a zero-noise truth run (the visible chain is the true
// chain, no theft or leak) reads the mined blocks' grades back; the incremental path equals a full solve with the same
// frozen anchor quantities to 1e-9 and an unfrozen full solve to 1%; a cold-memo save/load round trip is bit-identical;
// the 12th row, new sample evidence and a season end each re-anchor.
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../src/data/tuning';
import { canonicalJson } from '../../src/engine/core/hash';
import { formatId, type BlockId, type SampleId } from '../../src/engine/core/ids';
import { clearAllMemos } from '../../src/engine/core/memo';
import {
  claimPriors,
  claimTruth,
  drawContextFor,
  generateWorld,
  type Claim,
  type ClaimPriors,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { BCY_PER_ACRE_FT } from '../../src/engine/systems/world/constants';
import {
  anchoredStatisticalEstimate,
  anchorTurn,
  appendProduction,
  emptyEvidence,
  estimateAnchored,
  estimateFromEvidence,
  executeSample,
  executionParams,
  frozenFullSolve,
  fullSolveAnchor,
  prepareProduction,
  productionRecords,
  refreshAnchor,
  splitAtAnchor,
  takeAnchor,
  type CleanupResult,
  type EstimateAnchor,
  type EstimateResult,
  type EvidenceSet,
  type KnownBlockState,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { solveSummary, stateLayer, continuousState } from '../../src/engine/systems/knowledge/statistical';
import { CAL_LOGGER, harnessContext, planningFor } from '../../sim/calibration/estimator-stages';
import { UNTOUCHED_BLOCK } from '../../src/engine/systems/world/sample';

const OPTS = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
const SIZES = ['coarse', 'medium', 'fine', 'ultrafine'] as const;

function heldNorthCreek(w: WorldSlice): Claim[] {
  return w.claimIds
    .map((id) => w.claims[id] as Claim)
    .filter(
      (c) =>
        c.status === 'heldNpc' &&
        c.setting === 'valleyBottom' &&
        c.acres === 20 &&
        (w.districts[c.districtId] as { templateId: string }).templateId === 'northernFederal',
    );
}

/**
 * §7 stand-in: one plant line, the visible chain = the true chain (mining factor 0.95 × 0.97, sluice capture, 1% gold-
 * room loss, 4% dirt), so a cleanup weighs exactly chain × Σ inSitu_b × true grade_b.
 */
interface Operation {
  readonly world: WorldSlice;
  readonly claim: Claim;
  readonly priors: ClaimPriors;
  readonly h: ReturnType<typeof harnessContext>;
  samples: SampleRecord[];
  blockState: Record<BlockId, KnownBlockState>;
  seq: number;
}

function operation(world: WorldSlice, claim: Claim): Operation {
  return {
    world,
    claim,
    priors: claimPriors(world, claim.id, 'held'),
    h: harnessContext(world, baseTuning),
    samples: [],
    blockState: {},
    seq: 0,
  };
}

function evidence(op: Operation): EvidenceSet {
  return { ...emptyEvidence(op.claim.id), samples: op.samples, blockState: op.blockState, geologistOnClaim: false };
}

function payBcy(op: Operation, idx: number): number {
  const t = claimTruth(op.world, op.claim.id).blocks[idx] as { payThicknessFt: number; bedrockCleanupFt: number };
  const acres = op.priors.blocks[idx]?.acres ?? 1;
  return (t.payThicknessFt + t.bedrockCleanupFt) * BCY_PER_ACRE_FT * acres;
}

/** Mines `frac` of each listed block's pay in one cleanup at `turn` and records it against `estimate`. */
function cleanup(
  op: Operation,
  turn: number,
  blocks: readonly number[],
  frac: number,
  estimate: EstimateResult,
  audited?: Record<(typeof SIZES)[number], number>,
): SampleRecord[] {
  const truth = claimTruth(op.world, op.claim.id);
  const cap = op.h.ctx.recoveryBySize;
  const grl = { coarse: 0.01, medium: 0.01, fine: 0.01, ultrafine: 0.01 };
  const dirt = 0.04;
  const mf = 0.95 * 0.97;
  const inSitu: Partial<Record<BlockId, number>> = {};
  const mfBy: Partial<Record<BlockId, number>> = {};
  // Zero noise: the plant recovers each block's TRUE size mix at exactly the nominal capture, and the visible chain is
  // exact (its size mix is the mined gold's true mix), so every row reads its block's true grade.
  const bySize = { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
  const metalBySize = { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
  for (const idx of blocks) {
    const id = formatId('blk', op.claim.blockIdBase + idx) as BlockId;
    const v = payBcy(op, idx) * frac;
    inSitu[id] = v;
    mfBy[id] = mf;
    const bt = truth.blocks[idx] as { gradeOzPerBcy: number; sizeMix: Record<(typeof SIZES)[number], number> };
    for (const s of SIZES) {
      metalBySize[s] += v * bt.gradeOzPerBcy * bt.sizeMix[s];
      bySize[s] += (v * bt.gradeOzPerBcy * bt.sizeMix[s] * mf * cap[s] * (1 - grl[s])) / (1 - dirt);
    }
    const st = op.blockState[id] ?? { minedFrac: 0, sampledBcy: 0, strippedFt: 0 };
    op.blockState[id] = { ...st, minedFrac: Math.min(1, st.minedFrac + frac) };
  }
  const metal = metalBySize.coarse + metalBySize.medium + metalBySize.fine + metalBySize.ultrafine;
  const mix = {
    coarse: metalBySize.coarse / metal,
    medium: metalBySize.medium / metal,
    fine: metalBySize.fine / metal,
    ultrafine: metalBySize.ultrafine / metal,
  };
  let capMix = 0;
  for (const s of SIZES) capMix += mix[s] * cap[s] * (1 - grl[s]);
  const chain = (mf * capMix) / (1 - dirt);
  const weighed = bySize.coarse + bySize.medium + bySize.fine + bySize.ultrafine;
  const c: CleanupResult = {
    turn,
    lineId: 'L1',
    purpose: 'production',
    rawOzWeighed: weighed,
    rawOzBySize: bySize,
    interestsTaken: [],
    bcyWashedSince: 0,
    bcyByBlock: {},
    recoveredGradeOzPerBcy: 0,
    inSituBcyByBlock: inSitu,
    pileBcyWashed: 0,
    pileRawOzEst: 0,
    modeledChainFactor: chain,
    modeledChain: {
      miningFactorByBlock: mfBy,
      sizeMixP50: mix,
      captureBySize: cap,
      goldRoomLossBySize: grl,
      estDirtFrac: dirt,
    },
    foremanEstimateOz: 0,
    nominalRecoveryBySize: cap,
    ...(audited !== undefined ? { auditedRecoveryBySize: audited } : {}),
    skimOz: 0,
  };
  const p50 = new Map(estimate.blocks.map((b) => [b.blockId, b.gradeP50]));
  const drafts = productionRecords({ claimId: op.claim.id, cleanup: c, gradeP50: (id) => p50.get(id) });
  const recs = drafts.map((d) => ({ ...d, id: formatId('smp', 900000 + ++op.seq) as SampleId }));
  op.samples = [...op.samples, ...recs];
  return recs;
}

function indexOf(priors: ClaimPriors): Partial<Record<BlockId, number>> {
  const out: Partial<Record<BlockId, number>> = {};
  priors.blocks.forEach((b, i) => {
    out[b.blockId] = i;
  });
  return out;
}

function rel(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
}

const world = generateWorld('4022', OPTS, baseTuning);
const claims = heldNorthCreek(world);

describe('production reconciliation (§4.4.6)', () => {
  it('a zero-noise truth run reads the mined blocks within ±0.02 (median ln(P50/truth)) after 10 cleanups', () => {
    const ln: number[] = [];
    for (const claim of claims.slice(0, 24)) {
      const op = operation(world, claim);
      const truth = claimTruth(world, claim.id);
      const free = [...Array(claim.nAlong * claim.nAcross).keys()].filter(
        (i) => (truth.blocks[i] as { pocket?: unknown }).pocket === undefined && payBcy(op, i) > 0,
      );
      const mined = [free[Math.floor(free.length / 3)], free[Math.floor((2 * free.length) / 3)]] as number[];
      let anchor: EstimateAnchor | null = null;
      let est = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
      for (let k = 0; k < 10; k++) {
        // One block per cleanup, alternating: each row attributes exactly.
        cleanup(op, 10 + k, [mined[k % 2] as number], 0.04, est);
        anchor = refreshAnchor(anchor, evidence(op), null, op.h.params.fullSolveEveryProdRows);
        est = estimateAnchored(op.priors, evidence(op), anchor, planningFor(op.h, op.priors), op.h.ctx);
      }
      for (const idx of mined) {
        const g = (truth.blocks[idx] as { gradeOzPerBcy: number }).gradeOzPerBcy;
        ln.push(Math.log((est.blocks[idx]?.gradeP50 ?? NaN) / g));
      }
    }
    ln.sort((a, b) => a - b);
    const median = (ln[ln.length / 2 - 1] as number) / 2 + (ln[ln.length / 2] as number) / 2;
    expect(ln.length).toBeGreaterThanOrEqual(30);
    console.log(`zero-noise production: median ln(P50/truth) ${median.toFixed(4)} over ${ln.length} mined blocks`);
    expect(Math.abs(median)).toBeLessThanOrEqual(0.02);
  });

  it('an audit changes only the capture term', () => {
    const claim = claims[0] as Claim;
    const op = operation(world, claim);
    const est = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
    const plain = cleanup(op, 5, [3, 4], 0.05, est);
    const op2 = operation(world, claim);
    const audit = { coarse: 0.9, medium: 0.8, fine: 0.5, ultrafine: 0.2 };
    const aud = cleanup(op2, 5, [3, 4], 0.05, est, audit);
    plain.forEach((p, i) => {
      const a = aud[i] as SampleRecord;
      expect(a.production?.ozAttributedWeighed).toBe(p.production?.ozAttributedWeighed);
      expect(a.production?.inSituBcy).toBe(p.production?.inSituBcy);
      expect(a.production?.audited).toBe(true);
      expect(p.production?.audited).toBe(false);
      expect(a.production?.chainFactor).not.toBe(p.production?.chainFactor);
    });
  });

  it('re-estimating later never changes a stored attribution', () => {
    const claim = claims[1] as Claim;
    const op = operation(world, claim);
    const e0 = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
    const first = cleanup(op, 3, [2, 5], 0.05, e0);
    const snapshot = canonicalJson(first);
    const rows0 = prepareProduction(indexOf(op.priors), first, op.h.params);
    const e1 = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
    cleanup(op, 6, [2, 5], 0.05, e1);
    estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
    expect(canonicalJson(first)).toBe(snapshot);
    const rows1 = prepareProduction(indexOf(op.priors), first, op.h.params);
    expect(rows1.map((r) => r.row)).toEqual(rows0.map((r) => r.row));
  });
});

/** A 5-bcy pit on every block (22-ft reach), logged by the calibration consultant, available at turn 1. */
function pitGrid(op: Operation): void {
  const truth = claimTruth(op.world, op.claim.id);
  const n = op.claim.nAlong * op.claim.nAcross;
  for (let i = 0; i < n; i++) {
    const blockId = formatId('blk', op.claim.blockIdBase + i) as BlockId;
    const res = executeSample(
      truth.blocks[i] as (typeof truth.blocks)[number],
      op.world.blockStates[blockId] ?? UNTOUCHED_BLOCK,
      drawContextFor(op.world, blockId),
      {
        seed: '4022',
        sampleId: formatId('smp', i + 1) as SampleId,
        claimId: op.claim.id,
        blockId,
        methodId: 'excavatorPit',
        k: 0,
        turn: 0,
        availableTurn: 1,
        logger: CAL_LOGGER,
        volumeBcy: 5,
        machineReachFt: 22,
      },
      executionParams(baseTuning),
    );
    op.samples = [...op.samples, res.record];
  }
}

/** An operating claim with a pit grid and `rows` single-block cleanup rows after it. */
function operated(claim: Claim, rows: number): { op: Operation; est: EstimateResult } {
  const op = operation(world, claim);
  pitGrid(op);
  let est = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
  for (let k = 0; k < rows; k++) {
    cleanup(op, 20 + k, [(3 * k) % (claim.nAlong * claim.nAcross)], 0.03, est);
    est = estimateFromEvidence(op.priors, evidence(op), planningFor(op.h, op.priors), op.h.ctx);
  }
  return { op, est };
}

describe('the incremental production path (§4.5.2)', () => {
  const claim = claims[2] as Claim;

  it('equals a full solve with the same frozen anchor quantities to 1e-9 after 1–11 appended rows', () => {
    const { op } = operated(claim, 11);
    const ev = evidence(op);
    const anchor = takeAnchor(19, ev.blockState);
    const st = anchoredStatisticalEstimate(op.priors, ev, anchor, op.h.params);
    for (let k = 1; k <= 11; k++) {
      const split = splitAtAnchor(ev.samples, 19);
      const prod = prepareProduction(st.anchor.model.indexOf, split.appended.slice(0, k), op.h.params);
      const inc = appendProduction(st.anchor, prod);
      const ref = frozenFullSolve(st.anchor, prod);
      const n = st.anchor.model.n;
      for (let i = 0; i < inc.sol.weights.length; i++)
        expect(Math.abs((inc.sol.weights[i] as number) - (ref.sol.weights[i] as number))).toBeLessThan(1e-9);
      for (let i = 0; i < inc.sol.meanLnG.length; i++)
        expect(Math.abs((inc.sol.meanLnG[i] as number) - (ref.sol.meanLnG[i] as number))).toBeLessThan(1e-9);
      for (let i = 0; i < n * n; i++)
        expect(Math.abs((inc.CG[i] as number) - (ref.CG[i] as number))).toBeLessThan(1e-9);
      const state = continuousState(st.anchor.model, ev.blockState);
      const a = stateLayer(st.anchor, inc, solveSummary(st.anchor, inc.sol, inc.CG), state, [], prod);
      const b = stateLayer(st.anchor, ref, solveSummary(st.anchor, ref.sol, ref.CG), state, [], prod);
      expect(rel(a.contained.p50, b.contained.p50)).toBeLessThan(1e-9);
      expect(rel(a.contained.p10, b.contained.p10)).toBeLessThan(1e-9);
      expect(rel(a.contained.p90, b.contained.p90)).toBeLessThan(1e-9);
    }
  });

  it('differs from an unfrozen full solve by under 1% in claim P50 (3 and 11 rows on a pit-grid anchor)', () => {
    let worst = 0;
    for (const c of claims) {
      for (const rows of [3, 11]) {
        const { op } = operated(c, rows);
        const ev = evidence(op);
        const planning = planningFor(op.h, op.priors);
        const inc = estimateAnchored(op.priors, ev, takeAnchor(19, ev.blockState), planning, op.h.ctx);
        const full = estimateFromEvidence(op.priors, ev, planning, op.h.ctx);
        const d = rel(inc.claim.containedOzP50, full.claim.containedOzP50);
        worst = Math.max(worst, d);
        expect(d).toBeLessThan(0.01);
      }
    }
    console.log(`incremental vs unfrozen full solve: worst claim P50 difference ${(100 * worst).toFixed(2)}%`);
  });

  it('a save/load round trip with a cold memo gives a bit-identical estimate', () => {
    const { op } = operated(claim, 7);
    const ev = evidence(op);
    const anchor = takeAnchor(22, ev.blockState);
    const planning = planningFor(op.h, op.priors);
    const a = estimateAnchored(op.priors, ev, anchor, planning, op.h.ctx);
    clearAllMemos();
    const ev2 = JSON.parse(JSON.stringify(ev)) as EvidenceSet;
    const anchor2 = JSON.parse(JSON.stringify(anchor)) as EstimateAnchor;
    const priors2 = JSON.parse(JSON.stringify(op.priors)) as ClaimPriors;
    const b = estimateAnchored(priors2, ev2, anchor2, planning, op.h.ctx);
    expect(canonicalJson(b)).toBe(canonicalJson(a));
  });

  it('re-anchors on the 12th production row, on new sample evidence and at a season end', () => {
    const { op } = operated(claim, 13);
    const every = op.h.params.fullSolveEveryProdRows;
    const ev = evidence(op);
    // Pits available at turn 1; rows at turns 20 … 32: the 12th row (turn 31) anchors, row 13 is appended.
    expect(anchorTurn(ev, null, every)).toBe(31);
    const pits = ev.samples.filter((s) => s.source !== 'production');
    const rows = ev.samples.filter((s) => s.source === 'production');
    expect(anchorTurn({ ...ev, samples: [...pits, ...rows.slice(0, 11)] }, null, every)).toBe(1);
    expect(anchorTurn({ ...ev, samples: rows.slice(0, 11) }, null, every)).toBe(-1);
    // A season end at turn 33 anchors after every row.
    expect(anchorTurn(ev, 33, every)).toBe(33);
    // New sample evidence available at turn 40.
    const pit = {
      ...(ev.samples[0] as SampleRecord),
      id: formatId('smp', 1) as SampleId,
      source: 'own' as const,
      availableTurn: 40,
    };
    const withPit = { ...ev, samples: [...ev.samples, pit] };
    expect(anchorTurn(withPit, null, every)).toBe(40);
    // A stored anchor is kept while F_c is unchanged and replaced when it moves.
    const a1 = refreshAnchor(null, ev, null, every);
    expect(refreshAnchor(a1, ev, null, every)).toBe(a1);
    expect(refreshAnchor(a1, withPit, null, every).turn).toBe(40);
    expect(fullSolveAnchor(ev).minedBlockIds.length).toBeGreaterThanOrEqual(0);
  });

  it('claims with no production keep the full-solve estimate (anchored = full)', () => {
    const op = operation(world, claim);
    const ev = evidence(op);
    const planning = planningFor(op.h, op.priors);
    const a = estimateAnchored(op.priors, ev, refreshAnchor(null, ev, null, 12), planning, op.h.ctx);
    const b = estimateFromEvidence(op.priors, ev, planning, op.h.ctx);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('only stripping since the anchor moves overburden, by the stripped feet', () => {
    const { op } = operated(claim, 2);
    const id = formatId('blk', claim.blockIdBase + 7) as BlockId;
    const ev = evidence(op);
    const anchor = takeAnchor(21, ev.blockState);
    const planning = planningFor(op.h, op.priors);
    const before = estimateAnchored(op.priors, ev, anchor, planning, op.h.ctx);
    const st = op.blockState[id] ?? { minedFrac: 0, sampledBcy: 0, strippedFt: 0 };
    const ev2: EvidenceSet = {
      ...ev,
      blockState: { ...ev.blockState, [id]: { ...st, strippedFt: st.strippedFt + 2 } },
    };
    const after = estimateAnchored(op.priors, ev2, anchor, planning, op.h.ctx);
    const b0 = before.blocks[7];
    const b1 = after.blocks[7];
    expect(b1?.gradeP50).toBe(b0?.gradeP50);
    expect((b0?.depthToBedrockFtP50 ?? 0) - (b1?.depthToBedrockFtP50 ?? 0)).toBeCloseTo(2, 9);
    if ((b0?.overburdenFtP50 ?? 0) > 2)
      expect((b0?.overburdenFtP50 ?? 0) - (b1?.overburdenFtP50 ?? 0)).toBeCloseTo(2, 9);
  });
});
