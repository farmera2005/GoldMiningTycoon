// DESIGN §3.1 truth packing (D-3.1, D-3.32) and §3.18's packing round-trip tests.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import type { ClaimId } from '../../core/ids';
import { generateWorld } from './generate';
import {
  base64ToBytes,
  bytesToBase64,
  decodeClaimTruth,
  packTruth,
  quant,
  quantizeMix,
  truthHashOf,
  unpackTruth,
} from './pack';
import { claimTruth } from './query';
import type { BedrockType, BlockTruth } from './types';

const BEDROCK: readonly BedrockType[] = [
  'schist',
  'slatePhyllite',
  'granite',
  'basaltVolcanic',
  'clayFalse',
  'karstLimestone',
];

const blockArb: fc.Arbitrary<BlockTruth> = fc
  .record({
    ob: fc.double({ min: 0, max: 120, noNaN: true }),
    t: fc.double({ min: 1, max: 15, noNaN: true }),
    bc: fc.double({ min: 0.2, max: 3.6, noNaN: true }),
    g: fc.double({ min: 1e-7, max: 2, noNaN: true }),
    x: fc.double({ min: 0, max: 0.92, noNaN: true }),
    mix: fc.tuple(
      fc.double({ min: 0.001, max: 1, noNaN: true }),
      fc.double({ min: 0.001, max: 1, noNaN: true }),
      fc.double({ min: 0.001, max: 1, noNaN: true }),
      fc.double({ min: 0.001, max: 1, noNaN: true }),
    ),
    fin: fc.double({ min: 0.7, max: 0.92, noNaN: true }),
    frac: fc.tuple(
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 0.5, noNaN: true }),
    ),
    decay: fc.double({ min: 0.5, max: 12, noNaN: true }),
    br: fc.integer({ min: 0, max: BEDROCK.length - 1 }),
    pocket: fc.option(
      fc.record({ bcy: fc.integer({ min: 150, max: 3000 }), g: fc.double({ min: 0.15, max: 2, noNaN: true }) }),
      {
        nil: undefined,
      },
    ),
    pile: fc.option(
      fc.record({ bcy: fc.integer({ min: 100, max: 30000 }), g: fc.double({ min: 1e-5, max: 0.1, noNaN: true }) }),
      {
        nil: undefined,
      },
    ),
  })
  .map((r) => {
    const s = r.mix[0] + r.mix[1] + r.mix[2] + r.mix[3];
    const bt: { -readonly [K in keyof BlockTruth]: BlockTruth[K] } = {
      overburdenFt: r.ob,
      payThicknessFt: r.t,
      bedrockCleanupFt: r.bc,
      gradeOzPerBcy: r.g * (1 - r.x),
      virginGradeOzPerBcy: r.g,
      sizeMix: { coarse: r.mix[0] / s, medium: r.mix[1] / s, fine: r.mix[2] / s, ultrafine: r.mix[3] / s },
      coarseMeanMg: 150,
      fineness: r.fin,
      permafrost: r.frac[0],
      clay: r.frac[1],
      boulders: r.frac[2],
      cementation: r.frac[3],
      bedrockType: BEDROCK[r.br] as BedrockType,
      bedrockGoldShare: r.frac[5],
      verticalDecayFt: r.decay,
      paystreakFraction: r.frac[4],
      minedOutFraction: r.x,
    };
    if (r.pocket !== undefined) bt.pocket = { bcy: r.pocket.bcy, gradeOzPerBcy: r.pocket.g };
    if (r.pile !== undefined) {
      bt.oldTailings = {
        bcy: r.pile.bcy,
        gradeOzPerBcy: r.pile.g,
        sizeMix: { coarse: 0.05, medium: 0.2, fine: 0.45, ultrafine: 0.3 },
      };
    }
    return bt;
  });

const rel = (a: number, b: number): number => Math.abs(a - b) / Math.abs(b);

