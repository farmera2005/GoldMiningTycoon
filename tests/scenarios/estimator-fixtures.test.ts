// DESIGN §4.22 fixtures of the §4 estimator on claims from §3's engine generator: order independence and the memo,
// no truth leakage (scrambled truth), RNG isolation, censoring and false bedrock, pockets, and the invariance of the
// world under §4's keys (the estimator never feeds back into generation).
import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import { canonicalJson, hashValue } from '../../src/engine/core/hash';
import { formatId, type BlockId, type ClaimId, type SampleId } from '../../src/engine/core/ids';
import {
  claimPriors,
  claimTruth,
  drawContextFor,
  generateWorld,
  type Claim,
  type ClaimPriors,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { UNTOUCHED_BLOCK } from '../../src/engine/systems/world/sample';
import {
  emptyEvidence,
  estimateFromEvidence,
  executeSample,
  executionParams,
  priorModel,
  statisticalEstimate,
  type EvidenceSet,
  type MethodId,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { prepareSamples } from '../../src/engine/systems/knowledge/samples';
import { CAL_LOGGER, harnessContext, planningFor } from '../../sim/calibration/estimator-stages';

const OPTS = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
const world = generateWorld('4022', OPTS, baseTuning);
const h = harnessContext(world, baseTuning);
const exec = executionParams(baseTuning);

function templateOf(w: WorldSlice, c: Claim): string {
  return (w.districts[c.districtId] as { templateId: string }).templateId;
}

/** Held 20-acre claims of a template and setting, in id order. */
function claimsWhere(pred: (c: Claim) => boolean): Claim[] {
  return world.claimIds.map((id) => world.claims[id] as Claim).filter((c) => c.status === 'heldNpc' && pred(c));
}

const northCreek = claimsWhere(
  (c) => templateOf(world, c) === 'northernFederal' && c.setting === 'valleyBottom' && c.acres === 20,
);

interface Sampler {
  readonly claim: Claim;
  readonly records: SampleRecord[];
  sample(idx: number, methodId: MethodId, extra?: { volumeBcy?: number; machineReachFt?: number; k?: number }): SampleRecord;
}

/** Executes samples on one claim with fresh block states and per-block, per-method draw indices (§4.3). */
function sampler(claim: Claim, seed = '4022'): Sampler {
  const truth = claimTruth(world, claim.id);
  const draws: Record<string, number> = {};
  let seq = 0;
  const records: SampleRecord[] = [];
  return {
    claim,
    records,
    sample(idx, methodId, extra = {}) {
      const blockId = formatId('blk', claim.blockIdBase + idx);
      const key = `${blockId}|${methodId}`;
      const k = extra.k ?? draws[key] ?? 0;
      draws[key] = k + 1;
      const res = executeSample(
        truth.blocks[idx] as (typeof truth.blocks)[number],
        world.blockStates[blockId] ?? UNTOUCHED_BLOCK,
        drawContextFor(world, blockId),
        {
          seed,
          sampleId: formatId('smp', ++seq),
          claimId: claim.id,
          blockId,
          methodId,
          k,
          turn: 0,
          availableTurn: 0,
          logger: CAL_LOGGER,
          ...(extra.volumeBcy !== undefined ? { volumeBcy: extra.volumeBcy } : {}),
          ...(extra.machineReachFt !== undefined ? { machineReachFt: extra.machineReachFt } : {}),
        },
        exec,
      );
      records.push(res.record);
      return res.record;
    },
  };
}

function evidenceOf(claimId: ClaimId, samples: readonly SampleRecord[]): EvidenceSet {
  return { ...emptyEvidence(claimId), samples, geologistOnClaim: true };
}

/** 20 pits (5 bcy, 22-ft reach), one per block. */
function pitGrid(claim: Claim): SampleRecord[] {
  const s = sampler(claim);
  const n = claim.nAlong * claim.nAcross;
  for (let i = 0; i < n; i++) s.sample(i, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
  return s.records;
}

describe('order independence, determinism and the memo (§4.22)', () => {
  const claim = northCreek[0] as Claim;
  const priors = claimPriors(world, claim.id, 'held');
  const planning = planningFor(h, priors);
  const records = pitGrid(claim);

  it('gives a bit-identical estimate for any acquisition order of the same samples', () => {
    const a = estimateFromEvidence(priors, evidenceOf(claim.id, records), planning, h.ctx);
    const shuffled = records.slice().reverse();
    shuffled.push(shuffled.splice(3, 1)[0] as SampleRecord);
    const b = estimateFromEvidence(priors, evidenceOf(claim.id, shuffled), planning, h.ctx);
    expect(canonicalJson(b)).toBe(canonicalJson(a));
    expect(a.claim.containedOzP50).toBeGreaterThan(0);
  });

  it('returns the identical object for an identical evidence hash', () => {
    const a = estimateFromEvidence(priors, evidenceOf(claim.id, records), planning, h.ctx);
    const b = estimateFromEvidence(priors, evidenceOf(claim.id, records.slice()), planning, h.ctx);
    expect(b).toBe(a);
    const s1 = statisticalEstimate(priors, evidenceOf(claim.id, records), h.params);
    const s2 = statisticalEstimate(priors, evidenceOf(claim.id, records.slice()), h.params);
    expect(s2.stat).toBe(s1.stat);
  });

  it('a cold memo changes no result (a save/load round trip of the evidence too)', () => {
    const a = estimateFromEvidence(priors, evidenceOf(claim.id, records), planning, h.ctx);
    const roundTrip = JSON.parse(JSON.stringify(evidenceOf(claim.id, records))) as EvidenceSet;
    // A fresh priors object and a structurally equal evidence set miss the object-keyed caches.
    const priors2 = JSON.parse(JSON.stringify(priors)) as ClaimPriors;
    const b = estimateFromEvidence(priors2, roundTrip, planning, h.ctx);
    expect(canonicalJson(b)).toBe(canonicalJson(a));
  });

  it('every hypothesis weight set sums to 1', () => {
    const { stat } = statisticalEstimate(priors, evidenceOf(claim.id, records), h.params);
    let s = 0;
    for (let i = 0; i < stat.hyps.count; i++) s += stat.weights[i] as number;
    expect(s).toBeCloseTo(1, 12);
  });
});

describe('no truth leakage (§4.22)', () => {
  // Rotate every hidden field across claims, creeks and districts: what the estimator sees must not move.
  const rot = <T>(xs: readonly T[], k: number): T[] => xs.map((_, i) => xs[(i + k) % xs.length] as T);
  const ids = world.claimIds;
  const hiddenRot = rot(ids.map((id) => (world.claims[id] as Claim).hidden), 7);
  const claims = Object.fromEntries(ids.map((id, i) => [id, { ...(world.claims[id] as Claim), hidden: hiddenRot[i] }]));
  const creekIds = Object.keys(world.creeks) as (keyof typeof world.creeks)[];
  const creekHidden = rot(creekIds.map((id) => world.creeks[id]?.hidden), 3);
  const creeks = Object.fromEntries(creekIds.map((id, i) => [id, { ...world.creeks[id], hidden: creekHidden[i] }]));
  const districts = Object.fromEntries(
    world.districtIds.map((id, i) => [
      id,
      { ...world.districts[id], hidden: world.districts[world.districtIds[(i + 1) % world.districtIds.length] as typeof id]?.hidden },
    ]),
  );
  const scrambled = { ...world, claims, creeks, districts } as unknown as WorldSlice;

  it('leaves claimPriors and estimateFromEvidence unchanged', () => {
    const sample = [...northCreek.slice(0, 3), ...claimsWhere((c) => templateOf(world, c) === 'aridFederal').slice(0, 3)];
    for (const claim of sample) {
      for (const status of ['held', 'listed'] as const) {
        const p0 = claimPriors(world, claim.id, status);
        const p1 = claimPriors(scrambled, claim.id, status);
        expect(canonicalJson(p1)).toBe(canonicalJson(p0));
      }
      const records = pitGrid(claim).slice(0, 6);
      const p0 = claimPriors(world, claim.id, 'held');
      const p1 = claimPriors(scrambled, claim.id, 'held');
      const e0 = estimateFromEvidence(p0, evidenceOf(claim.id, records), planningFor(h, p0), h.ctx);
      const e1 = estimateFromEvidence(p1, evidenceOf(claim.id, records), planningFor(h, p1), h.ctx);
      expect(canonicalJson(e1)).toBe(canonicalJson(e0));
    }
  });
});

describe('RNG isolation (§2.3, §4.22)', () => {
  const [a, b] = northCreek as [Claim, Claim];

  it('sampling claim A leaves every draw on claim B unchanged', () => {
    const before = sampler(b).sample(2, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
    const sa = sampler(a);
    for (let i = 0; i < 10; i++) sa.sample(i, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
    const after = sampler(b).sample(2, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
    expect(canonicalJson(after)).toBe(canonicalJson(before));
  });

  it('re-pitting a block uses draw index k + 1 (a fresh draw, reproducible)', () => {
    const s = sampler(a);
    const first = s.sample(4, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
    const second = s.sample(4, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22 });
    const again = sampler(a).sample(4, 'excavatorPit', { volumeBcy: 5, machineReachFt: 22, k: 1 });
    expect(second.recoveredMg).not.toBe(first.recoveredMg);
    expect(canonicalJson({ ...again, id: second.id })).toBe(canonicalJson(second));
  });
});

describe('censoring and false bedrock (§4.6, §4.22)', () => {
  it('adds the censored-depth pseudo-observation only when P50(D) < 1.10·h', () => {
    const outcomes = { added: 0, skipped: 0 };
    for (const claim of northCreek.slice(0, 8)) {
      const priors = claimPriors(world, claim.id, 'held');
      const prior = statisticalEstimate(priors, emptyEvidence(claim.id), h.params).stat;
      const n = claim.nAlong * claim.nAcross;
      for (let i = 0; i < n; i++) {
        const d50 = Math.exp(prior.geo.D.mean[i] as number);
        for (const reach of [0.6 * d50, 0.95 * d50]) {
          const rec = sampler(claim).sample(i, 'excavatorPit', { volumeBcy: 5, machineReachFt: reach });
          if (rec.interval !== 'overburdenOnly') continue;
          const { stat } = statisticalEstimate(priors, evidenceOf(claim.id, [rec]), h.params);
          const expectAdded = d50 < h.params.censorTrigger * rec.depthReachedFt;
          expect(stat.geo.censored).toBe(expectAdded ? 1 : 0);
          outcomes[expectAdded ? 'added' : 'skipped']++;
        }
      }
    }
    expect(outcomes.added).toBeGreaterThan(0);
    expect(outcomes.skipped).toBeGreaterThan(0);
  });

  it('flags the shallower of two conflicting bedrock contacts on a block', () => {
    for (const claim of northCreek) {
      const s = sampler(claim);
      const n = claim.nAlong * claim.nAcross;
      let deep: SampleRecord | null = null;
      for (let i = 0; i < n && deep === null; i++) {
        const r = s.sample(i, 'excavatorPit', { volumeBcy: 5, machineReachFt: 40 });
        if (r.interval === 'fullColumn' && (r.observed.depthToBedrockFt ?? 0) > 8) deep = r;
      }
      if (deep === null) continue;
      const d = deep.observed.depthToBedrockFt as number;
      const shallow: SampleRecord = {
        ...deep,
        id: formatId('smp', 999) as SampleId,
        observed: { ...deep.observed, depthToBedrockFt: 0.6 * d },
      };
      const model = priorModel(claimPriors(world, claim.id, 'held'), h.params);
      const prepared = prepareSamples(model, [deep, shallow], true, h.params);
      const ps = prepared.find((p) => p.rec.id === shallow.id);
      const pd = prepared.find((p) => p.rec.id === deep?.id);
      expect(ps?.suspectFalseBedrock).toBe(true);
      expect(ps?.interval).toBe('upperPay');
      expect(pd?.suspectFalseBedrock).toBe(false);
      // Without a geologist on the claim nobody checks.
      expect(prepareSamples(model, [deep, shallow], false, h.params).some((p) => p.suspectFalseBedrock)).toBe(false);
      return;
    }
    throw new Error('no claim with a bedrock pit deeper than 8 ft');
  });
});

describe('pockets (§4.4.5, §4.22)', () => {
  const claim = northCreek[1] as Claim;
  const priors = claimPriors(world, claim.id, 'held');

  it('the pocket term is 0 with pPerStreakBlock 0', () => {
    const noPockets: ClaimPriors = { ...priors, pocket: { ...priors.pocket, pPerStreakBlock: 0 } };
    const e = estimateFromEvidence(noPockets, emptyEvidence(claim.id), planningFor(h, noPockets), h.ctx);
    expect(e.claim.pocketUpsideOzMean).toBe(0);
    const withPockets = estimateFromEvidence(priors, emptyEvidence(claim.id), planningFor(h, priors), h.ctx);
    expect(withPockets.claim.pocketUpsideOzMean).toBeGreaterThan(0);
  });

  it('a sonic hole with one coarse particle and normal non-coarse grade is never a pocket hit', () => {
    const s = sampler(claim);
    const n = claim.nAlong * claim.nAcross;
    let tried = 0;
    for (let i = 0; i < n; i++) {
      const r = s.sample(i, 'sonic');
      if (r.interval !== 'fullColumn') continue;
      const nugget: SampleRecord = {
        ...r,
        colours: { ...r.colours, coarse: 1 },
        recoveredMg: r.recoveredMg + priors.coarseMeanMg,
      };
      const { stat } = statisticalEstimate(priors, evidenceOf(claim.id, [nugget]), h.params);
      expect(Array.from(stat.confirmedOz).every((x) => x === 0)).toBe(true);
      tried++;
    }
    expect(tried).toBeGreaterThan(0);
  });
});

describe('§4 keys never reach the generator (world hash)', () => {
  it('perturbing every §4 estimator key leaves the generated world bit-identical', () => {
    const perturbed: Record<string, unknown> = { ...baseTuning };
    for (const key of Object.keys(baseTuning)) {
      if (!key.startsWith('geology.est') && !key.startsWith('geology.records') && !key.startsWith('geology.conf')) continue;
      if (key.startsWith('geology.records.')) continue; // §3's public-record keys (dotted) belong to the generator
      const v = (baseTuning as Record<string, unknown>)[key];
      if (typeof v === 'number') perturbed[key] = v * 1.37 + 0.011;
    }
    const tuned = perturbed as unknown as TuningResolved;
    for (const seed of ['4022', '771']) {
      expect(hashValue(generateWorld(seed, OPTS, tuned))).toBe(hashValue(generateWorld(seed, OPTS, baseTuning)));
    }
  });
});

export type { BlockId };
