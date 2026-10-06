// `npx tsx sim/calibration/estimator-perf.ts [--reps N]`: the §4 estimator's time budgets (DESIGN §2.13, §4.22
// "Performance") on claims from §3's engine generator. Reports (1) the full solve of one claim, cold memo: a 20-acre
// claim with 20 pits and a 160-acre claim with 60 samples (large-claim mode); (2) an economic-layer rerun (planning
// price moved, statistical layer cached); (3) the amortized refresh per game-week for 8 tracked claims that get a
// new batch of pits every 4 weeks (two claims a week) while the planning price moves weekly.
import { baseTuning } from '../../src/data/tuning';
import { clearAllMemos } from '../../src/engine/core/memo';
import { formatId } from '../../src/engine/core/ids';
import { claimPriors, claimTruth, drawContextFor, generateWorld, type Claim, type WorldSlice } from '../../src/engine/systems/world';
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
import { CAL_LOGGER, harnessContext, planningFor } from './estimator-stages';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const reps = Number(arg('reps') ?? 20);
const world = generateWorld('2013', { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] }, baseTuning);
const h = harnessContext(world, baseTuning);
const exec = executionParams(baseTuning);

function samples(w: WorldSlice, claim: Claim, plan: readonly { idx: number; method: MethodId; volumeBcy?: number }[]): SampleRecord[] {
  const truth = claimTruth(w, claim.id);
  const k: Record<string, number> = {};
  return plan.map((p, i) => {
    const blockId = formatId('blk', claim.blockIdBase + p.idx);
    const key = `${p.idx}|${p.method}`;
    const kk = k[key] ?? 0;
    k[key] = kk + 1;
    return executeSample(
      truth.blocks[p.idx] as (typeof truth.blocks)[number],
      w.blockStates[blockId] ?? UNTOUCHED_BLOCK,
      drawContextFor(w, blockId),
      {
        seed: '2013',
        sampleId: formatId('smp', i + 1),
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

function evidence(claim: Claim, recs: readonly SampleRecord[]): EvidenceSet {
  return { ...emptyEvidence(claim.id), samples: recs, geologistOnClaim: true };
}

function stats(xs: number[]): string {
  const s = xs.slice().sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return `mean ${mean.toFixed(2)} ms, median ${(s[Math.floor(s.length / 2)] as number).toFixed(2)}, p95 ${(s[Math.floor(0.95 * (s.length - 1))] as number).toFixed(2)}`;
}

const held = world.claimIds.map((id) => world.claims[id] as Claim).filter((c) => c.status === 'heldNpc');
const small = held.filter((c) => c.acres === 20 && c.nAlong * c.nAcross >= 20).slice(0, reps);
const large = held.filter((c) => c.acres === 160).slice(0, Math.max(3, Math.ceil(reps / 4)));

// (1) Full solve, cold memo.
const tSmall: number[] = [];
for (const c of small) {
  const n = c.nAlong * c.nAcross;
  const recs = samples(world, c, [...Array(20).keys()].map((i) => ({ idx: i % n, method: 'excavatorPit', volumeBcy: 5 })));
  const priors = claimPriors(world, c.id, 'held');
  clearAllMemos();
  const t0 = performance.now();
  estimateFromEvidence(priors, evidence(c, recs), planningFor(h, priors), h.ctx);
  tSmall.push(performance.now() - t0);
}
const tLarge: number[] = [];
let largeBlocks = 0;
let largeHyps = 0;
for (const c of large) {
  const n = c.nAlong * c.nAcross;
  largeBlocks = n;
  const plan = [...Array(60).keys()].map((i) => ({
    idx: Math.floor((i * n) / 60),
    method: (i % 3 === 0 ? 'sonic' : 'excavatorPit') as MethodId,
    ...(i % 3 === 0 ? {} : { volumeBcy: 5 }),
  }));
  const recs = samples(world, c, plan);
  const priors = claimPriors(world, c.id, 'held');
  clearAllMemos();
  const t0 = performance.now();
  const e = estimateFromEvidence(priors, evidence(c, recs), planningFor(h, priors), h.ctx);
  tLarge.push(performance.now() - t0);
  largeHyps = e.claim.hypotheses.evaluated;
}

// (2) Economic-layer rerun: the planning price moves past a reprice step; the statistical layer is cached.
const tEcon: number[] = [];
for (const c of small) {
  const recs = samples(world, c, [...Array(20).keys()].map((i) => ({ idx: i % (c.nAlong * c.nAcross), method: 'excavatorPit', volumeBcy: 5 })));
  const priors = claimPriors(world, c.id, 'held');
  const ev = evidence(c, recs);
  estimateFromEvidence(priors, ev, planningFor(h, priors), h.ctx);
  for (let k = 1; k <= 5; k++) {
    const spot = h.ctx.spotUsdPerFineOz * (1 + 0.05 * k);
    const ctx = { ...h.ctx, ema13UsdPerFineOz: spot, spotUsdPerFineOz: spot };
    const t0 = performance.now();
    estimateFromEvidence(priors, ev, planningFor(h, priors), ctx);
    tEcon.push(performance.now() - t0);
  }
}

// (3) Amortized per game-week: 8 tracked claims, a batch of 5 pits on two of them each week, weekly price moves.
clearAllMemos();
const tracked = small.slice(0, 8);
const plans = tracked.map((c) => samples(world, c, [...Array(40).keys()].map((i) => ({ idx: i % (c.nAlong * c.nAcross), method: 'excavatorPit', volumeBcy: 5 }))));
const have = tracked.map(() => 0);
const weeks = 52;
let total = 0;
for (let wk = 0; wk < weeks; wk++) {
  const spot = h.ctx.spotUsdPerFineOz * (1 + 0.004 * wk);
  const ctx = { ...h.ctx, ema13UsdPerFineOz: spot, spotUsdPerFineOz: spot };
  for (const j of [(2 * wk) % 8, (2 * wk + 1) % 8]) have[j] = Math.min(40, (have[j] as number) + 5);
  const t0 = performance.now();
  tracked.forEach((c, j) => {
    const priors = claimPriors(world, c.id, 'held');
    estimateFromEvidence(priors, evidence(c, (plans[j] as SampleRecord[]).slice(0, have[j])), planningFor(h, priors), ctx);
  });
  total += performance.now() - t0;
}

console.log(`§4 estimator performance (Node ${process.version}; world seed 2013)`);
console.log(`  full solve, 20-acre claim, 20 pits (${small.length} claims): ${stats(tSmall)}   [budget ≤ 10 ms]`);
console.log(
  `  full solve, 160-acre claim (${largeBlocks} blocks), 60 samples, large-claim mode (${large.length} claims, ${largeHyps} hypotheses): ${stats(tLarge)}   [budget ≤ 60 ms]`,
);
console.log(`  economic-layer rerun (price moved, statistical layer cached): ${stats(tEcon)}   [budget ≤ 0.5 ms]`);
console.log(`  amortized refresh, 8 tracked claims, 2 new pit batches a week, weekly price: ${(total / weeks).toFixed(2)} ms per game-week   [budget ≤ 1.5 ms]`);