describe('packTruth / unpackTruth (§3.1)', () => {
  it('decode(pack(T)) is canonical: packing the decoded truth gives the same string', () => {
    fc.assert(
      fc.property(
        fc.array(blockArb, { minLength: 1, maxLength: 40 }),
        fc.double({ min: 1, max: 900, noNaN: true }),
        (blocks, coarse) => {
          const p1 = packTruth(blocks, coarse);
          const d1 = unpackTruth(p1);
          const p2 = packTruth(d1.blocks, d1.coarseMeanMg);
          expect(p2).toBe(p1);
          expect(unpackTruth(p2)).toEqual(d1);
        },
      ),
      { seed: 3101, numRuns: 150 },
    );
  });

  it('keeps every value inside its quantization step', () => {
    fc.assert(
      fc.property(fc.array(blockArb, { minLength: 1, maxLength: 20 }), (blocks) => {
        const d = unpackTruth(packTruth(blocks, 150)).blocks;
        blocks.forEach((b, i) => {
          const q = d[i] as BlockTruth;
          expect(Math.abs(q.overburdenFt - b.overburdenFt)).toBeLessThanOrEqual(0.005 + 1e-12);
          expect(Math.abs(q.payThicknessFt - b.payThicknessFt)).toBeLessThanOrEqual(0.005 + 1e-12);
          // Grades: 0.03% relative steps (half a step of error).
          expect(rel(q.virginGradeOzPerBcy, b.virginGradeOzPerBcy)).toBeLessThan(0.0003);
          if (b.gradeOzPerBcy > 1e-7) expect(rel(q.gradeOzPerBcy, b.gradeOzPerBcy)).toBeLessThan(0.0003);
          expect(Math.abs(q.fineness - b.fineness)).toBeLessThan(1e-5);
          expect(Math.abs(q.permafrost - b.permafrost)).toBeLessThan(1e-5);
          expect(Math.abs(q.verticalDecayFt - b.verticalDecayFt)).toBeLessThanOrEqual(0.0005 + 1e-12);
          expect(q.bedrockType).toBe(b.bedrockType);
          const s = q.sizeMix.coarse + q.sizeMix.medium + q.sizeMix.fine + q.sizeMix.ultrafine;
          expect(Math.abs(s - 1)).toBeLessThan(1e-12);
          expect(Math.abs(q.sizeMix.coarse - b.sizeMix.coarse)).toBeLessThan(2e-5);
          expect(q.pocket === undefined).toBe(b.pocket === undefined);
          expect(q.oldTailings === undefined).toBe(b.oldTailings === undefined);
        });
      }),
      { seed: 3102, numRuns: 100 },
    );
  });

  it('decodes grade 0 as 1e-7 and round-trips coarseMeanMg to 0.1 mg', () => {
    expect(quant.gradeOf(quant.grade(0))).toBe(1e-7);
    expect(quant.grade(0)).toBe(0);
    const d = unpackTruth(packTruth([], 152.34));
    expect(d.coarseMeanMg).toBeCloseTo(152.3, 12);
    expect(d.blocks).toEqual([]);
    // 15 oz/bcy is the top of the grade range.
    expect(quant.grade(15)).toBeLessThanOrEqual(65535);
    expect(rel(quant.gradeOf(quant.grade(15)), 15)).toBeLessThan(0.0003);
  });

  it('quantizes a size mix to integers summing to 65,535 and is idempotent', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0.001, max: 1, noNaN: true }),
        ),
        (m) => {
          const q = quantizeMix(m);
          expect(q[0] + q[1] + q[2] + q[3]).toBe(65535);
          const back = q.map((x) => x / 65535) as [number, number, number, number];
          expect(quantizeMix(back)).toEqual(q);
        },
      ),
      { seed: 3103, numRuns: 300 },
    );
  });

  it('rejects damaged packs', () => {
    const p = packTruth([], 100);
    expect(() => unpackTruth(p.slice(0, -4))).toThrow();
    expect(() => unpackTruth('AAA')).toThrow();
    expect(() => unpackTruth(packTruth([], 100).replace('A', '*'))).toThrow();
  });
});

describe('base64', () => {
  it('round-trips any bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 200 }), (bytes) => {
        expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
      }),
      { seed: 3104, numRuns: 300 },
    );
  });
  it('matches RFC 4648 vectors', () => {
    const enc = (s: string): string => bytesToBase64(new Uint8Array([...s].map((c) => c.charCodeAt(0))));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg==');
    expect(enc('fo')).toBe('Zm8=');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('foobar')).toBe('Zm9vYmFy');
  });
});

describe('the decode cache (D-3.32)', () => {
  it('is keyed by (claimId, truthHash): two worlds from one seed under different tuning never cross', () => {
    const opts = { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] } as const;
    const a = generateWorld('cache-seed', opts, baseTuning);
    // A key generation never reads (supply hazard) leaves every truth pack unchanged.
    const b = generateWorld('cache-seed', opts, { ...baseTuning, 'geology.supply.baseListHazard': 0.05 });
    const tuned = generateWorld('cache-seed', opts, {
      ...baseTuning,
      'geology.grade.pocketMult': { median: 30, sigma: 0.5 },
    });
    const id = a.claimIds.find((k) => {
      const ta = a.claims[k]?.hidden.truthHash;
      return ta !== undefined && ta !== tuned.claims[k]?.hidden.truthHash;
    }) as ClaimId;
    expect(id).toBeDefined();
    const ta = claimTruth(a, id);
    const tt = claimTruth(tuned, id);
    expect(ta.truthHash).not.toBe(tt.truthHash);
    expect(ta).not.toEqual(tt);
    // The cache returns each world's own truth, in either order.
    expect(claimTruth(tuned, id)).toBe(tt);
    expect(claimTruth(a, id)).toBe(ta);
    expect(b.claims[id]?.hidden.truthHash).toBe(a.claims[id]?.hidden.truthHash);
    expect(claimTruth(b, id)).toBe(ta);
  });

  it('returns frozen truth equal to a cold decode, and the hash is the pack’s FNV-1a', () => {
    const w = generateWorld('cache-seed-2', { districtCount: 1, templateIds: ['northernFederal'] }, baseTuning);
    const id = w.claimIds[0] as ClaimId;
    const k = w.claims[id];
    if (k === undefined) throw new Error('no claim');
    expect(k.hidden.truthHash).toBe(truthHashOf(k.hidden.truthPack));
    const t = decodeClaimTruth(id, k.hidden.truthPack, k.hidden.truthHash);
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.blocks[0])).toBe(true);
    const cold = unpackTruth(k.hidden.truthPack);
    expect(t.blocks).toEqual(cold.blocks);
    expect(t.coarseMeanMg).toBe(cold.coarseMeanMg);
  });
});
