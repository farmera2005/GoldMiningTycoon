// DESIGN §4.4.6 production reconciliation, pure core: the worked example (y_A = ln 0.01144, y_B = ln 0.00872), pile
// subtraction (s04 #3), the audit swap of the capture term, the stored sieved masses and the row variances.
import { describe, expect, it } from 'vitest';
import { log } from '../../core/dmath';
import type { BlockId, ClaimId, SampleId } from '../../core/ids';
import { MG_PER_OZ } from '../world/constants';
import {
  auditChainRatio,
  MIN_ATTRIBUTED_OZ,
  prepareProduction,
  productionEvidenceOf,
  productionObservation,
  productionRecords,
  PROD_WEIGH_CV,
  type CleanupResult,
} from './production';
import type { SampleRecord } from './types';

const A = 'blk_000101' as BlockId;
const B = 'blk_000102' as BlockId;
const CLAIM = 'clm_000007' as ClaimId;
const P = { prodAttribLogSdOne: 0.08, prodAttribLogSdSeveral: 0.2, prodRecoveryLogSd: 0.1 };
const mix = { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 };
const cap = { coarse: 0.95, medium: 0.88, fine: 0.62, ultrafine: 0.25 };
const grl = { coarse: 0.01, medium: 0.01, fine: 0.01, ultrafine: 0.01 };

/** The §4.4.6 worked cleanup: 38.2 raw oz from A (3,000 in-situ bcy, P50 0.0105) and B (2,000, P50 0.0080). */
function workedCleanup(extra: Partial<CleanupResult> = {}): CleanupResult {
  return {
    turn: 30,
    lineId: 'L1',
    purpose: 'production',
    rawOzWeighed: 38.2,
    rawOzBySize: { coarse: 10, medium: 16, fine: 10, ultrafine: 2.2 },
    interestsTaken: [],
    bcyWashedSince: 5600,
    bcyByBlock: { [A]: 3300, [B]: 2300 },
    recoveredGradeOzPerBcy: 38.2 / 5600,
    inSituBcyByBlock: { [A]: 3000, [B]: 2000 },
    pileBcyWashed: 0,
    pileRawOzEst: 0,
    // 0.95 shareTaken × 0.97 (1 − λ) × 0.777 capture × 0.99 gold room ÷ 0.96 (4% dirt) = 0.738
    modeledChainFactor: 0.738,
    modeledChain: {
      miningFactorByBlock: { [A]: 0.95 * 0.97, [B]: 0.95 * 0.97 },
      sizeMixP50: mix,
      captureBySize: cap,
      goldRoomLossBySize: grl,
      estDirtFrac: 0.04,
    },
    foremanEstimateOz: 35.1,
    nominalRecoveryBySize: cap,
    skimOz: 0,
    ...extra,
  };
}

const p50 = (id: BlockId): number | undefined => (id === A ? 0.0105 : id === B ? 0.008 : undefined);

function withIds(drafts: ReturnType<typeof productionRecords>): SampleRecord[] {
  return drafts.map((d, i) => ({ ...d, id: `smp_${String(900 + i).padStart(6, '0')}` as SampleId }));
}

