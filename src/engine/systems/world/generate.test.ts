// generateWorld (DESIGN §3.1–§3.6): determinism, stream isolation, id invariants, block properties, environmental
// and record rules, slice size and generation time (§3.18).
import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningResolved } from '../../../data/tuning';
import { canonicalJson, hashValue } from '../../core/hash';
import { formatId, parseId, type BlockId, type ClaimId } from '../../core/ids';
import { rng } from '../../core/rng';
import { generateWorld, worldIdCounters } from './generate';
import type { GenCreek, GenDistrict } from './genTypes';
import { claimTruth, blockCoords } from './query';
import { genCreekHistory, recordsQuality } from './records';
import { regionTemplates } from '../../../data/regions';
import { revealTruth } from './reveal';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import { lowFlowGpm } from './water';
import type { BlockTruth, Claim, ClaimTruth, WorldSlice } from './types';

const TWO = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
const gen = (seed: string, t: TuningResolved = baseTuning): WorldSlice => generateWorld(seed, TWO, t);

const SAMPLE: readonly WorldSlice[] = Array.from({ length: 16 }, (_, i) => gen(`world-test-${i}`));

function claims(w: WorldSlice): Claim[] {
  return w.claimIds.map((id) => w.claims[id] as Claim);
}

function districtSlice(w: WorldSlice, index: number): unknown {
  const did = w.districtIds[index];
  if (did === undefined) throw new Error('no district');
  const d = w.districts[did];
  if (d === undefined) throw new Error('no district');
  return {
    d,
    creeks: d.creekIds.map((c) => w.creeks[c]),
    claims: d.claimIds.map((c) => w.claims[c]),
    states: d.claimIds.flatMap((c) => {
      const k = w.claims[c] as Claim;
      return Array.from(
        { length: k.nAlong * k.nAcross },
        (_, i) => w.blockStates[formatId('blk', k.blockIdBase + i)] ?? null,
      );
    }),
    holders: d.claimIds.map((c) => {
      const h = w.claims[c]?.holderId;
      return typeof h === 'string' && h.startsWith('hld_') ? w.holders[h as keyof WorldSlice['holders']] : null;
    }),
  };
}

describe('determinism and stream isolation (§3.1, §3.18)', () => {
  it('gives an identical world for the same seed and a different one for another seed', () => {
    const a = gen('det-seed');
    const b = gen('det-seed');
    expect(hashValue(a)).toBe(hashValue(b));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(hashValue(gen('det-seed-2'))).not.toBe(hashValue(a));
  });

  it('leaves earlier districts identical when a district is added', () => {
    const one = generateWorld('iso-seed', { districtCount: 1, templateIds: ['northernFederal'] }, baseTuning);
    const two = gen('iso-seed');
    expect(canonicalJson(districtSlice(one, 0))).toBe(canonicalJson(districtSlice(two, 0)));
  });

  it('leaves every truth pack unchanged when record, drill, water-right or supply draws are retuned', () => {
    const base = gen('iso-seed-2');
    const variants: Partial<TuningResolved>[] = [
      { 'geology.records.priorDrillP': 0.9, 'geology.records.creekProdLogSd': 1.2 },
      { 'geology.water.rightStubP': { subarctic: 0.9, arid: 0.9 } },
      { 'geology.supply.baseListHazard': 0.06 },
      { 'geology.seller.honestyMix': { accurate: 0.1, optimistic: 0.1, cherryPicked: 0.1, fraudulent: 0.7 } },
    ];
    for (const v of variants) {
      const w = gen('iso-seed-2', { ...baseTuning, ...v } as TuningResolved);
      for (const id of base.claimIds) {
        expect(w.claims[id]?.hidden.truthPack).toBe(base.claims[id]?.hidden.truthPack);
        expect(w.claims[id]?.status).toBe(base.claims[id]?.status);
      }
    }
    // A record retune changes no water field; a water-right retune changes no record.
    const rec = gen('iso-seed-2', { ...baseTuning, 'geology.records.priorDrillP': 0.9 });
    const wat = gen('iso-seed-2', { ...baseTuning, 'geology.water.rightStubP': { subarctic: 0.9, arid: 0.9 } });
    for (const id of base.claimIds) {
      expect(rec.claims[id]?.water).toEqual(base.claims[id]?.water);
      expect(wat.claims[id]?.hidden.publicRecord).toEqual(base.claims[id]?.hidden.publicRecord);
      const bw = base.claims[id]?.water;
      const ww = wat.claims[id]?.water;
      expect(ww?.baseGpm).toBe(bw?.baseGpm);
      expect(ww?.hidden).toEqual(bw?.hidden);
    }
  });

  it('does not depend on difficulty: truth is identical at every difficulty (D-3.18)', () => {
    const hashes = (['easy', 'standard', 'hard'] as const).map((difficulty) => {
      const w = newGame(defaultNewGameSetup({ companyName: 'Truth Test', difficulty }), 'diff-seed').world;
      return w.claimIds.map((id) => w.claims[id]?.hidden.truthHash).join(',');
    });
    expect(hashes[1]).toBe(hashes[0]);
    expect(hashes[2]).toBe(hashes[0]);
  });
});

