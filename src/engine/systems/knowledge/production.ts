// Production reconciliation (DESIGN §4.4.6, §7.16): §7's cleanup results become per-block production rows of the
// grade posterior. This file holds the §7 → §4 contract shapes §4 reads (contracts.md §4.7: `CleanupResult` verbatim
// §7.16 with `lotId?` and `interestsTaken[].rawMilliOz`), the production row as §4 stores it on the SampleRecord, and
// the pure core of `recordProduction`: attribution, the audit swap of the chain's capture term, and the sieved masses.
// The state mutator (minting sample ids, pushing records) is a thin wrapper over `productionRecords`.
import type { BlockId, ClaimId, LineId, ProgramId } from '../../core/ids';
import { compareIds } from '../../core/ids';
import { sortedKeys } from '../../core/iter';
import { log } from '../../core/dmath';
import { MG_PER_OZ } from '../world/constants';
import type { SizeClass, SizeRecord } from '../world/types';
import type { ProductionCoarse } from './coarse';
import type { ProductionRowInput } from './rows';
import type { ProductionRow, SampleRecord } from './types';
import type { CleanupResult, ModeledChain } from '../ops/types';

const SIZES: readonly SizeClass[] = ['coarse', 'medium', 'fine', 'ultrafine'];

// The §7 → §4 contract shapes are §7's (DESIGN §7.16, ops/types.ts); §4 reads them and re-exports them for its callers.
export type { CleanupResult, ModeledChain } from '../ops/types';

// ---------------------------------------------------------------------------------------------------------------------
// The stored production row (contract delta: SampleRecord.production gains these fields)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * SampleRecord.production as §4 fixes it at recordProduction time (DESIGN §4.4.6 "Fixed at record time"). Beyond the
 * P0 shape it carries the cleanup's line, how many blocks the cleanup was attributed over (the attribution sd is
 * estProdAttribLogSd.oneBlock or .severalBlocks) and the chain's per-class metal capture for the coarse factor and
 * the size mix.
 */
export interface ProductionEvidence extends ProductionRow {
  readonly lineId: LineId;
  readonly blocksInCleanup: number;
  /** Recovered metal ÷ in-situ metal by size class: miningFactor_b × capture_s × (1 − goldRoomLoss_s). */
  readonly captureBySize: SizeRecord;
}

function isSizeRecord(x: unknown): x is SizeRecord {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Partial<Record<SizeClass, unknown>>;
  return SIZES.every((s) => typeof r[s] === 'number');
}

/** The production row of a record, or null when the record is not a complete production row. */
export function productionEvidenceOf(rec: SampleRecord): ProductionEvidence | null {
  if (rec.source !== 'production' || rec.production === undefined) return null;
  const p: ProductionRow & { lineId?: unknown; blocksInCleanup?: unknown; captureBySize?: unknown } = rec.production;
  if (typeof p.blocksInCleanup !== 'number' || typeof p.lineId !== 'string' || !isSizeRecord(p.captureBySize)) {
    return null;
  }
  return { ...p, lineId: p.lineId as LineId, blocksInCleanup: p.blocksInCleanup, captureBySize: p.captureBySize };
}

// ---------------------------------------------------------------------------------------------------------------------
// recordProduction's pure core (DESIGN §4.4.6; s04 #3, #20)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A weighed cleanup can show less than the visible model's pile gold, or nothing at all; the row then reads the
 * scale's resolution (§2.4: weighing floors to 0.001 oz), which says "almost no gold" without a log of zero.
 */
export const MIN_ATTRIBUTED_OZ = 0.001;

export interface RecordProductionInput {
  readonly claimId: ClaimId;
  readonly cleanup: CleanupResult;
  /**
   * Block P50 grades of the estimate in force at the start of step 12, before any of this week's production rows
   * (s04 #20). A block without one (no estimate yet) is attributed at the mean of the others.
   */
  readonly gradeP50: (blockId: BlockId) => number | undefined;
  /** An own-fleet bulk-sample plan's program (§4.12): tags the rows for the bulk-sample support gate. */
  readonly bulkSampleProgramId?: ProgramId;
}

/** A production SampleRecord without its id (the caller mints `smp` ids in the returned order). */
export type ProductionRecordDraft = Omit<SampleRecord, 'id'>;

function round(x: number, step: number): number {
  return Math.round(x / step) * step;
}

/**
 * Σ_s mix_s × cap_s × (1 − goldRoomLoss_s) with an audited capture swapped in: the ratio of the two is the only change
 * an audit makes to the chain (DESIGN §4.4.6 "Audit"; with a size-independent gold-room loss it is DESIGN's
 * Σ mix·auditedCapture / Σ mix·nominalCapture).
 */
export function auditChainRatio(chain: ModeledChain, audited: SizeRecord | undefined): number {
  if (audited === undefined) return 1;
  let num = 0;
  let den = 0;
  for (const s of SIZES) {
    const k = chain.sizeMixP50[s] * (1 - chain.goldRoomLossBySize[s]);
    num += k * audited[s];
    den += k * chain.captureBySize[s];
  }
  return den > 0 && num > 0 ? num / den : 1;
}

