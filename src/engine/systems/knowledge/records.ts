// Records review (DESIGN §4.10.2): §3 decides what exists in the public record; §4 decides what a reviewer finds.
// item found ⇔ it exists and u_i < min(maxFind, quality × w_i × reviewerMult × recordsFindMult × hook), with u_i from
// rng(seed,'records',claimId,item): the same u for every review of the claim, so a better reviewer finds a superset.
// Old drill logs become SampleRecords of method churnHistoric (source 'recordsHistoric').
import type { TuningKey, TuningResolved, TuningValue } from '../../../data/tuning';
import { invariant } from '../../core/assert';
import { MG_PER_OZ } from '../world/constants';
import type { BlockId, ClaimId, CreekId, RecordFindingId, SampleId } from '../../core/ids';
import { rng } from '../../core/rng';
import type { CreekHistory, PublicRecord } from '../world/types';
import type { RecordFinding, RecordItem, ReviewerRef, SampleRecord } from './types';

export interface RecordsParams {
  readonly maxFindProb: number;
  readonly itemWeight: Readonly<Record<RecordItem, number>>;
  /** Difficulty knob (§1 1.11) times the event hook prospect.recordsFindMult (P0: 1). */
  readonly findMult: number;
  readonly reviewer: {
    readonly owner: number;
    readonly staffBase: number;
    readonly staffPerSkill: number;
    readonly ownerGeologist: number;
    readonly consultantBudget: number;
    readonly consultantStandard: number;
    readonly consultantPremier: number;
  };
}

type Obj = { readonly [k: string]: TuningValue };

function tableNum(t: TuningResolved, key: TuningKey, name: string): number {
  const o = t[key];
  invariant(typeof o === 'object' && o !== null && !Array.isArray(o), () => `tuning ${key} must be a table`);
  const v = (o as Obj)[name];
  invariant(typeof v === 'number', () => `tuning ${key}.${name} must be a number`);
  return v;
}

export function recordsParams(t: TuningResolved, hookFindMult = 1): RecordsParams {
  const m = t['geology.recordsMaxFindProb'];
  const f = t['geology.recordsFindMult'];
  invariant(typeof m === 'number' && typeof f === 'number', 'records tuning');
  const w = (k: RecordItem): number => tableNum(t, 'geology.recordsItemWeight', k);
  const r = (k: string): number => tableNum(t, 'geology.reviewerMult', k);
  return {
    maxFindProb: m,
    itemWeight: {
      creekHistory: w('creekHistory'),
      oldWorkings: w('oldWorkings'),
      priorExploration: w('priorExploration'),
      filedProduction: w('filedProduction'),
      permitHistory: w('permitHistory'),
    },
    findMult: f * hookFindMult,
    reviewer: {
      owner: r('owner'),
      staffBase: r('staffBase'),
      staffPerSkill: r('staffPerSkill'),
      ownerGeologist: r('ownerGeologist'),
      consultantBudget: r('consultantBudget'),
      consultantStandard: r('consultantStandard'),
      consultantPremier: r('consultantPremier'),
    },
  };
}

/** reviewerMult (§4.10.2): owner 0.6; staff 0.5 + 0.005·trueSkill; owner-geologist 0.9; consultant by tier. */
export function reviewerMult(rv: ReviewerRef, p: RecordsParams): number {
  switch (rv.kind) {
    case 'owner':
      return rv.geologist ? p.reviewer.ownerGeologist : p.reviewer.owner;
    case 'staff':
      return p.reviewer.staffBase + p.reviewer.staffPerSkill * rv.trueSkill;
    case 'consultant':
      return rv.tier === 'budget'
        ? p.reviewer.consultantBudget
        : rv.tier === 'standard'
          ? p.reviewer.consultantStandard
          : p.reviewer.consultantPremier;
  }
}

export function findProbability(item: RecordItem, quality: number, rv: ReviewerRef, p: RecordsParams): number {
  return Math.min(p.maxFindProb, quality * p.itemWeight[item] * reviewerMult(rv, p) * p.findMult);
}