describe('ids and structure (§2.4, §3.1)', () => {
  it('mints contiguous ids in claim order and records every collection in sorted id order', () => {
    for (const w of SAMPLE.slice(0, 4)) {
      expect(w.districtIds).toEqual(Object.keys(w.districts).sort());
      expect(w.claimIds).toEqual(Object.keys(w.claims).sort());
      let nextBlock = 1;
      for (const c of claims(w)) {
        expect(c.blockIdBase).toBe(nextBlock);
        nextBlock += c.nAlong * c.nAcross;
        expect(c.nAlong * c.nAcross).toBe(c.acres);
      }
      const counters = worldIdCounters(w);
      expect(counters['blk']).toBe(nextBlock - 1);
      expect(counters['clm']).toBe(w.claimIds.length);
      expect(counters['crk']).toBe(Object.keys(w.creeks).length);
      expect(counters['hld']).toBe(Object.keys(w.holders).length);
      for (const key of Object.keys(w.blockStates)) {
        const co = blockCoords(w, key as BlockId);
        expect(formatId('blk', (w.claims[co.claimId] as Claim).blockIdBase + co.blockIdx)).toBe(key);
      }
      for (const c of claims(w)) {
        expect(parseId(c.id)?.prefix).toBe('clm');
        if (c.status === 'heldNpc') {
          const h = w.holders[c.holderId as keyof WorldSlice['holders']];
          expect(h?.claimIds).toContain(c.id);
        } else {
          expect(c.holderId).toBeNull();
        }
      }
      // The world never exceeds the per-district target or the world cap.
      expect(w.claimIds.length).toBeLessThanOrEqual(320);
      for (const d of w.districtIds) expect(w.districts[d]?.claimIds.length ?? 0).toBeLessThanOrEqual(80);
    }
  });

  it('maps blockCoords back to (claim, i, j) with i along the valley', () => {
    const w = SAMPLE[0] as WorldSlice;
    const c = w.claims[w.claimIds[3] as ClaimId] as Claim;
    const co = blockCoords(w, formatId('blk', c.blockIdBase + c.nAcross + 1));
    expect(co).toEqual({ claimId: c.id, blockIdx: c.nAcross + 1, i: 1, j: 1 });
    expect(() => blockCoords(w, formatId('blk', 10_000_000))).toThrow();
  });

  it('reserves a three-parcel family run of 20-ac valley parcels in the northern district (§3.4)', () => {
    for (const w of SAMPLE) {
      expect(w.familyRunClaimIds).toHaveLength(3);
      const run = w.familyRunClaimIds.map((id) => w.claims[id] as Claim);
      for (const k of run) {
        expect(k.acres).toBe(20);
        expect(k.setting).toBe('valleyBottom');
        expect(k.hidden.depositType).toBe('creek');
        expect(w.districts[k.districtId]?.templateId).toBe('northernFederal');
      }
      expect(run[1]?.geometry.rowStart).toBe((run[0]?.geometry.rowStart ?? 0) + 5);
      expect(run[2]?.geometry.rowStart).toBe((run[1]?.geometry.rowStart ?? 0) + 5);
    }
  });
});

describe('block truth properties (§3.18)', () => {
  it('holds for every block of the sample worlds', () => {
    for (const w of SAMPLE.slice(0, 6)) {
      for (const id of w.claimIds) {
        const t: ClaimTruth = claimTruth(w, id);
        for (const b of t.blocks as readonly BlockTruth[]) {
          const s = b.sizeMix.coarse + b.sizeMix.medium + b.sizeMix.fine + b.sizeMix.ultrafine;
          expect(Math.abs(s - 1)).toBeLessThan(1e-6);
          expect(b.fineness).toBeGreaterThanOrEqual(0.7 - 1e-9);
          expect(b.fineness).toBeLessThanOrEqual(0.92 + 1e-9);
          expect(b.overburdenFt).toBeGreaterThanOrEqual(0);
          expect(b.payThicknessFt).toBeGreaterThanOrEqual(1);
          expect(b.payThicknessFt).toBeLessThanOrEqual(15);
          expect(b.minedOutFraction).toBeGreaterThanOrEqual(0);
          expect(b.minedOutFraction).toBeLessThan(0.95);
          // Quantized independently (0.03% grade steps, 1/65,535 fractions): equal to within 0.1%.
          const want = b.virginGradeOzPerBcy * (1 - b.minedOutFraction);
          if (want > 1e-6) expect(Math.abs(b.gradeOzPerBcy / want - 1)).toBeLessThan(1e-3);
          expect(b.coarseMeanMg).toBe(t.coarseMeanMg);
        }
      }
    }
  });
});

