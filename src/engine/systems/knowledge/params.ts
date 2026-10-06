// The estimator's resolved parameters (DESIGN §4.20): §4's tuning keys from the game's resolved tuning plus the §3
// physics and template constants from the world's generation snapshot (world.genParams). §3's constants are read,
// never copied into §4 keys (D-4.15), and none of them is truth: they are the visible structure the prior uses.
import type { TuningKey, TuningResolved, TuningValue } from '../../../data/tuning';
import { invariant } from '../../core/assert';
import { hashValue } from '../../core/hash';
import { createWeakMemo } from '../../core/memo';
import type {
  BedrockType,
  ClimateBand,
  DepositType,
  GeoGenParams,
  OldTimerKind,
  PriorStatus,
  RegionTemplateId,
  SamplePhysics,
  SizeRecord,
} from '../world/types';

type Obj = { readonly [k: string]: TuningValue };

function isObj(v: TuningValue | undefined): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(t: TuningResolved, key: TuningKey): number {
  const v = t[key];
  invariant(typeof v === 'number' && Number.isFinite(v), () => `tuning ${key} must be a finite number`);
  return v;
}

function field(o: Obj, name: string, what: string): number {
  const v = o[name];
  invariant(typeof v === 'number' && Number.isFinite(v), () => `${what}.${name} must be a number`);
  return v;
}

function table(t: TuningResolved, key: TuningKey): Obj {
  const v = t[key];
  invariant(isObj(v), () => `tuning ${key} must be a table`);
  return v;
}

function pairField(o: Obj, name: string, what: string): readonly [number, number] {
  const v = o[name];
  invariant(
    Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number',
    () => `${what}.${name} must be a [a, b] pair`,
  );
  return [v[0] as number, v[1] as number];
}

/** Historic old-timer kinds with a worked/passed-over offset table (§4.10.2). */
export type DepletionKind = 'drift' | 'handCut' | 'dredge' | 'dryWash';
export const DEPLETION_KINDS: readonly DepletionKind[] = ['drift', 'handCut', 'dredge', 'dryWash'];

export interface SmallCountRow {
  readonly n: number;
  readonly b: number;
  readonly v: number;
}

/** Template constants the estimator reads beyond ClaimPriors (all visible; §3.2). */
export interface TemplateConsts {
  readonly climateBand: ClimateBand;
  readonly gMed: number;
  readonly stakedFraction: number;
  /** §3.2 deposit mix, grade multipliers and old-timer odds: the hidden deposit type behind a visible setting. */
  readonly depositMix: Readonly<Partial<Record<DepositType, number>>>;
  readonly depositGradeMult: Readonly<Partial<Record<DepositType, number>>>;
  readonly oldTimerMix: Readonly<Partial<Record<DepositType, Readonly<Partial<Record<OldTimerKind, number>>>>>>;
  readonly clayMed: number;
  readonly boulderMed: number;
  readonly cementMed: Readonly<Partial<Record<DepositType, number>>>;
  readonly permafrostP: Readonly<Partial<Record<DepositType, number>>>;
}