export interface RecordsReviewInput {
  readonly seed: string;
  readonly claimId: ClaimId;
  readonly creekId: CreekId;
  readonly turn: number;
  readonly record: PublicRecord & { readonly creekHistory: CreekHistory | null };
  /** §3 recordsQuality(state, claimId). */
  readonly quality: number;
  readonly reviewer: ReviewerRef;
  /** P1 reviews find only creekHistory and oldWorkings (§4.16); P2 all items. */
  readonly items: readonly RecordItem[];
  readonly blockIdOf: (blockIdx: number) => BlockId;
  readonly nextRecordId: () => RecordFindingId;
  readonly nextSampleId: () => SampleId;
}

export interface RecordsReviewResult {
  readonly findings: RecordFinding[];
  readonly samples: SampleRecord[];
}

/** The review's findings (pure; the caller allocates ids and stores them). */
export function recordsReview(inp: RecordsReviewInput, p: RecordsParams): RecordsReviewResult {
  const findings: RecordFinding[] = [];
  const samples: SampleRecord[] = [];
  const found = (item: RecordItem): boolean =>
    inp.items.includes(item) &&
    rng(inp.seed, 'records', inp.claimId, item).next() < findProbability(item, inp.quality, inp.reviewer, p);
  const h = inp.record.creekHistory;
  if (h !== null && found('creekHistory')) {
    findings.push({
      id: inp.nextRecordId(),
      creekId: inp.creekId,
      turn: inp.turn,
      item: 'creekHistory',
      reviewer: inp.reviewer,
      payload: { histOz: h.histOz, histBcy: h.histBcy, era: h.era },
    });
  }
  const ot = inp.record.oldTimer;
  if (ot !== null && found('oldWorkings')) {
    findings.push({
      id: inp.nextRecordId(),
      claimId: inp.claimId,
      turn: inp.turn,
      item: 'oldWorkings',
      reviewer: inp.reviewer,
      payload: {
        kind: ot.kind,
        era: ot.era,
        workedBlocks: ot.workedBlockIdxs.map((i) => ({ blockId: inp.blockIdOf(i), kind: ot.kind })),
      },
    });
  }
  const drill = inp.record.priorDrill;
  if (drill !== null && drill.length > 0 && found('priorExploration')) {
    const ids: SampleId[] = [];
    drill.forEach((hole, k) => {
      const id = inp.nextSampleId();
      ids.push(id);
      const reached = hole.depthToBedrockFt !== null;
      const ob =
        hole.depthToBedrockFt !== null && hole.payThicknessFt !== null
          ? Math.max(0, hole.depthToBedrockFt - hole.payThicknessFt)
          : undefined;
      samples.push({
        id,
        claimId: inp.claimId,
        blockId: inp.blockIdOf(hole.blockIdx),
        methodId: 'churnHistoric',
        drawIndex: k,
        source: 'recordsHistoric',
        turn: inp.turn,
        availableTurn: inp.turn,
        volumeBcy: hole.volumeMeasuredBcy,
        interval: reached ? 'fullColumn' : 'upperPay',
        bedrockLogged: reached,
        depthReachedFt: hole.depthToBedrockFt ?? 0,
        observed: {
          ...(ob !== undefined ? { overburdenFt: ob } : {}),
          ...(hole.depthToBedrockFt !== null ? { depthToBedrockFt: hole.depthToBedrockFt } : {}),
          ...(hole.payThicknessFt !== null ? { payThicknessFt: hole.payThicknessFt } : {}),
          permafrost: false,
          waterInflow: false,
          oldWorkings: false,
        },
        colours: hole.colorsBySize,
        massMg: null,
        // The log reports grade over measured volume (§3's draw: reported = recovered mg / K / V).
        recoveredMg: hole.reportedGradeOzPerBcy * MG_PER_OZ * hole.volumeMeasuredBcy,
        headGradeOzPerBcy: hole.reportedGradeOzPerBcy,
        ncGradeOzPerBcy: 0,
        // Historic logs are read at the method row's nominal noise and capture (§3 drew them so).
        loggedBy: { kind: 'consultant', shownSkill: 50 },
        flags: [],
      });
    });
    findings.push({
      id: inp.nextRecordId(),
      claimId: inp.claimId,
      turn: inp.turn,
      item: 'priorExploration',
      reviewer: inp.reviewer,
      payload: { sampleIds: ids },
    });
  }
  return { findings, samples };
}
