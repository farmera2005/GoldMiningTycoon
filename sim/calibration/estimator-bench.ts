// The §4 estimator's per-estimate time checks (DESIGN §4.22 "Performance", §2.13; s04 #2) on claims from §3's engine
// generator, shared by `sim/calibration/estimator-perf.ts` (report) and `tests/perf/estimator.perf.test.ts` (gate):
// a full solve of a 20-acre claim with 20 pits and of a 160-acre claim with 60 samples (large-claim mode), each from a
// cold memo (prior model built) and on new evidence (prior model cached, one more sample), and an economic-layer rerun
// (planning price moved past a grid line, statistical layer cached). Samples are executed untimed. A few untimed
// claims run first so the timed ones measure compiled code, not the JIT's first pass.
import { baseTuning } from '../../src/data/tuning';
import { formatId, type BlockId, type SampleId } from '../../src/engine/core/ids';
import { clearAllMemos } from '../../src/engine/core/memo';
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
  type EvidenceSet,
  type MethodId,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { CAL_LOGGER, harnessContext, planningFor, type HarnessContext } from './estimator-stages';

export const BENCH_SEED = '2013';

interface Bench {
  readonly world: WorldSlice;
  readonly h: HarnessContext;
  readonly small: readonly Claim[];
  readonly large: readonly Claim[];
}

let bench: Bench | null = null;

function benchWorld(): Bench {
  if (bench !== null) return bench;
  const world = generateWorld(
    BENCH_SEED,
    { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] },
    baseTuning,
  );
  const held = world.claimIds.map((id) => world.claims[id] as Claim).filter((c) => c.status === 'heldNpc');
  bench = {
    world,
    h: harnessContext(world, baseTuning),
    small: held.filter((c) => c.acres === 20 && c.nAlong * c.nAcross >= 20),
    large: held.filter((c) => c.acres === 160),
  };
  return bench;
}

interface PlannedSample {
  readonly idx: number;
  readonly method: MethodId;
  readonly volumeBcy?: number;
}

function executePlan(w: WorldSlice, claim: Claim, plan: readonly PlannedSample[]): SampleRecord[] {
  const truth = claimTruth(w, claim.id);
  const exec = executionParams(baseTuning);
  const k: Record<string, number> = {};
  return plan.map((p, i) => {
    const blockId = formatId('blk', claim.blockIdBase + p.idx) as BlockId;
    const key = `${p.idx}|${p.method}`;
    const kk = k[key] ?? 0;
    k[key] = kk + 1;
    return executeSample(
      truth.blocks[p.idx] as (typeof truth.blocks)[number],
      w.blockStates[blockId] ?? UNTOUCHED_BLOCK,
      drawContextFor(w, blockId),
      {
        seed: BENCH_SEED,
        sampleId: formatId('smp', i + 1) as SampleId,
        claimId: claim.id,
        blockId,
        methodId: p.method,
        k: kk,
        turn: 0,
        availableTurn: 0,
        logger: CAL_LOGGER,
        machineReachFt: 22,
        ...(p.volumeBcy !== undefined ? { volumeBcy: p.volumeBcy } : {}),
      },
      exec,
    ).record;
  });
}

function evidenceOf(claim: Claim, recs: readonly SampleRecord[]): EvidenceSet {
  return { ...emptyEvidence(claim.id), samples: recs };
}

/** 20 excavator pits, cycling over the claim's blocks. */
function smallPlan(claim: Claim): PlannedSample[] {
  const n = claim.nAlong * claim.nAcross;
  return [...Array(20).keys()].map((i) => ({ idx: i % n, method: 'excavatorPit', volumeBcy: 5 }));
}

/** 60 samples spread along the claim, every third a sonic hole, the rest excavator pits. */
function largePlan(claim: Claim): PlannedSample[] {
  const n = claim.nAlong * claim.nAcross;
  return [...Array(60).keys()].map((i) =>
    i % 3 === 0
      ? { idx: Math.floor((i * n) / 60), method: 'sonic' }
      : { idx: Math.floor((i * n) / 60), method: 'excavatorPit', volumeBcy: 5 },
  );
}

export interface FullSolveBench {
  readonly claims: number;
  readonly blocks: number;
  readonly samples: number;
  readonly hypotheses: number;
  /** Memo cleared: the prior model and every evidence item's hash are built too. */
  readonly coldMs: readonly number[];
  /** The same claim with one more sample: the prior model and the older items' hashes cached. */
  readonly cachedMs: readonly number[];
}

/** Full solves of `count` claims of the given size (after `warmup` untimed claims). */
export function benchFullSolves(size: 'small' | 'large', count: number, now: () => number, warmup = 3): FullSolveBench {
  const b = benchWorld();
  const pool = size === 'small' ? b.small : b.large;
  const coldMs: number[] = [];
  const cachedMs: number[] = [];
  let blocks = 0;
  let samples = 0;
  let hypotheses = 0;
  for (let j = 0; j < warmup + count; j++) {
    const c = pool[j % pool.length] as Claim;
    const recs = executePlan(b.world, c, size === 'small' ? smallPlan(c) : largePlan(c));
    const priors = claimPriors(b.world, c.id, 'held');
    const planning = planningFor(b.h, priors);
    clearAllMemos();
    let t0 = now();
    estimateFromEvidence(priors, evidenceOf(c, recs.slice(0, -1)), planning, b.h.ctx);
    const cold = now() - t0;
    t0 = now();
    const e = estimateFromEvidence(priors, evidenceOf(c, recs), planning, b.h.ctx);
    const cached = now() - t0;
    if (j < warmup) continue;
    coldMs.push(cold);
    cachedMs.push(cached);
    blocks = c.nAlong * c.nAcross;
    samples = recs.length;
    hypotheses = e.claim.hypotheses.evaluated;
  }
  return { claims: count, blocks, samples, hypotheses, coldMs, cachedMs };
}

/** Economic-layer reruns: five 5% planning-price steps on each of `count` small claims (statistical layer cached). */
export function benchEconRerun(count: number, now: () => number, warmup = 2): number[] {
  const b = benchWorld();
  const out: number[] = [];
  for (let j = 0; j < warmup + count; j++) {
    const c = b.small[j % b.small.length] as Claim;
    const priors = claimPriors(b.world, c.id, 'held');
    const planning = planningFor(b.h, priors);
    const ev = evidenceOf(c, executePlan(b.world, c, smallPlan(c)));
    estimateFromEvidence(priors, ev, planning, b.h.ctx);
    for (let k = 1; k <= 5; k++) {
      const spot = b.h.ctx.spotUsdPerFineOz * (1 + 0.05 * k);
      const ctx = { ...b.h.ctx, ema13UsdPerFineOz: spot, spotUsdPerFineOz: spot };
      const t0 = now();
      estimateFromEvidence(priors, ev, planning, ctx);
      if (j >= warmup) out.push(now() - t0);
    }
  }
  return out;
}

export interface TimingStats {
  readonly n: number;
  readonly mean: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

export function timingStats(xs: readonly number[]): TimingStats {
  const s = xs.slice().sort((a, b) => a - b);
  const at = (q: number): number => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] ?? NaN;
  return {
    n: xs.length,
    mean: xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN,
    median: at(0.5),
    p95: at(0.95),
    max: s[s.length - 1] ?? NaN,
  };
}

export function formatStats(t: TimingStats): string {
  return `mean ${t.mean.toFixed(2)} ms, median ${t.median.toFixed(2)}, p95 ${t.p95.toFixed(2)} (n ${t.n})`;
}