describe('production rows (§4.4.6 worked example)', () => {
  const recs = withIds(productionRecords({ claimId: CLAIM, cleanup: workedCleanup(), gradeP50: p50 }));

  it('attributes by in-situ bcy × P50: A 25.33 oz, B 12.87 oz', () => {
    expect(recs.map((r) => r.blockId)).toEqual([A, B]);
    expect(recs[0]?.production?.ozAttributedWeighed).toBeCloseTo(25.33, 2);
    expect(recs[1]?.production?.ozAttributedWeighed).toBeCloseTo(12.87, 2);
  });

  it('reads y_A = ln 0.01144 and y_B = ln 0.00872, both 9.0% above P50', () => {
    const ya = productionObservation(productionEvidenceOf(recs[0] as SampleRecord)!, P)!;
    const yb = productionObservation(productionEvidenceOf(recs[1] as SampleRecord)!, P)!;
    expect(ya.y).toBeCloseTo(log(0.01144), 3);
    expect(yb.y).toBeCloseTo(log(0.00872), 3);
    expect(ya.y - log(0.0105)).toBeCloseTo(log(1.09), 2);
    expect(yb.y - log(0.008)).toBeCloseTo(ya.y - log(0.0105), 9);
  });

  it('several blocks: v = 0.20² + ln(1 + 0.05²), one block 0.08²; the recovery error is shared (0.10²)', () => {
    const o = productionObservation(productionEvidenceOf(recs[0] as SampleRecord)!, P)!;
    expect(o.v).toBeCloseTo(0.2 * 0.2 + log(1 + PROD_WEIGH_CV * PROD_WEIGH_CV), 12);
    expect(o.shared).toBeCloseTo(0.01, 12);
    const one = withIds(
      productionRecords({
        claimId: CLAIM,
        cleanup: workedCleanup({ inSituBcyByBlock: { [A]: 3000 } }),
        gradeP50: p50,
      }),
    );
    const o1 = productionObservation(productionEvidenceOf(one[0] as SampleRecord)!, P)!;
    expect(o1.v).toBeCloseTo(0.08 * 0.08 + log(1 + PROD_WEIGH_CV * PROD_WEIGH_CV), 12);
    expect(one[0]?.production?.ozAttributedWeighed).toBeCloseTo(38.2, 9);
  });

  it('splits the sieved masses by the same weights, in metal mg', () => {
    const total = recs.reduce((s, r) => s + r.recoveredMg, 0);
    expect(total).toBeCloseTo(38.2 * 0.96 * MG_PER_OZ, -1);
    const a = recs[0]?.massMg;
    expect((a?.coarse ?? 0) / (recs[1]?.massMg?.coarse ?? 1)).toBeCloseTo(25.33 / 12.87, 2);
    const ev = productionEvidenceOf(recs[0] as SampleRecord)!;
    expect(ev.captureBySize.coarse).toBeCloseTo(0.95 * 0.97 * 0.95 * 0.99, 9);
    expect(ev.blocksInCleanup).toBe(2);
    expect(ev.lineId).toBe('L1');
  });

  it('subtracts the visible pile estimate before attributing (s04 #3)', () => {
    const r = withIds(
      productionRecords({
        claimId: CLAIM,
        cleanup: workedCleanup({ pileRawOzEst: 5, pileBcyWashed: 400 }),
        gradeP50: p50,
      }),
    );
    const sum = r.reduce((s, x) => s + (x.production?.ozAttributedWeighed ?? 0), 0);
    expect(sum).toBeCloseTo(33.2, 9);
    const mg = r.reduce((s, x) => s + x.recoveredMg, 0);
    expect(mg).toBeCloseTo(33.2 * 0.96 * MG_PER_OZ, -1);
  });

  it('a cleanup with less gold than its pile estimate reads the scale’s resolution, never ln 0', () => {
    const r = withIds(
      productionRecords({
        claimId: CLAIM,
        cleanup: workedCleanup({ rawOzWeighed: 0, pileRawOzEst: 2 }),
        gradeP50: p50,
      }),
    );
    const sum = r.reduce((s, x) => s + (x.production?.ozAttributedWeighed ?? 0), 0);
    expect(sum).toBeCloseTo(MIN_ATTRIBUTED_OZ, 9);
    for (const x of r) expect(Number.isFinite(productionObservation(productionEvidenceOf(x)!, P)!.y)).toBe(true);
  });

  it('a block with no estimate is attributed at the mean of the others', () => {
    const r = withIds(
      productionRecords({
        claimId: CLAIM,
        cleanup: workedCleanup(),
        gradeP50: (id) => (id === A ? 0.0105 : undefined),
      }),
    );
    // Both at 0.0105: shares by in-situ bcy, 3 : 2.
    expect(r[0]?.production?.ozAttributedWeighed).toBeCloseTo(38.2 * 0.6, 9);
  });
});

describe('the audit swap (§4.4.6 "Audit")', () => {
  const audited = { coarse: 0.9, medium: 0.8, fine: 0.5, ultrafine: 0.2 };

  it('changes only the chain, by Σ mix·audited·(1 − loss) / Σ mix·nominal·(1 − loss)', () => {
    const plain = productionRecords({ claimId: CLAIM, cleanup: workedCleanup(), gradeP50: p50 });
    const aud = productionRecords({
      claimId: CLAIM,
      cleanup: workedCleanup({ auditedRecoveryBySize: audited }),
      gradeP50: p50,
    });
    const ratio = auditChainRatio(workedCleanup().modeledChain, audited);
    let num = 0;
    let den = 0;
    for (const s of ['coarse', 'medium', 'fine', 'ultrafine'] as const) {
      num += mix[s] * audited[s];
      den += mix[s] * cap[s];
    }
    // A size-independent gold-room loss: DESIGN's Σ mix·audited / Σ mix·nominal.
    expect(ratio).toBeCloseTo(num / den, 12);
    aud.forEach((a, i) => {
      const p = plain[i];
      expect(a.production?.ozAttributedWeighed).toBe(p?.production?.ozAttributedWeighed);
      expect(a.production?.inSituBcy).toBe(p?.production?.inSituBcy);
      expect(a.production?.audited).toBe(true);
      expect(a.production?.chainFactor).toBeCloseTo((p?.production?.chainFactor ?? 0) * ratio, 8);
    });
  });

  it('no audit: ratio 1', () => {
    expect(auditChainRatio(workedCleanup().modeledChain, undefined)).toBe(1);
  });
});

describe('prepared production rows', () => {
  it('keeps the claim’s complete rows in SampleId order and skips foreign blocks and incomplete rows', () => {
    const recs = withIds(productionRecords({ claimId: CLAIM, cleanup: workedCleanup(), gradeP50: p50 }));
    const incomplete: SampleRecord = {
      ...(recs[0] as SampleRecord),
      id: 'smp_000001' as SampleId,
      production: { cleanupTurn: 1, inSituBcy: 10, ozAttributedWeighed: 1, chainFactor: 0.7, audited: false },
    };
    const prepared = prepareProduction({ [A]: 0 }, [recs[1] as SampleRecord, incomplete, recs[0] as SampleRecord], P);
    expect(prepared.map((p) => p.rec.blockId)).toEqual([A]);
    expect(prepared[0]?.b).toBe(0);
    expect(prepared[0]?.row.blk).toBe(0);
  });
});