export interface EstimatorParams {
  /** Content hash of everything below: part of every memo key (§2.3 item 6). */
  readonly key: string;
  readonly phys: SamplePhysics;
  readonly bedrock: Readonly<Record<BedrockType, { readonly cleanupFt: number; readonly goldShare: number }>>;
  readonly templates: Readonly<Partial<Record<RegionTemplateId, TemplateConsts>>>;
  readonly statusMult: Readonly<Record<PriorStatus, number>>;
  /** §3 generator structure the prior mirrors (D-4.16). */
  readonly streakMinF: number;
  readonly dredgeMinF: number;
  readonly handCutMaxObFt: number;
  /** §3.4 held selection: P(held) = logistic(logit(stakedFraction) + slope × zq), zq = ln(gStreak/gMed)/zqLnScale. */
  readonly selection: {
    readonly slope: number;
    readonly slopeOverlooked: number;
    readonly zqLnScale: number;
    readonly zqNoPaystreak: number;
  };
  readonly richRangeFt: Readonly<Partial<Record<RegionTemplateId, number>>>;
  readonly coarseStreakThin: number;
  readonly payStreakWeight: number;
  readonly obAxisBoost: number;
  readonly obAxisScaleFt: number;
  readonly driftDecayMult: number;
  readonly driftBedrockShareMult: number;
  readonly dredgeDecayFt: number;
  readonly dredgeMinBedrockShare: number;
  readonly sluiceCapture: SizeRecord;
  readonly recentWorkedShare: number;
  /** §3.6 deplete(): expected extraction per kind, size weights, class cap, drift's bottom interval. */
  readonly deplete: {
    readonly meanX: Readonly<Record<DepletionKind, number>>;
    readonly handWeights: readonly number[];
    readonly dredgeWeights: readonly number[];
    readonly cap: number;
    readonly maxX: number;
    readonly driftTopFt: number;
    readonly driftBedrockFt: number;
  };
  // §4 keys
  readonly priorMedianAdj: Readonly<Partial<Record<RegionTemplateId, number>>>;
  readonly streakResidLogSd: number;
  readonly streakNodes: number;
  readonly streakHwNodes: number;
  readonly streakNodesLarge: number;
  readonly largeClaimBlocks: number;
  readonly hypPruneWeight: number;
  readonly hypPruneWeightLarge: number;
  readonly streakRangeAlongFt: number;
  /** §3.5.2 row processes the configurations approximate: centre wander and half-width AR(1) ranges, ft. */
  readonly wanderRangeFt: number;
  readonly halfWidthRangeFt: number;
  readonly streakMisfitScale: number;
  readonly modelErrorLogSd: number;
  readonly claimSharedLogSd: number;
  readonly posFullLogSd: number;
  readonly posUpperExtraLogSd: number;
  readonly exposureLambdaLogSd: number;
  readonly exposureThickElast: number;
  readonly smallCount: readonly SmallCountRow[];
  readonly siteRefineMaxNeff: number;
  readonly siteRefineSweeps: number;
  readonly siteRefineGrid: number;
  readonly varIterations: number;
  readonly coarseBlockLogSd: number;
  readonly coarseMassPriorCount: number;
  readonly pocketBcyMean: number;
  readonly pocketBcy2Mean: number;
  readonly pocketGradeMin: number;
  readonly pocketGradeMult: number;
  readonly pocketGradeCv2: number;
  readonly pocketHitNcGrade: number;
  readonly pocketHitMult: number;
  readonly bSdUnknownFt: number;
  readonly bLogSdKnown: number;
  readonly censorTrigger: number;
  readonly censorPadFactor: number;
  readonly censorLogSd: number;
  readonly sizeMixPriorMg: number;
  readonly finenessAssaySd: number;
  readonly finenessParticleSd: number;
  readonly finenessProdSd: number;
  readonly sellerVerifiedExtraLogSd: number;
  readonly workedLogOffset: Readonly<Record<DepletionKind, readonly [number, number]>>;
  readonly workedShare: Readonly<Record<DepletionKind, number>>;
  readonly removalLog: Readonly<Record<DepletionKind, number>>;
  readonly workedOffStreakLik: number;
  /** §3.6 worked share of the paystreak blocks by kind: U(lo, hi) × N, each block worked with probability p. */
  readonly workedCount: Readonly<
    Record<
      'drift' | 'handCut' | 'dryWash' | 'recentCat',
      { readonly lo: number; readonly hi: number; readonly p: number }
    >
  >;
  readonly workedCountSlackBlocks: number;
  readonly workedSetTemper: number;
  readonly geoNoiseMultBase: number;
  readonly geoNoiseMultPerSkill: number;
  readonly unloggedNoiseMult: number;
  readonly unloggedCaptureMult: number;
  readonly historicGradeRatio: number;
  readonly creekProdLogSd: number;
  // planning and classes
  readonly planWashUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly planStripUsd: Readonly<Partial<Record<ClimateBand, number>>>;
  readonly planPayable: number;
  readonly ground: {
    readonly stripFrozen: number;
    readonly stripCement: number;
    readonly washBoulders: number;
    readonly washClay: number;
    readonly washFrozen: number;
    readonly recClay: number;
  };
  readonly tercileValue: Readonly<Record<'low' | 'med' | 'high', number>>;
  readonly planMiningLossFrac: number;
  readonly planDilutionFrac: number;
  readonly repriceStep: number;
  readonly conf: {
    readonly measuredMaxSpread: number;
    readonly indicatedMaxSpread: number;
    readonly inferredMaxSpread: number;
    readonly measuredCoverage: number;
    readonly indicatedCoverage: number;
    readonly inferredCoverage: number;
    readonly inferredMaxRowGap: number;
    readonly indicatedMaxCoarseLogSd: number;
    readonly measuredMaxCoarseLogSd: number;
    readonly indicatedMinProcessedBcy: number;
    readonly measuredMinProdBcy: number;
    readonly measuredMinBulkBlocks: number;
    readonly inferredMinBedrockSamples: number;
    readonly blockMaxLogSd: Readonly<Record<'measured' | 'indicated' | 'inferred', number>>;
    readonly blockMeasuredMinSampleBcy: number;
  };
}