describe('status, environment and water (§3.3.4, §3.4, §3.4.1)', () => {
  it('lays exactly one channel column per valley parcel and none on benches', () => {
    for (const w of SAMPLE) {
      for (const c of claims(w)) {
        const cols = new Set<number>();
        for (let k = 0; k < c.env.surfaceCodes.length; k++) if (c.env.surfaceCodes[k] === 'c') cols.add(k % c.nAcross);
        expect(c.env.surfaceCodes).toHaveLength(c.nAlong * c.nAcross);
        if (c.setting === 'bench') expect(cols.size).toBe(0);
        else {
          expect(cols.size).toBe(1);
          for (let i = 0; i < c.nAlong; i++) expect(c.env.surfaceCodes[i * c.nAcross + [...cols][0]!]).toBe('c');
        }
      }
    }
  });

  it('keeps held parcels inside a withdrawal valid but special-status, and closes the open ones', () => {
    let held = 0;
    let withdrawn = 0;
    for (const w of SAMPLE) {
      for (const d of w.districtIds) {
        const dist = w.districts[d];
        for (const o of dist?.overlays ?? []) {
          if (o.kind !== 'withdrawn') continue;
          for (const id of dist?.claimIds ?? []) {
            const c = w.claims[id] as Claim;
            const inside =
              c.creekId === o.creekId &&
              c.geometry.rowStart <= o.rowTo &&
              o.rowFrom <= c.geometry.rowStart + c.nAlong - 1;
            if (!inside) continue;
            expect(c.env.specialStatus).toBe(true);
            expect(['heldNpc', 'withdrawn']).toContain(c.status);
            if (c.status === 'heldNpc') held++;
            else withdrawn++;
          }
        }
      }
      for (const c of claims(w)) if (c.status === 'withdrawn') expect(c.env.specialStatus).toBe(true);
    }
    expect(held).toBeGreaterThan(0);
    expect(withdrawn).toBeGreaterThan(0);
  });

  it('records senior water rights only on held recent-operator ground, surface rights within the low flow', () => {
    let rights = 0;
    for (const w of SAMPLE) {
      for (const c of claims(w)) {
        const r = c.water.rightStub;
        if (r === undefined) continue;
        rights++;
        expect(c.status).toBe('heldNpc');
        expect(c.hidden.oldTimerKind).toBe('recentCat');
        if (r.source === 'surface') expect(r.gpm).toBeLessThanOrEqual(lowFlowGpm(c.water, w.genParams) + 0.05);
        if (c.water.sourceKind === 'none') expect(r.source).toBe('groundwater');
      }
    }
    expect(rights).toBeGreaterThan(0);
  });

  it('scales records quality on fly-in claims: north 0.8 × 0.5 = 0.40', () => {
    let seen = 0;
    for (const w of SAMPLE) {
      for (const c of claims(w)) {
        const tpl = w.districts[c.districtId]?.templateId;
        if (tpl === 'northernFederal' && c.access === 'flyIn') {
          expect(recordsQuality(w, c.id)).toBeCloseTo(0.4, 12);
          seen++;
        }
        if (tpl === 'aridFederal') expect(recordsQuality(w, c.id)).toBeCloseTo(0.7, 12);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('public records (§3.6)', () => {
  it('puts old drill logs on 0.10 ± 0.02 of claims with 3–8 holes, and changes no block state for them', () => {
    let n = 0;
    let withDrill = 0;
    for (const w of SAMPLE) {
      for (const c of claims(w)) {
        n++;
        const d = c.hidden.publicRecord.priorDrill;
        if (d === null) continue;
        withDrill++;
        expect(d.length).toBeGreaterThanOrEqual(3);
        expect(d.length).toBeLessThanOrEqual(8);
        for (const h of d) expect(h.year).toBeGreaterThanOrEqual(1935);
      }
      const nd = gen(`world-test-${SAMPLE.indexOf(w)}`, { ...baseTuning, 'geology.records.priorDrillP': 0 });
      expect(nd.blockStates).toEqual(w.blockStates);
    }
    expect(Math.abs(withDrill / n - 0.1)).toBeLessThan(0.02);
  });

  it('has no creek history on barren creeks or creeks without historic workings', () => {
    for (const w of SAMPLE) {
      for (const cr of Object.values(w.creeks)) {
        if (!cr.hidden.goldBearing) expect(cr.hidden.history).toBeNull();
        const worked = claims(w).some(
          (c) =>
            c.creekId === cr.id &&
            ['handCut', 'drift', 'dredge', 'dryWash', 'hydraulic'].includes(c.hidden.oldTimerKind) &&
            claimTruth(w, c.id).blocks.some((b) => b.minedOutFraction > 0),
        );
        if (!worked) expect(cr.hidden.history).toBeNull();
        if (cr.hidden.history !== null) expect(cr.hidden.history.histBcy).toBeGreaterThan(0);
      }
    }
  });

  it('draws historic production as yards × 2.5 × the creek median grade × LN(1, 0.5) (D-3.39)', () => {
    const tpl = regionTemplates.northernFederal;
    const gp = SAMPLE[0]?.genParams as WorldSlice['genParams'];
    const t = claimTruth(SAMPLE[0] as WorldSlice, (SAMPLE[0] as WorldSlice).claimIds[0] as ClaimId);
    const worked: ClaimTruth = { ...t, blocks: t.blocks.map((b) => ({ ...b, minedOutFraction: 0.5 })) };
    const d = { tpl, gradeFactor: 1.3 } as unknown as GenDistrict;
    const c = { goldBearing: true, gradeFactor: 0.8 } as unknown as GenCreek;
    const logs: number[] = [];
    for (let k = 0; k < 2000; k++) {
      const h = genCreekHistory(
        rng('hist', 'world', 'creekHist', k),
        c,
        d,
        [{ kind: 'handCut', era: [1900, 1920], truth: worked }],
        gp,
      );
      if (h === null) throw new Error('no history');
      logs.push(Math.log(h.histOz / (h.histBcy * 2.5 * tpl.gMed * 1.3 * 0.8)));
    }
    const mean = logs.reduce((a, x) => a + x, 0) / logs.length;
    const sd = Math.sqrt(logs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / logs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(sd - 0.5)).toBeLessThan(0.03);
  });
});

describe('creek richness carries across claim boundaries (§3.18)', () => {
  it('correlates claim-mean ln-grade of adjacent valley claims on the same creek above 0.3', () => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const w of SAMPLE) {
      const lnMean = (id: ClaimId): number => {
        const bs = claimTruth(w, id).blocks;
        return bs.reduce((a, b) => a + Math.log(b.virginGradeOzPerBcy), 0) / bs.length;
      };
      for (const c of claims(w)) {
        if (c.setting === 'bench') continue;
        for (const other of c.env.adjacentClaimIds) {
          const o = w.claims[other] as Claim;
          if (o.setting === 'bench' || o.creekId !== c.creekId || other < c.id) continue;
          xs.push(lnMean(c.id));
          ys.push(lnMean(other));
        }
      }
    }
    const mx = xs.reduce((a, x) => a + x, 0) / xs.length;
    const my = ys.reduce((a, x) => a + x, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    xs.forEach((x, i) => {
      const y = ys[i] as number;
      sxy += (x - mx) * (y - my);
      sxx += (x - mx) * (x - mx);
      syy += (y - my) * (y - my);
    });
    expect(xs.length).toBeGreaterThan(200);
    expect(sxy / Math.sqrt(sxx * syy)).toBeGreaterThan(0.3);
  });
});

describe('the dev reveal (§3.12 debug/revealTruth)', () => {
  it('is pure and reproduces the stored class from truth and the pre-game block states', () => {
    const w = SAMPLE[1] as WorldSlice;
    const before = canonicalJson(w);
    for (const id of w.claimIds) {
      const r = revealTruth(w, id);
      expect(r.econ.econClass).toBe(w.claims[id]?.hidden.econClass);
      expect(r.truth.blocks).toHaveLength(r.blockStates.length);
    }
    expect(canonicalJson(w)).toBe(before);
  });
});

describe('budgets (§3.18 performance, §2.13)', () => {
  it('keeps a two-district world inside the 1,000 kB world slice budget and generates it in < 1.5 s', () => {
    const t0 = performance.now();
    const w = gen('budget-seed');
    const ms = performance.now() - t0;
    const kb = canonicalJson(w).length / 1024;
    expect(kb).toBeLessThan(1000);
    expect(ms).toBeLessThan(1500);
    // Packed truth ≈ 0.3 MB for a P1 world (§3.1).
    const packKb = w.claimIds.reduce((a, id) => a + (w.claims[id]?.hidden.truthPack.length ?? 0), 0) / 1024;
    expect(packKb).toBeLessThan(400);
  });
});
