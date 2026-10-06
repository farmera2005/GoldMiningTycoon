// Evidence stages for the §4 estimator calibration (DESIGN §4.22): the evidence mixes prior, records, pans, pit
// fences, pit grid, + bulk, sonic, sonic + bulk, drawn from §3's engine generator and executed through §4's own
// sample-execution code (§4.3), so the harness calibrates exactly the code path programs use. Truth is read here
// only to execute samples and to score; the estimator receives priors and evidence alone.
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { formatId, type BlockId, type ClaimId, type RecordFindingId, type SampleId } from '../../src/engine/core/ids';
import {
  claimPriors,
  claimTruth,
  drawContextFor,
  publicRecord,
  recordsQuality,
  type BlockState,
  type BlockTruth,
  type Claim,
  type ClaimPriors,
  type ClaimTruth,
  type PriorStatus,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { BCY_PER_ACRE_FT } from '../../src/engine/systems/world/constants';
import { UNTOUCHED_BLOCK } from '../../src/engine/systems/world/sample';
import {
  defaultPlanning,
  estimateFromEvidence,
  estimatorParams,
  executeSample,
  executionParams,
  recordsParams,
  recordsReview,
  statisticalEstimate,
  type EstimateContext,
  type EstimatorParams,
  type EvidenceSet,
  type ExecutionParams,
  type KnownBlockState,
  type Logger,
  type MethodId,
  type PlanningAssumptions,
  type RecordFinding,
  type RecordsParams,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { normCdf, normInv } from '../../src/engine/core/dmath';

export const STAGES = ['prior', 'records', 'pans', 'pitFences', 'pitGrid', 'bulk', 'sonic', 'sonicBulk'] as const;
export type Stage = (typeof STAGES)[number];

/** The logger of every calibration sample: a standard-tier consultant (skill 70, known). */
export const CAL_LOGGER: Logger = { kind: 'consultant', trueSkill: 70, shownSkill: 70 };
export const CAL_REACH_FT = 22; // the owner's 30-t excavator (§4.9)
export const PAN_STATIONS = 24;
export const PIT_BCY = 5;
export const BULK_BCY = 500;
export const BULK_PEN_FT = 1.5;

export interface StageScore {
  readonly stage: Stage;
  readonly truthOz: number;
  readonly p10: number;
  readonly p50: number;
  readonly p90: number;
  /** PIT z of each scored block: Φ⁻¹(F(ln G_true)) under the block's posterior mixture. */
  readonly blockZ: readonly number[];
  readonly confidence: string;
  readonly ms: number;
}

export interface ClaimRun {
  readonly claimId: ClaimId;
  readonly scores: readonly StageScore[];
  /** Listed population: prior-only ln(P50/truth) with statusMult.listed forced to 1 (the held prior), §4.22 teeth. */
  readonly teethLnRatio?: number;
}

export interface HarnessContext {
  readonly tuning: TuningResolved;
  readonly params: EstimatorParams;
  readonly exec: ExecutionParams;
  readonly records: RecordsParams;
  readonly ctx: EstimateContext;
}

/** The default planning case of the claim's climate band (§4.7). */
export function planningFor(h: HarnessContext, priors: ClaimPriors): PlanningAssumptions {
  const band = h.params.templates[priors.templateId]?.climateBand ?? 'subarctic';
  return defaultPlanning(h.params, band);
}

export function harnessContext(world: WorldSlice, tuning: TuningResolved = baseTuning): HarnessContext {
  const params = estimatorParams(tuning, world.genParams);
  const spot = 4200;
  const cap = world.genParams.refEcon.capture;
  const ctx: EstimateContext = {
    params,
    ema13UsdPerFineOz: spot,
    spotUsdPerFineOz: spot,
    refSpotUsdPerFineOz: spot,
    recoveryBySize: { coarse: cap[0], medium: cap[1], fine: cap[2], ultrafine: cap[3] },
  };
  return {
    tuning,
    params,
    exec: executionParams(tuning),
    records: recordsParams(tuning),
    ctx,
  };
}

interface BlockSim {
  readonly truth: BlockTruth;
  state: BlockState;
  readonly blockId: BlockId;
}

/** Truth contained metal oz of a claim given the current block states (§3.5.1; pockets included, piles excluded). */
export function truthContainedOz(blocks: readonly BlockSim[]): number {
  let oz = 0;
  for (const b of blocks) {
    const pay = (b.truth.payThicknessFt + b.truth.bedrockCleanupFt) * BCY_PER_ACRE_FT;
    oz += b.truth.gradeOzPerBcy * Math.max(0, pay - b.state.minedBcy - b.state.sampledBcy);
  }
  return oz;
}

function knownState(blocks: readonly BlockSim[]): Partial<Record<BlockId, KnownBlockState>> {
  const out: Partial<Record<BlockId, KnownBlockState>> = {};
  for (const b of blocks) {
    const s = b.state;
    if (s.minedBcy === 0 && s.sampledBcy === 0 && s.strippedBcy === 0) continue;
    const pay = (b.truth.payThicknessFt + b.truth.bedrockCleanupFt) * BCY_PER_ACRE_FT;
    // Mined area share is visible (recent operators mined whole blocks, §3.6); the harness reads it from state.
    out[b.blockId] = {
      minedFrac: pay > 0 ? Math.min(1, s.minedBcy / pay) : 0,
      sampledBcy: s.sampledBcy,
      strippedFt: s.strippedBcy / BCY_PER_ACRE_FT,
    };
  }
  return out;
}

class ClaimSim {
  readonly blocks: BlockSim[];
  readonly drawIndex: Record<string, number> = {};
  samples: SampleRecord[] = [];
  records: RecordFinding[] = [];
  private sampleSeq = 0;
  private recordSeq = 0;
  constructor(
    readonly world: WorldSlice,
    readonly claim: Claim,
    readonly truth: ClaimTruth,
    readonly h: HarnessContext,
    readonly seed: string,
  ) {
    this.blocks = truth.blocks.map((bt, idx) => {
      const blockId = formatId('blk', claim.blockIdBase + idx);
      return { truth: bt, state: world.blockStates[blockId] ?? UNTOUCHED_BLOCK, blockId };
    });
  }

  nextSampleId(): SampleId {
    return formatId('smp', ++this.sampleSeq);
  }

  nextRecordId(): RecordFindingId {
    return formatId('rec', ++this.recordSeq);
  }

  mined(idx: number): boolean {
    const b = this.blocks[idx] as BlockSim;
    const pay = (b.truth.payThicknessFt + b.truth.bedrockCleanupFt) * BCY_PER_ACRE_FT;
    return b.state.minedBcy >= pay - 1e-6;
  }

  sample(idx: number, methodId: MethodId, extra: { volumeBcy?: number; machineReachFt?: number; bedrockPenFt?: number } = {}): SampleRecord {
    const b = this.blocks[idx] as BlockSim;
    const key = `${b.blockId}|${methodId}`;
    const k = this.drawIndex[key] ?? 0;
    this.drawIndex[key] = k + 1;
    const res = executeSample(
      b.truth,
      b.state,
      drawContextFor(this.world, b.blockId),
      {
        seed: this.seed,
        sampleId: this.nextSampleId(),
        claimId: this.claim.id,
        blockId: b.blockId,
        methodId,
        k,
        turn: 0,
        availableTurn: 0,
        logger: CAL_LOGGER,
        ...extra,
      },
      this.h.exec,
    );
    if (res.extractedBcy > 0) b.state = { ...b.state, sampledBcy: b.state.sampledBcy + res.extractedBcy };
    this.samples.push(res.record);
    return res.record;
  }

  evidence(samples: readonly SampleRecord[], records: readonly RecordFinding[]): EvidenceSet {
    return {
      claimId: this.claim.id,
      samples,
      records,
      blockState: knownState(this.blocks),
      assays: [],
      geologistOnClaim: true,
    };
  }

  snapshot(): BlockSim[] {
    return this.blocks.map((b) => ({ ...b }));
  }
}

function pitZ(stat: ReturnType<typeof statisticalEstimate>['stat'], b: number, x: number): number {
  const n = stat.model.n;
  const H = stat.hyps.count;
  const sd = Math.sqrt(Math.max(stat.CG[b * n + b] as number, 1e-12));
  let F = 0;
  for (let h = 0; h < H; h++) F += (stat.weights[h] as number) * normCdf((x - (stat.meanLnG[h * n + b] as number)) / sd);
  const p = Math.min(1 - 1e-12, Math.max(1e-12, F));
  return normInv(p);
}

function score(
  sim: ClaimSim,
  priors: ClaimPriors,
  stage: Stage,
  samples: readonly SampleRecord[],
  records: readonly RecordFinding[],
  blocksAt: readonly BlockSim[],
): StageScore & { bestBlock: number } {
  const ev: EvidenceSet = {
    claimId: sim.claim.id,
    samples,
    records,
    blockState: knownState(blocksAt),
    assays: [],
    geologistOnClaim: true,
  };
  const t0 = performance.now();
  const est = estimateFromEvidence(priors, ev, planningFor(sim.h, priors), sim.h.ctx);
  const ms = performance.now() - t0;
  const { stat } = statisticalEstimate(priors, ev, sim.h.params);
  const z: number[] = [];
  let best = 0;
  let bestV = -Infinity;
  blocksAt.forEach((b, idx) => {
    if (stat.agg.alive[idx] === 1 && (stat.lnGMean[idx] as number) > bestV) {
      bestV = stat.lnGMean[idx] as number;
      best = idx;
    }
    if (b.truth.pocket !== undefined || stat.agg.alive[idx] !== 1 || !(b.truth.gradeOzPerBcy > 0)) return;
    z.push(pitZ(stat, idx, Math.log(b.truth.gradeOzPerBcy)));
  });
  return {
    stage,
    truthOz: truthContainedOz(blocksAt),
    p10: est.claim.containedOzP10,
    p50: est.claim.containedOzP50,
    p90: est.claim.containedOzP90,
    blockZ: z,
    confidence: est.claim.confidence,
    ms,
    bestBlock: best,
  };
}

/** Runs every evidence stage on one claim with the given prior status. */
export function runClaim(
  world: WorldSlice,
  claimId: ClaimId,
  seed: string,
  h: HarnessContext,
  status: PriorStatus,
  stages: readonly Stage[] = STAGES,
): ClaimRun {
  const claim = world.claims[claimId] as Claim;
  const truth = claimTruth(world, claimId);
  const priors = claimPriors(world, claimId, status);
  const sim = new ClaimSim(world, claim, truth, h, seed);
  const n = sim.blocks.length;
  const scores: StageScore[] = [];
  const want = (st: Stage): boolean => stages.includes(st);
  const push = (s: StageScore): void => {
    if (want(s.stage)) scores.push({ ...s, blockZ: s.blockZ });
  };
  const maybe = (
    st: Stage,
    samples: readonly SampleRecord[],
    recs: readonly RecordFinding[],
    needBest = false,
  ): (StageScore & { bestBlock: number }) | null => {
    if (!want(st) && !needBest) return null;
    const r = score(sim, priors, st, samples, recs, sim.snapshot());
    push(r);
    return r;
  };

  maybe('prior', [], []);
  let teethLnRatio: number | undefined;
  if (status === 'listed') {
    const held = claimPriors(world, claimId, 'held');
    const r = score(sim, held, 'prior', [], [], sim.snapshot());
    teethLnRatio = Math.log(r.p50 / r.truthOz);
  }

  // Records review by the calibration logger (standard consultant), all P2 items the estimator reads.
  const rv = recordsReview(
    {
      seed,
      claimId,
      creekId: claim.creekId,
      turn: 0,
      record: publicRecord(world, claimId),
      quality: recordsQuality(world, claimId),
      reviewer: { kind: 'consultant', tier: 'standard' },
      items: ['creekHistory', 'oldWorkings', 'priorExploration'],
      blockIdOf: (i) => formatId('blk', claim.blockIdBase + i),
      nextRecordId: () => sim.nextRecordId(),
      nextSampleId: () => sim.nextSampleId(),
    },
    h.records,
  );
  const records = rv.findings;
  const recSamples = rv.samples;
  maybe('records', recSamples, records);

  // 24 pan stations on the channel blocks (exposures), round robin; all blocks if the claim has no channel.
  const channel: number[] = [];
  for (let i = 0; i < n; i++) if (claim.env.surfaceCodes[i] === 'c' && !sim.mined(i)) channel.push(i);
  const panTargets = channel.length > 0 ? channel : [...Array(n).keys()].filter((i) => !sim.mined(i));
  for (let k = 0; k < PAN_STATIONS && panTargets.length > 0; k++) sim.sample(panTargets[k % panTargets.length] as number, 'pan');
  const pans = sim.samples.slice();
  maybe('pans', [...recSamples, ...pans], records);
  const afterPans = sim.snapshot();

  // Pit fences on every other row, then the rest of the grid (5-bcy pits, 22-ft reach).
  const rowOf = (i: number): number => Math.floor(i / claim.nAcross);
  for (let i = 0; i < n; i++) if (rowOf(i) % 2 === 1 && !sim.mined(i)) sim.sample(i, 'excavatorPit', { volumeBcy: PIT_BCY, machineReachFt: CAL_REACH_FT });
  maybe('pitFences', [...recSamples, ...sim.samples], records);
  for (let i = 0; i < n; i++) if (rowOf(i) % 2 === 0 && !sim.mined(i)) sim.sample(i, 'excavatorPit', { volumeBcy: PIT_BCY, machineReachFt: CAL_REACH_FT });
  const grid = maybe('pitGrid', [...recSamples, ...sim.samples], records, want('bulk'));
  if (grid !== null) {
    sim.sample(grid.bestBlock, 'bulkSample', { volumeBcy: BULK_BCY, bedrockPenFt: BULK_PEN_FT });
    maybe('bulk', [...recSamples, ...sim.samples], records);
  }

  // Alternative: sonic holes after the pans (block states as after the pans).
  const pitSamples = sim.samples;
  sim.samples = pans.slice();
  sim.blocks.forEach((b, i) => {
    b.state = (afterPans[i] as BlockSim).state;
  });
  const holes = Math.max(30, n);
  const live = [...Array(n).keys()].filter((i) => !sim.mined(i));
  for (let k = 0; k < holes && live.length > 0; k++) sim.sample(live[k % live.length] as number, 'sonic');
  const sonic = maybe('sonic', [...recSamples, ...sim.samples], records, want('sonicBulk'));
  if (sonic !== null) {
    sim.sample(sonic.bestBlock, 'bulkSample', { volumeBcy: BULK_BCY, bedrockPenFt: BULK_PEN_FT });
    maybe('sonicBulk', [...recSamples, ...sim.samples], records);
  }
  void pitSamples;
  return { claimId, scores, ...(teethLnRatio !== undefined ? { teethLnRatio } : {}) };
}