function kindTable(t: TuningResolved, key: TuningKey): Record<DepletionKind, number> {
  const o = table(t, key);
  return {
    drift: field(o, 'drift', key),
    handCut: field(o, 'handCut', key),
    dredge: field(o, 'dredge', key),
    dryWash: field(o, 'dryWash', key),
  };
}

function bandTable(t: TuningResolved, key: TuningKey): Partial<Record<ClimateBand, number>> {
  const o = table(t, key);
  const out: Partial<Record<ClimateBand, number>> = {};
  for (const b of ['subarctic', 'arid', 'temperateMontane'] as const) {
    const v = o[b];
    if (typeof v === 'number') out[b] = v;
  }
  return out;
}

function smallCountRows(t: TuningResolved): SmallCountRow[] {
  const v = t['geology.estSmallCountTable'];
  invariant(Array.isArray(v) && v.length >= 2, 'geology.estSmallCountTable must be an array of rows');
  const rows: SmallCountRow[] = [];
  for (const r of v as readonly TuningValue[]) {
    invariant(isObj(r), 'geology.estSmallCountTable rows must be tables');
    rows.push({ n: field(r, 'n', 'smallCount'), b: field(r, 'b', 'smallCount'), v: field(r, 'v', 'smallCount') });
  }
  for (let i = 1; i < rows.length; i++) {
    invariant((rows[i] as SmallCountRow).n > (rows[i - 1] as SmallCountRow).n, 'small-count grid must increase');
  }
  return rows;
}

function gradeMults(
  dm: Readonly<Record<DepositType, { readonly grade: number }>>,
): Partial<Record<DepositType, number>> {
  const out: Partial<Record<DepositType, number>> = {};
  for (const d of ['creek', 'bench', 'deepMuck', 'dredgedGround', 'desertFan', 'gulch'] as const) out[d] = dm[d].grade;
  return out;
}

function mid(r: readonly [number, number]): number {
  return (r[0] + r[1]) / 2;
}