/**
 * The cleanup's production rows, one per block with in-situ bcy > 0, in ascending block id (DESIGN §4.4.6):
 * ```
 * net   = max(rawOzWeighed − pileRawOzEst, 0.001)          (s04 #3: pile gold is not in-situ production)
 * oz_b  = net × inSitu_b·gradeP50_b / Σ_j inSitu_j·gradeP50_j
 * chain = modeledChainFactor × audit ratio
 * ```
 * The sieved masses are split by the same weights: metal mg per class = rawOzBySize_s × (net / gross) × (1 − dirt) × K.
 * Everything the posterior reads is fixed here, so re-estimating later never re-attributes an old cleanup.
 */
export function productionRecords(input: RecordProductionInput): ProductionRecordDraft[] {
  const c = input.cleanup;
  const ids = sortedKeys(c.inSituBcyByBlock as Readonly<Record<BlockId, number>>).filter(
    (id) => (c.inSituBcyByBlock[id] ?? 0) > 0,
  );
  if (ids.length === 0) return [];
  const inSitu = ids.map((id) => c.inSituBcyByBlock[id] as number);
  const known = ids.map((id) => input.gradeP50(id));
  let gSum = 0;
  let gN = 0;
  for (const g of known) {
    if (g !== undefined && g > 0) {
      gSum += g;
      gN++;
    }
  }
  const gFill = gN > 0 ? gSum / gN : 1;
  const w = ids.map((_, i) => (inSitu[i] as number) * ((known[i] ?? 0) > 0 ? (known[i] as number) : gFill));
  let wSum = 0;
  for (const x of w) wSum += x;
  const gross = Math.max(0, c.rawOzWeighed);
  const net = Math.max(gross - Math.max(0, c.pileRawOzEst), MIN_ATTRIBUTED_OZ);
  const audited = c.auditedRecoveryBySize !== undefined;
  const chain = c.modeledChainFactor * auditChainRatio(c.modeledChain, c.auditedRecoveryBySize);
  const mc = c.modeledChain;
  const capture = c.auditedRecoveryBySize ?? mc.captureBySize;
  // Mean mining factor implied by the chain, for a block the chain's parts do not list.
  let capMix = 0;
  for (const s of SIZES) capMix += mc.sizeMixP50[s] * mc.captureBySize[s] * (1 - mc.goldRoomLossBySize[s]);
  const mfMean = capMix > 0 ? (c.modeledChainFactor * (1 - mc.estDirtFrac)) / capMix : 1;
  const massScale = gross > 0 ? (net / gross) * (1 - mc.estDirtFrac) * MG_PER_OZ : 0;
  return ids.map((blockId, i) => {
    const share = (w[i] as number) / wSum;
    const oz = net * share;
    const vb = inSitu[i] as number;
    const mf = mc.miningFactorByBlock[blockId] ?? mfMean;
    const capOf = (s: SizeClass): number => round(mf * capture[s] * (1 - mc.goldRoomLossBySize[s]), 1e-9);
    const massOf = (s: SizeClass): number => round(c.rawOzBySize[s] * massScale * share, 0.01);
    const cap: SizeRecord = {
      coarse: capOf('coarse'),
      medium: capOf('medium'),
      fine: capOf('fine'),
      ultrafine: capOf('ultrafine'),
    };
    const massMg: SizeRecord = {
      coarse: massOf('coarse'),
      medium: massOf('medium'),
      fine: massOf('fine'),
      ultrafine: massOf('ultrafine'),
    };
    let recoveredMg = 0;
    let ncInSituMg = 0;
    for (const s of SIZES) {
      recoveredMg += massMg[s];
      if (s !== 'coarse' && cap[s] > 0) ncInSituMg += massMg[s] / cap[s];
    }
    const ozStored = round(oz, 1e-9);
    const chainStored = round(chain, 1e-9);
    const vStored = round(vb, 0.001);
    const production: ProductionEvidence = {
      cleanupTurn: c.turn,
      lineId: c.lineId,
      inSituBcy: vStored,
      ozAttributedWeighed: ozStored,
      chainFactor: chainStored,
      audited,
      blocksInCleanup: ids.length,
      captureBySize: cap,
      ...(input.bulkSampleProgramId !== undefined ? { bulkSampleProgramId: input.bulkSampleProgramId } : {}),
    };
    const head = vStored > 0 && chainStored > 0 ? ozStored / (chainStored * vStored) : 0;
    const draft: ProductionRecordDraft = {
      claimId: input.claimId,
      blockId,
      methodId: 'production',
      ...(input.bulkSampleProgramId !== undefined ? { programId: input.bulkSampleProgramId } : {}),
      drawIndex: 0,
      source: 'production',
      turn: c.turn,
      availableTurn: c.turn,
      production,
      volumeBcy: vStored,
      // The plant washed the whole pay column; nothing was logged (no depths, no colours).
      interval: 'fullColumn',
      bedrockLogged: false,
      depthReachedFt: 0,
      observed: { permafrost: false, waterInflow: false, oldWorkings: false },
      colours: { coarse: 0, medium: 0, fine: 0, ultrafine: 0 },
      massMg,
      recoveredMg: round(recoveredMg, 0.01),
      headGradeOzPerBcy: round(head, 1e-9),
      ncGradeOzPerBcy: vStored > 0 ? round(ncInSituMg / MG_PER_OZ / vStored, 1e-9) : 0,
      loggedBy: { kind: 'none', shownSkill: 0 },
      flags: [],
    };
    return draft;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// The production row of the posterior (DESIGN §4.4.6, §4.5.2)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Weighing and sampling noise of one production row, ln(1 + 0.05²) in DESIGN §4.4.6: the scale and the attribution
 * of washed to in-situ bcy (design delta: a tuning key, `geology.estProdWeighCv`, would make it a lever).
 */
export const PROD_WEIGH_CV = 0.05;

export interface ProductionRowParams {
  readonly prodAttribLogSdOne: number;
  readonly prodAttribLogSdSeveral: number;
  readonly prodRecoveryLogSd: number;
}

/**
 * The row m + e_b (total in-situ grade; no coarse term): y = ln(oz_b / (chain × inSitu_b)),
 * v = estProdAttribLogSd² + ln(1 + 0.05²), sharing the claim's prodRecovery error (variance estProdRecoveryLogSd²).
 */
export function productionObservation(
  p: ProductionEvidence,
  P: ProductionRowParams,
): { readonly y: number; readonly v: number; readonly shared: number } | null {
  if (!(p.inSituBcy > 0) || !(p.chainFactor > 0)) return null;
  // A share rounded to nothing at storage still says "almost no gold" (never a log of zero).
  const oz = Math.max(p.ozAttributedWeighed, 1e-9);
  const a = p.blocksInCleanup > 1 ? P.prodAttribLogSdSeveral : P.prodAttribLogSdOne;
  return {
    y: log(oz / (p.chainFactor * p.inSituBcy)),
    v: a * a + log(1 + PROD_WEIGH_CV * PROD_WEIGH_CV),
    shared: P.prodRecoveryLogSd * P.prodRecoveryLogSd,
  };
}

/**
 * The row's sieved masses for the coarse factor and the size mix (DESIGN §4.4.6 "Coarse factor"): the coarse mass as
 * caught and the capture-corrected (in-situ) non-coarse masses, mg.
 */
export function productionMasses(
  rec: SampleRecord,
  p: ProductionEvidence,
): { readonly coarseMg: number; readonly coarseCap: number; readonly inSituMg: readonly [number, number, number] } {
  const m = rec.massMg ?? { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
  const c = p.captureBySize;
  return {
    coarseMg: m.coarse,
    coarseCap: c.coarse,
    inSituMg: [
      c.medium > 0 ? m.medium / c.medium : 0,
      c.fine > 0 ? m.fine / c.fine : 0,
      c.ultrafine > 0 ? m.ultrafine / c.ultrafine : 0,
    ],
  };
}

/** A production row as the estimator uses it: its block index, posterior row and sieved masses. */
export interface PreparedProduction {
  readonly rec: SampleRecord;
  readonly p: ProductionEvidence;
  readonly b: number;
  readonly row: ProductionRowInput;
  readonly coarse: ProductionCoarse;
  /** Capture-corrected non-coarse metal mg (medium, fine, ultrafine) for the size mix. */
  readonly ncInSituMg: readonly [number, number, number];
}

/** The claim's complete production rows in ascending SampleId order (others and foreign blocks are skipped). */
export function prepareProduction(
  indexOf: Readonly<Partial<Record<BlockId, number>>>,
  records: readonly SampleRecord[],
  P: ProductionRowParams,
): PreparedProduction[] {
  const out: PreparedProduction[] = [];
  const sorted = records.filter((r) => r.source === 'production').sort((a, b) => compareIds(a.id, b.id));
  for (const rec of sorted) {
    const p = productionEvidenceOf(rec);
    if (p === null) continue;
    const b = indexOf[rec.blockId];
    if (b === undefined) continue;
    const o = productionObservation(p, P);
    if (o === null) continue;
    const m = productionMasses(rec, p);
    const nc = m.inSituMg[0] + m.inSituMg[1] + m.inSituMg[2];
    out.push({
      rec,
      p,
      b,
      row: { blk: b, y: o.y, v: o.v, shared: o.shared },
      coarse: { b, coarseMg: m.coarseMg, coarseCap: m.coarseCap, ncInSituMg: nc },
      ncInSituMg: m.inSituMg,
    });
  }
  return out;
}

/** Is this record a production row (stored by recordProduction)? */
export function isProductionRecord(rec: SampleRecord): boolean {
  return rec.source === 'production';
}