function buildParams(t: TuningResolved, gp: GeoGenParams): EstimatorParams {
  const templates: Partial<Record<RegionTemplateId, TemplateConsts>> = {};
  const adjTable = table(t, 'geology.estPriorMedianAdj');
  const priorMedianAdj: Partial<Record<RegionTemplateId, number>> = {};
  const richRangeFt: Partial<Record<RegionTemplateId, number>> = {};
  for (const id of ['northernFederal', 'aridFederal', 'temperateFederal', 'alaskaState', 'yukon'] as const) {
    const tpl = gp.templates[id];
    if (tpl !== undefined) {
      templates[id] = {
        climateBand: tpl.climateBand,
        gMed: tpl.gMed,
        stakedFraction: tpl.stakedFraction,
        depositMix: tpl.depositMix,
        depositGradeMult: gradeMults(tpl.depositMult),
        oldTimerMix: tpl.oldTimerMix,
        clayMed: tpl.clayMed,
        boulderMed: tpl.boulderMed,
        cementMed: tpl.cementMed,
        permafrostP: tpl.permafrostP,
      };
      richRangeFt[id] = tpl.richRangeFt;
    }
    const a = adjTable[id];
    if (typeof a === 'number') priorMedianAdj[id] = a;
  }
  const off = table(t, 'geology.recordsWorkedLogOffset');
  const g = table(t, 'geology.planGroundMult');
  const terc = table(t, 'geology.planTercileValues');
  const blockSd = table(t, 'geology.confBlockMaxLogSd');
  const recent = gp.oldTimer.kinds.recentCat.top;
  const body: Omit<EstimatorParams, 'key'> = {
    phys: gp.sample,
    bedrock: gp.bedrock,
    templates,
    statusMult: gp.prior.statusMult,
    streakMinF: gp.grade.pocketStreakMinF,
    dredgeMinF: gp.oldTimer.kinds.dredge.minF,
    handCutMaxObFt: gp.oldTimer.kinds.handCut.maxObFt,
    selection: {
      slope: gp.world.selSlope,
      slopeOverlooked: gp.world.selSlopeOverlooked,
      zqLnScale: gp.world.zqLnScale,
      zqNoPaystreak: gp.world.zqNoPaystreak,
    },
    richRangeFt,
    coarseStreakThin: gp.grade.claim.coarseStreakThin,
    payStreakWeight: gp.grade.claim.payStreakWeight,
    obAxisBoost: gp.grade.obAxisBoost,
    obAxisScaleFt: gp.grade.obAxisScaleFt,
    driftDecayMult: gp.oldTimer.driftBottom.decayMult,
    driftBedrockShareMult: gp.oldTimer.driftBottom.bedrockShareMult,
    dredgeDecayFt: gp.oldTimer.dredgeEffects.decayFt,
    dredgeMinBedrockShare: gp.oldTimer.dredgeEffects.minBedrockShare,
    sluiceCapture: {
      coarse: gp.refEcon.capture[0],
      medium: gp.refEcon.capture[1],
      fine: gp.refEcon.capture[2],
      ultrafine: gp.refEcon.capture[3],
    },
    // Recent operators mined the top U(15%, 50%) of the paystreak (§3.6): the mean share.
    recentWorkedShare: (recent[0] + recent[1]) / 2,
    deplete: {
      meanX: {
        drift: mid(gp.oldTimer.kinds.drift.extract),
        handCut: mid(gp.oldTimer.kinds.handCut.extract),
        dredge: mid(gp.oldTimer.kinds.dredge.extract),
        dryWash: mid(gp.oldTimer.kinds.dryWash.extract),
      },
      handWeights: gp.oldTimer.depleteWeights.hand,
      dredgeWeights: gp.oldTimer.depleteWeights.dredge,
      cap: gp.oldTimer.depleteCap,
      maxX: gp.oldTimer.maxExtraction,
      driftTopFt: gp.oldTimer.driftBottom.topFt,
      driftBedrockFt: gp.oldTimer.driftBottom.bedrockFt,
    },
    priorMedianAdj,
    streakResidLogSd: num(t, 'geology.estStreakResidLogSd'),
    streakNodes: num(t, 'geology.estStreakNodes'),
    streakHwNodes: num(t, 'geology.estStreakHwNodes'),
    streakNodesLarge: num(t, 'geology.estStreakNodesLarge'),
    largeClaimBlocks: num(t, 'geology.estLargeClaimBlocks'),
    hypPruneWeight: num(t, 'geology.estHypPruneWeight'),
    hypPruneWeightLarge: num(t, 'geology.estHypPruneWeightLarge'),
    streakRangeAlongFt: num(t, 'geology.estStreakRangeAlongFt'),
    wanderRangeFt: gp.grade.wanderRangeFt,
    halfWidthRangeFt: gp.grade.halfWidthRangeFt,
    streakMisfitScale: num(t, 'geology.estStreakMisfitScale'),
    modelErrorLogSd: num(t, 'geology.estModelErrorLogSd'),
    claimSharedLogSd: num(t, 'geology.estClaimSharedLogSd'),
    posFullLogSd: num(t, 'geology.estPosFullLogSd'),
    posUpperExtraLogSd: num(t, 'geology.estPosUpperExtraLogSd'),
    exposureLambdaLogSd: num(t, 'geology.estExposureLambdaLogSd'),
    exposureThickElast: num(t, 'geology.estExposureThickElast'),
    smallCount: smallCountRows(t),
    siteRefineMaxNeff: num(t, 'geology.estSiteRefineMaxNeff'),
    siteRefineSweeps: num(t, 'geology.estSiteRefineSweeps'),
    siteRefineGrid: num(t, 'geology.estSiteRefineGrid'),
    varIterations: num(t, 'geology.estVarIterations'),
    coarseBlockLogSd: num(t, 'geology.estCoarseBlockLogSd'),
    coarseMassPriorCount: num(t, 'geology.estCoarseMassPriorCount'),
    pocketBcyMean: num(t, 'geology.estPocketBcyMean'),
    pocketBcy2Mean: num(t, 'geology.estPocketBcy2Mean'),
    pocketGradeMin: num(t, 'geology.estPocketGradeMin'),
    pocketGradeMult: num(t, 'geology.estPocketGradeMult'),
    pocketGradeCv2: num(t, 'geology.estPocketGradeCv2'),
    pocketHitNcGrade: num(t, 'geology.estPocketHitNcGrade'),
    pocketHitMult: num(t, 'geology.estPocketHitMult'),
    bSdUnknownFt: num(t, 'geology.estGeomBSdUnknownFt'),
    bLogSdKnown: num(t, 'geology.estGeomBLogSdKnown'),
    censorTrigger: num(t, 'geology.estCensorTrigger'),
    censorPadFactor: num(t, 'geology.estCensorPadFactor'),
    censorLogSd: num(t, 'geology.estCensorLogSd'),
    sizeMixPriorMg: num(t, 'geology.estSizeMixPriorMg'),
    finenessAssaySd: num(t, 'geology.estFinenessAssaySd'),
    finenessParticleSd: num(t, 'geology.estFinenessParticleSd'),
    finenessProdSd: num(t, 'geology.estFinenessProdSd'),
    sellerVerifiedExtraLogSd: num(t, 'geology.estSellerVerifiedExtraLogSd'),
    workedLogOffset: {
      drift: pairField(off, 'drift', 'geology.recordsWorkedLogOffset'),
      handCut: pairField(off, 'handCut', 'geology.recordsWorkedLogOffset'),
      dredge: pairField(off, 'dredge', 'geology.recordsWorkedLogOffset'),
      dryWash: pairField(off, 'dryWash', 'geology.recordsWorkedLogOffset'),
    },
    workedShare: kindTable(t, 'geology.recordsWorkedShare'),
    removalLog: kindTable(t, 'geology.recordsRemovalLog'),
    workedOffStreakLik: num(t, 'geology.estWorkedOffStreakLik'),
    workedCount: {
      drift: {
        lo: gp.oldTimer.kinds.drift.top[0],
        hi: gp.oldTimer.kinds.drift.top[1],
        p: gp.oldTimer.kinds.drift.workP,
      },
      handCut: { lo: gp.oldTimer.kinds.handCut.top, hi: gp.oldTimer.kinds.handCut.top, p: 1 },
      dryWash: { lo: gp.oldTimer.kinds.dryWash.top, hi: gp.oldTimer.kinds.dryWash.top, p: 1 },
      recentCat: { lo: recent[0], hi: recent[1], p: 1 },
    },
    workedCountSlackBlocks: num(t, 'geology.estWorkedCountSlackBlocks'),
    workedSetTemper: num(t, 'geology.estWorkedSetTemper'),
    geoNoiseMultBase: num(t, 'geology.geoNoiseMultBase'),
    geoNoiseMultPerSkill: num(t, 'geology.geoNoiseMultPerSkill'),
    unloggedNoiseMult: num(t, 'geology.unloggedNoiseMult'),
    unloggedCaptureMult: num(t, 'geology.unloggedCaptureMult'),
    historicGradeRatio: gp.records.historicGradeRatio,
    creekProdLogSd: gp.records.creekProdLogSd,
    planWashUsd: bandTable(t, 'geology.planWashUsdPerPayBcy'),
    planStripUsd: bandTable(t, 'geology.planStripUsdPerBcy'),
    planPayable: num(t, 'geology.planPayable'),
    ground: {
      stripFrozen: field(g, 'stripFrozen', 'geology.planGroundMult'),
      stripCement: field(g, 'stripCement', 'geology.planGroundMult'),
      washBoulders: field(g, 'washBoulders', 'geology.planGroundMult'),
      washClay: field(g, 'washClay', 'geology.planGroundMult'),
      // §3's refEcon frozen wash term (D-4.46): one key, §3's.
      washFrozen: gp.refEcon.frozenWashAdd,
      recClay: field(g, 'recClay', 'geology.planGroundMult'),
    },
    tercileValue: {
      low: field(terc, 'low', 'geology.planTercileValues'),
      med: field(terc, 'med', 'geology.planTercileValues'),
      high: field(terc, 'high', 'geology.planTercileValues'),
    },
    planMiningLossFrac: num(t, 'geology.planMiningLossFrac'),
    planDilutionFrac: num(t, 'geology.planDilutionFrac'),
    repriceStep: num(t, 'geology.estRepriceStep'),
    conf: {
      measuredMaxSpread: num(t, 'geology.confMeasuredMaxSpread'),
      indicatedMaxSpread: num(t, 'geology.confIndicatedMaxSpread'),
      inferredMaxSpread: num(t, 'geology.confInferredMaxSpread'),
      measuredCoverage: num(t, 'geology.confMeasuredCoverage'),
      indicatedCoverage: num(t, 'geology.confIndicatedCoverage'),
      inferredCoverage: num(t, 'geology.confInferredCoverage'),
      inferredMaxRowGap: num(t, 'geology.confInferredMaxRowGap'),
      indicatedMaxCoarseLogSd: num(t, 'geology.confIndicatedMaxCoarseLogSd'),
      measuredMaxCoarseLogSd: num(t, 'geology.confMeasuredMaxCoarseLogSd'),
      indicatedMinProcessedBcy: num(t, 'geology.confIndicatedMinProcessedBcy'),
      measuredMinProdBcy: num(t, 'geology.confMeasuredMinProdBcy'),
      measuredMinBulkBlocks: num(t, 'geology.confMeasuredMinBulkBlocks'),
      inferredMinBedrockSamples: num(t, 'geology.confInferredMinBedrockSamples'),
      blockMaxLogSd: {
        measured: field(blockSd, 'measured', 'geology.confBlockMaxLogSd'),
        indicated: field(blockSd, 'indicated', 'geology.confBlockMaxLogSd'),
        inferred: field(blockSd, 'inferred', 'geology.confBlockMaxLogSd'),
      },
      blockMeasuredMinSampleBcy: num(t, 'geology.confBlockMeasuredMinSampleBcy'),
    },
  };
  return { ...body, key: hashValue(body) };
}

interface ParamsEntry {
  readonly tuning: TuningResolved;
  readonly params: EstimatorParams;
}

const paramsMemo = createWeakMemo<GeoGenParams, ParamsEntry>('knowledge.estimatorParams');

/**
 * estimatorParams(tuning, genParams): resolved once per (tuning, world snapshot) pair. Both inputs are immutable for
 * the life of a game (§2.10, D-3.2), so the cache is keyed by object identity and re-checks the tuning object.
 */
export function estimatorParams(tuning: TuningResolved, gp: GeoGenParams): EstimatorParams {
  const hit = paramsMemo.get(gp);
  if (hit !== undefined && hit.tuning === tuning) return hit.params;
  const params = buildParams(tuning, gp);
  paramsMemo.set(gp, { tuning, params });
  return params;
}

/** The old-timer kinds §4 models a depletion for, from §3's kind (none and P6 hydraulic carry no offset). */
export function depletionKindOf(kind: OldTimerKind): DepletionKind | 'recentCat' | null {
  switch (kind) {
    case 'drift':
    case 'handCut':
    case 'dredge':
    case 'dryWash':
      return kind;
    case 'recentCat':
      return 'recentCat';
    case 'none':
    case 'hydraulic':
      return null;
  }
}
