// The generation-parameter snapshot (D-3.2): world generation and every later §3 physics call read world.genParams,
// never live tuning, so a tuning migration can never rewrite the geology under a player's estimates.
import { bedrockTable, regionTemplate } from '../../../data/regions';
import type { TuningKey, TuningResolved, TuningValue } from '../../../data/tuning';
import { invariant } from '../../core/assert';
import type {
  Access,
  ClaimGenConstants,
  ClimateBand,
  EconClass,
  GeoGenParams,
  HolderSituation,
  ListingSetting,
  MethodParamsData,
  PriorStatus,
  RegionTemplate,
  RegionTemplateId,
  SellerHonesty,
  SizeRecord,
  WaterSourceKind,
} from './types';
import { ACCESS_CLASSES, SIZE_SETTINGS } from './enums';

// ---------------------------------------------------------------------------------------------------------------------
// Narrowing readers: tuning values are plain data (TuningValue); a wrong shape is a data bug, so it throws.
// ---------------------------------------------------------------------------------------------------------------------

type Obj = { readonly [k: string]: TuningValue };

function isObj(v: TuningValue | undefined): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function tNum(t: TuningResolved, key: TuningKey): number {
  const v = t[key];
  invariant(typeof v === 'number' && Number.isFinite(v), () => `tuning ${key} must be a finite number`);
  return v;
}

export function tPair(t: TuningResolved, key: TuningKey): readonly [number, number] {
  const v = t[key];
  invariant(
    Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number',
    () => `tuning ${key} must be a [lo, hi] pair`,
  );
  return [v[0] as number, v[1] as number];
}

function numArray(v: TuningValue | undefined, n: number, what: string): number[] {
  invariant(Array.isArray(v) && v.length === n, () => `${what} must be an array of ${n} numbers`);
  const out: number[] = [];
  for (const x of v as readonly TuningValue[]) {
    invariant(typeof x === 'number' && Number.isFinite(x), () => `${what} must hold numbers`);
    out.push(x);
  }
  return out;
}

export function tNums4(t: TuningResolved, key: TuningKey): readonly [number, number, number, number] {
  const a = numArray(t[key], 4, `tuning ${key}`);
  return [a[0] as number, a[1] as number, a[2] as number, a[3] as number];
}

function tNums3(t: TuningResolved, key: TuningKey): readonly [number, number, number] {
  const a = numArray(t[key], 3, `tuning ${key}`);
  return [a[0] as number, a[1] as number, a[2] as number];
}

/** A table of numbers keyed by the given names (every name required). */
function tTable<K extends string>(t: TuningResolved, key: TuningKey, names: readonly K[]): Record<K, number> {
  const v = t[key];
  invariant(isObj(v), () => `tuning ${key} must be a table`);
  const out = {} as Record<K, number>;
  for (const n of names) {
    const x = v[n];
    invariant(typeof x === 'number' && Number.isFinite(x), () => `tuning ${key}.${n} must be a number`);
    out[n] = x;
  }
  return out;
}

/** A partial table of numbers: only the listed names that are present. */
function tPartial<K extends string>(
  t: TuningResolved,
  key: TuningKey,
  names: readonly K[],
): Partial<Record<K, number>> {
  const v = t[key];
  invariant(isObj(v), () => `tuning ${key} must be a table`);
  const out: Partial<Record<K, number>> = {};
  for (const n of names) {
    const x = v[n];
    if (x === undefined) continue;
    invariant(typeof x === 'number' && Number.isFinite(x), () => `tuning ${key}.${n} must be a number`);
    out[n] = x;
  }
  return out;
}

function objField(o: Obj, field: string, what: string): number {
  const x = o[field];
  invariant(typeof x === 'number' && Number.isFinite(x), () => `${what}.${field} must be a number`);
  return x;
}

const CLIMATE_BANDS: readonly ClimateBand[] = ['subarctic', 'arid', 'temperateMontane'];
const HONESTY: readonly SellerHonesty[] = ['accurate', 'optimistic', 'cherryPicked', 'fraudulent'];
const SITUATIONS: readonly HolderSituation[] = [
  'prospector',
  'absentee',
  'retiringOperator',
  'estate',
  'distressedOperator',
];
const CLASSES: readonly EconClass[] = ['uneconomic', 'marginal', 'good', 'excellent'];
const STATUSES: readonly PriorStatus[] = ['held', 'listed', 'open'];
const SETTINGS: readonly ListingSetting[] = ['valleyBottom', 'bench', 'dredgedGround', 'fan', 'gulch'];
const WATER_KINDS: readonly WaterSourceKind[] = ['creek', 'spring', 'well', 'ephemeralWash', 'none'];

/** Reads a §4 method row stored as a tuning table (positionMode, captureBySize, noise, optional depth and per-ft). */
function readMethod(t: TuningResolved, key: TuningKey, id: string): MethodParamsData {
  const v = t[key];
  invariant(isObj(v), () => `tuning ${key} must be a method table`);
  const mode = v['positionMode'];
  invariant(
    mode === 'exposure' || mode === 'pit' || mode === 'fullColumn' || mode === 'interval',
    () => `tuning ${key}.positionMode is invalid`,
  );
  const cap = v['captureBySize'];
  invariant(isObj(cap), () => `tuning ${key}.captureBySize must be a table`);
  const captureBySize: SizeRecord = {
    coarse: objField(cap, 'coarse', key),
    medium: objField(cap, 'medium', key),
    fine: objField(cap, 'fine', key),
    ultrafine: objField(cap, 'ultrafine', key),
  };
  const frozenOk = v['frozenOk'];
  invariant(typeof frozenOk === 'boolean', () => `tuning ${key}.frozenOk must be a boolean`);
  const maxDepth = v['maxDepthFt'];
  const m: {
    -readonly [P in keyof MethodParamsData]: MethodParamsData[P];
  } = {
    id,
    positionMode: mode,
    maxDepthFt: typeof maxDepth === 'number' ? maxDepth : null,
    frozenOk,
    bedrockPenFt: objField(v, 'bedrockPenFt', key),
    captureBySize,
    volumeCv: objField(v, 'volumeCv', key),
    weighCv: objField(v, 'weighCv', key),
    geomCv: objField(v, 'geomCv', key),
    biasMult: objField(v, 'biasMult', key),
  };
  if (typeof v['thickCv'] === 'number') m.thickCv = v['thickCv'];
  if (typeof v['exposureDepthFrac'] === 'number') m.exposureDepthFrac = v['exposureDepthFrac'];
  if (typeof v['bcyPerFt'] === 'number') m.bcyPerFt = v['bcyPerFt'];
  if (typeof v['reportsClassMasses'] === 'boolean') m.reportsClassMasses = v['reportsClassMasses'];
  return m;
}

function accessClasses(t: TuningResolved): GeoGenParams['access']['classes'] {
  const out = {} as Record<Access, { fuelAdder: number; partsLead: number; mobMult: number; refMi: number }>;
  for (const a of ACCESS_CLASSES) {
    out[a] = {
      fuelAdder: tNum(t, `geology.access.${a}.fuelAdder`),
      partsLead: tNum(t, `geology.access.${a}.partsLead`),
      mobMult: tNum(t, `geology.access.${a}.mobMult`),
      refMi: tNum(t, `geology.access.${a}.refMi`),
    };
  }
  return out;
}

function honestyTilts(t: TuningResolved): GeoGenParams['seller']['honestyTilts'] {
  const v = t['geology.seller.honestyTilts'];
  invariant(isObj(v), 'tuning geology.seller.honestyTilts must be a table');
  const out = {} as Record<SellerHonesty, Partial<Record<HolderSituation, number>>>;
  for (const h of HONESTY) {
    const row = v[h];
    const r: Partial<Record<HolderSituation, number>> = {};
    if (isObj(row)) {
      for (const s of SITUATIONS) {
        const x = row[s];
        if (typeof x === 'number') r[s] = x;
      }
    }
    out[h] = r;
  }
  return out;
}

function valleyHalfWidths(t: TuningResolved): GeoGenParams['world']['valleyHalfWidthFt'] {
  const v = t['geology.world.valleyHalfWidthFt'];
  invariant(Array.isArray(v) && v.length === 3, 'tuning geology.world.valleyHalfWidthFt must hold 3 pairs');
  const pairs = (v as readonly TuningValue[]).map((p, i) => {
    const a = numArray(p, 2, `geology.world.valleyHalfWidthFt[${i}]`);
    return [a[0] as number, a[1] as number] as const;
  });
  return [pairs[0] as readonly [number, number], pairs[1] as readonly [number, number], pairs[2] as readonly [number, number]];
}

/**
 * Builds the snapshot for a world generated from `templateIds` (the templates are copied into the snapshot so priors
 * and physics keep using the values the ground was generated with).
 */
export function snapshotGenParams(t: TuningResolved, templateIds: readonly string[]): GeoGenParams {
  const templates: Partial<Record<RegionTemplateId, RegionTemplate>> = {};
  for (const id of templateIds) {
    const tpl = regionTemplate(id);
    if (tpl === undefined) throw new RangeError(`generateWorld: unknown or unshipped region template '${id}'`);
    templates[tpl.id] = tpl;
  }
  const improvements = t['geology.oldTimer.improvementsUsd'];
  invariant(isObj(improvements), 'tuning geology.oldTimer.improvementsUsd must be a table');
  const pocketMult = t['geology.grade.pocketMult'];
  invariant(isObj(pocketMult), 'tuning geology.grade.pocketMult must be a table');
  const startYear = t['game.startCalendarYear'];
  invariant(typeof startYear === 'number', 'tuning game.startCalendarYear must be a number');
  const sens = tTable(t, 'geology.env.sensitivity', [
    'base',
    'fish',
    'anadromous',
    'wetlandShare',
    'specialStatus',
    'noiseSd',
  ] as const);
  const workedMult = tTable(t, 'geology.prior.oldWorkingsMult', ['dredgeTailings', 'tailingsPiles'] as const);
  const meanMg = tNums3(t, 'geology.particle.meanMg');
  return {
    version: 1,
    startYear,
    templates,
    bedrock: {
      schist: { cleanupFt: bedrockTable.schist.cleanupFt, goldShare: bedrockTable.schist.goldShare },
      slatePhyllite: { cleanupFt: bedrockTable.slatePhyllite.cleanupFt, goldShare: bedrockTable.slatePhyllite.goldShare },
      granite: { cleanupFt: bedrockTable.granite.cleanupFt, goldShare: bedrockTable.granite.goldShare },
      basaltVolcanic: {
        cleanupFt: bedrockTable.basaltVolcanic.cleanupFt,
        goldShare: bedrockTable.basaltVolcanic.goldShare,
      },
      clayFalse: { cleanupFt: bedrockTable.clayFalse.cleanupFt, goldShare: bedrockTable.clayFalse.goldShare },
      karstLimestone: {
        cleanupFt: bedrockTable.karstLimestone.cleanupFt,
        goldShare: bedrockTable.karstLimestone.goldShare,
      },
    },
    world: {
      maxClaims: tNum(t, 'geology.world.maxClaims'),
      mapMi: tPair(t, 'geology.world.mapMi'),
      stepMi: tNum(t, 'geology.world.stepMi'),
      mainLengthMi: tPair(t, 'geology.world.mainLengthMi'),
      mainHeadingJitterDeg: tNum(t, 'geology.world.mainHeadingJitterDeg'),
      headingStepSdDeg: tNum(t, 'geology.world.headingStepSdDeg'),
      edgeMarginMi: tNum(t, 'geology.world.edgeMarginMi'),
      outletEdgeFrac: tPair(t, 'geology.world.outletEdgeFrac'),
      nTrib: tPair(t, 'geology.world.nTrib'),
      tribPosFrac: tPair(t, 'geology.world.tribPosFrac'),
      tribMinSpacingMi: tNum(t, 'geology.world.tribMinSpacingMi'),
      tribAngleDeg: tPair(t, 'geology.world.tribAngleDeg'),
      tribLengthMi: tPair(t, 'geology.world.tribLengthMi'),
      branchP: tNum(t, 'geology.world.branchP'),
      branchPosFrac: tPair(t, 'geology.world.branchPosFrac'),
      branchLengthMi: tPair(t, 'geology.world.branchLengthMi'),
      valleyHalfWidthFt: valleyHalfWidths(t),
      barrenCreekP: tNum(t, 'geology.world.barrenCreekP'),
      barrenCreekFactor: tNum(t, 'geology.world.barrenCreekFactor'),
      noTrailCreekP: tNum(t, 'geology.world.noTrailCreekP'),
      withdrawnStretchFrac: tPair(t, 'geology.world.withdrawnStretchFrac'),
      specialStretchFrac: tPair(t, 'geology.world.specialStretchFrac'),
      benchSideP: tNum(t, 'geology.world.benchSideP'),
      benchMinHalfWidthFt: tNum(t, 'geology.world.benchMinHalfWidthFt'),
      benchStretchFrac: tPair(t, 'geology.world.benchStretchFrac'),
      benchOffsetFt: tPair(t, 'geology.world.benchOffsetFt'),
      valleyFirstRowMax: tNum(t, 'geology.world.valleyFirstRowMax'),
      valleyGapP: tNum(t, 'geology.world.valleyGapP'),
      valleyGapRows: tPair(t, 'geology.world.valleyGapRows'),
      dredgedStretchMi: tPair(t, 'geology.world.dredgedStretchMi'),
      dredgedZoneFrac: tNum(t, 'geology.world.dredgedZoneFrac'),
      dredgedShareTol: tNum(t, 'geology.world.dredgedShareTol'),
      dredgedMaxStretches: tNum(t, 'geology.world.dredgedMaxStretches'),
      familyRunParcels: tNum(t, 'geology.world.familyRunParcels'),
      junctionBoostLog: tNum(t, 'geology.world.junctionBoostLog'),
      junctionBoostRows: tNum(t, 'geology.world.junctionBoostRows'),
      proximalTopFrac: tNum(t, 'geology.world.proximalTopFrac'),
      selSlope: tNum(t, 'geology.world.selSlope'),
      selSlopeOverlooked: tNum(t, 'geology.world.selSlopeOverlooked'),
      zqNoPaystreak: tNum(t, 'geology.world.zqNoPaystreak'),
      zqLnScale: tNum(t, 'geology.world.zqLnScale'),
      trailTortuosity: tNum(t, 'geology.world.trailTortuosity'),
    },
    grade: {
      blockRangeAcrossFt: tNum(t, 'geology.grade.blockRangeAcrossFt'),
      wanderRangeFt: tNum(t, 'geology.grade.wanderRangeFt'),
      halfWidthRangeFt: tNum(t, 'geology.grade.halfWidthRangeFt'),
      obRangeFt: tNum(t, 'geology.grade.obRangeFt'),
      payRangeFt: tNum(t, 'geology.grade.payRangeFt'),
      obAxisBoost: tNum(t, 'geology.grade.obAxisBoost'),
      obAxisScaleFt: tNum(t, 'geology.grade.obAxisScaleFt'),
      pocketBcy: tPair(t, 'geology.grade.pocketBcy'),
      pocketMaxPayFrac: tNum(t, 'geology.grade.pocketMaxPayFrac'),
      pocketMultMedian: objField(pocketMult, 'median', 'geology.grade.pocketMult'),
      pocketMultSigma: objField(pocketMult, 'sigma', 'geology.grade.pocketMult'),
      pocketGradeClamp: tPair(t, 'geology.grade.pocketGradeClamp'),
      pocketStreakMinF: tNum(t, 'geology.grade.pocketStreakMinF'),
      pocketProximalMult: tNum(t, 'geology.grade.pocketProximalMult'),
      claim: claimConstants(t),
      boulderSettingMult: tTable(t, 'geology.grade.boulderSettingMult', SIZE_SETTINGS),
    },
    env: {
      channelOffsetFt: tPair(t, 'geology.env.channelOffsetFt'),
      aspectThawSlope: tNum(t, 'geology.env.aspectThawSlope'),
      aspectFrozenSlope: tNum(t, 'geology.env.aspectFrozenSlope'),
      sensitivity: sens,
    },
    oldTimer: {
      liabilityEraYear: tNum(t, 'geology.oldTimer.liabilityEraYear'),
      recentReclaimedP: tNum(t, 'geology.oldTimer.recentReclaimedP'),
      preStripP: tNum(t, 'geology.oldTimer.preStripP'),
      preStripMaxAgeYr: tNum(t, 'geology.oldTimer.preStripMaxAgeYr'),
      histRecoveryHand: tPair(t, 'geology.oldTimer.histRecoveryHand'),
      recentCapture: tNums4(t, 'geology.oldTimer.recentCapture'),
      recentOpSkill: tPair(t, 'geology.oldTimer.recentOpSkill'),
      improvementsMedianUsd: objField(improvements, 'median', 'geology.oldTimer.improvementsUsd'),
      improvementsSigma: objField(improvements, 'sigma', 'geology.oldTimer.improvementsUsd'),
      improvementsOldMult: objField(improvements, 'oldMult', 'geology.oldTimer.improvementsUsd'),
      improvementsOldYears: objField(improvements, 'oldYears', 'geology.oldTimer.improvementsUsd'),
      recentStartYear: tPair(t, 'geology.oldTimer.recentStartYear'),
      recentGapP: tNum(t, 'geology.oldTimer.recentGapP'),
      filedSeasonP: tNum(t, 'geology.oldTimer.filedSeasonP'),
      filedSeasonMinYear: tNum(t, 'geology.oldTimer.filedSeasonMinYear'),
      footprintOnRecordP: tNum(t, 'geology.oldTimer.footprintOnRecordP'),
      ...oldTimerTables(t),
    },
    permitStub: {
      minLastSeasonYear: tNum(t, 'geology.permitStub.minLastSeasonYear'),
      planP: tNum(t, 'geology.permitStub.planP'),
      noticeP: tNum(t, 'geology.permitStub.noticeP'),
      bondFrac: tPair(t, 'geology.permitStub.bondFrac'),
      rceStubUsdPerAcre: tNum(t, 'geology.permitStub.rceStubUsdPerAcre'),
    },
    records: {
      historicGradeRatio: tNum(t, 'geology.records.historicGradeRatio'),
      creekProdLogSd: tNum(t, 'geology.records.creekProdLogSd'),
      priorDrillP: tNum(t, 'geology.records.priorDrillP'),
      priorDrillHoles: tPair(t, 'geology.records.priorDrillHoles'),
      priorDrillYears: tPair(t, 'geology.records.priorDrillYears'),
      flyInQualityMult: tNum(t, 'geology.records.flyInQualityMult'),
      priorDrillMethod: readMethod(t, 'geology.method.churnHistoric', 'churnHistoric'),
    },
    sample: {
      particleMeanMg: meanMg,
      massCv: tNums4(t, 'geology.particle.massCv'),
      deWijsAlpha: tNum(t, 'geology.sample.deWijsAlpha'),
      poissonNormalLambda: tNum(t, 'geology.sample.poissonNormalLambda'),
      cltParticleThreshold: tNum(t, 'geology.sample.cltParticleThreshold'),
      frozenThreshold: tNum(t, 'geology.sample.frozenThreshold'),
      activeLayerFt: tNum(t, 'geology.sample.activeLayerFt'),
      pocketMix: tNums4(t, 'geology.sample.pocketMix'),
      exposureMaxObFt: tNum(t, 'geology.sample.exposureMaxObFt'),
      exposureDepthFrac: tNum(t, 'geology.sample.exposureDepthFrac'),
      defaultThickCv: tNum(t, 'geology.sample.defaultThickCv'),
      waterStopFt: tPair(t, 'geology.sample.waterStopFt'),
      bedrockIdP: tNum(t, 'geology.sample.bedrockIdP'),
      groundObsSd: tNum(t, 'geology.sample.groundObsSd'),
      tercileCuts: tPair(t, 'geology.sample.tercileCuts'),
      obGradeRatio: tNum(t, 'geology.vertical.obGradeRatio'),
      bedrockDecayFt: tNum(t, 'geology.vertical.bedrockDecayFt'),
      waterTableFt: tPartial(t, 'geology.sample.waterTableFt', CLIMATE_BANDS),
      waterInflowP: tPartial(t, 'geology.sample.waterInflowP', CLIMATE_BANDS),
    },
    prior: {
      statusMult: tTable(t, 'geology.prior.statusMult', STATUSES),
      paystreakShare: tTable(t, 'geology.prior.paystreakShare', SETTINGS),
      listedSigmaAdj: tNum(t, 'geology.prior.listedSigmaAdj'),
      oldWorkingsMult: workedMult,
      sizeMixJitterLogSd: tNum(t, 'geology.prior.sizeMixJitterLogSd'),
      coarseMassLogSd: tNum(t, 'geology.prior.coarseMassLogSd'),
    },
    refEcon: {
      spotUsdPerFineOz: tNum(t, 'market.openingSpotUsdPerFineOz'),
      payable: tNum(t, 'geology.refEcon.payable'),
      capture: tNums4(t, 'geology.refEcon.capture'),
      clayRecoveryPenalty: tNum(t, 'geology.refEcon.clayRecoveryPenalty'),
      stripUsd: tPartial(t, 'geology.refEcon.stripUsd', CLIMATE_BANDS),
      washUsd: tPartial(t, 'geology.refEcon.washUsd', CLIMATE_BANDS),
      devBaseUsd: tPartial(t, 'geology.refEcon.devBaseUsd', CLIMATE_BANDS),
      devPerAcreUsd: tPartial(t, 'geology.refEcon.devPerAcreUsd', CLIMATE_BANDS),
      frozenStripAdd: tNum(t, 'geology.refEcon.frozenStripAdd'),
      cementStripAdd: tNum(t, 'geology.refEcon.cementStripAdd'),
      boulderWashAdd: tNum(t, 'geology.refEcon.boulderWashAdd'),
      clayWashAdd: tNum(t, 'geology.refEcon.clayWashAdd'),
      frozenWashAdd: tNum(t, 'geology.refEcon.frozenWashAdd'),
      goodCdvUsd: tNum(t, 'geology.refEcon.goodCdvUsd'),
      goodMargin: tNum(t, 'geology.refEcon.goodMargin'),
      excellentCdvUsd: tNum(t, 'geology.refEcon.excellentCdvUsd'),
      excellentMargin: tNum(t, 'geology.refEcon.excellentMargin'),
    },
    water: {
      usableFrac: tNum(t, 'geology.water.usableFrac'),
      lowFlowShape: tPartial(t, 'geology.water.lowFlowShape', WATER_KINDS),
      rightStubP: tPartial(t, 'geology.water.rightStubP', CLIMATE_BANDS),
      rightStubGpm: tPair(t, 'geology.water.rightStubGpm'),
      benchLiftFt: tPair(t, 'geology.water.benchLiftFt'),
      nearestFillFrac: tPair(t, 'geology.water.nearestFillFrac'),
    },
    access: {
      classes: accessClasses(t),
      distExponent: tNum(t, 'geology.access.distExponent'),
      distScaleClamp: tPair(t, 'geology.access.distScaleClamp'),
      trailDegrade1Mi: tNum(t, 'geology.access.trailDegrade1Mi'),
      trailDegrade2Mi: tNum(t, 'geology.access.trailDegrade2Mi'),
    },
    seller: {
      honestyMix: tTable(t, 'geology.seller.honestyMix', HONESTY),
      honestyTilts: honestyTilts(t),
      situationMix: tTable(t, 'geology.seller.situationMix', SITUATIONS),
      groupRunP: tNum(t, 'geology.seller.groupRunP'),
      maxParcelsPerHolder: tNum(t, 'geology.seller.maxParcelsPerHolder'),
    },
    supply: {
      baseListHazard: tNum(t, 'geology.supply.baseListHazard'),
      seasonMultMean: meanSeasonMult(t),
      inflowMult: tTable(t, 'geology.supply.inflowMult', CLASSES),
      saleQualityMult: tTable(t, 'geology.supply.saleQualityMult', CLASSES),
      relistCooldownWk: tNum(t, 'geology.supply.relistCooldownWk'),
      postSaleCooldownWk: tNum(t, 'geology.supply.postSaleCooldownWk'),
    },
  };
}

function subTable(t: TuningResolved, key: TuningKey, row: string): Obj {
  const v = t[key];
  invariant(isObj(v), () => `tuning ${key} must be a table`);
  const r = v[row];
  invariant(isObj(r), () => `tuning ${key}.${row} must be a table`);
  return r;
}

function claimConstants(t: TuningResolved): ClaimGenConstants {
  const k = 'geology.grade.claim';
  const v = t[k];
  invariant(isObj(v), 'tuning geology.grade.claim must be a table');
  const f = (n: string): number => objField(v, n, k);
  return {
    decayJitter: [f('decayJitterLo'), f('decayJitterHi')],
    frozenDegree: [f('frozenDegreeLo'), f('frozenDegreeHi')],
    frozenMaxP: f('frozenMaxP'),
    clayLogSd: f('clayLogSd'),
    boulderLogSd: f('boulderLogSd'),
    cementLogSd: f('cementLogSd'),
    blockMixJitterLogSd: f('blockMixJitterLogSd'),
    coarseStreakThin: f('coarseStreakThin'),
    blockFinenessSd: f('blockFinenessSd'),
    permafrostBlockSd: f('permafrostBlockSd'),
    unfrozenSubarcticMax: f('unfrozenSubarcticMax'),
    groundBlockSd: f('groundBlockSd'),
    clayFalseMinClay: f('clayFalseMinClay'),
    bedrockJitter: [f('bedrockJitterLo'), f('bedrockJitterHi')],
    payStreakWeight: f('payStreakWeight'),
    maxOverburdenFt: f('maxOverburdenFt'),
    minPayFt: f('minPayFt'),
    maxPayFt: f('maxPayFt'),
  };
}

function oldTimerTables(t: TuningResolved): Pick<
  GeoGenParams['oldTimer'],
  | 'kinds'
  | 'driftBottom'
  | 'dredgeEffects'
  | 'maxExtraction'
  | 'depleteCap'
  | 'depleteWeights'
  | 'pileBcy'
  | 'pileMix'
  | 'preStripBlocks'
  | 'preStripThawFt'
> {
  const kk = 'geology.oldTimer.kinds';
  const row = (name: string) => {
    const r = subTable(t, kk, name);
    return (field: string): number => objField(r, field, `${kk}.${name}`);
  };
  const drift = row('drift');
  const handCut = row('handCut');
  const dredge = row('dredge');
  const dryWash = row('dryWash');
  const hydraulic = row('hydraulic');
  const recent = row('recentCat');
  const db = 'geology.oldTimer.driftBottom';
  const dbv = t[db];
  invariant(isObj(dbv), 'tuning geology.oldTimer.driftBottom must be a table');
  const de = 'geology.oldTimer.dredgeEffects';
  const dev = t[de];
  invariant(isObj(dev), 'tuning geology.oldTimer.dredgeEffects must be a table');
  const dw = 'geology.oldTimer.depleteWeights';
  const dwv = t[dw];
  invariant(isObj(dwv), 'tuning geology.oldTimer.depleteWeights must be a table');
  const hand = numArray(dwv['hand'], 4, `${dw}.hand`);
  const dredgeW = numArray(dwv['dredge'], 4, `${dw}.dredge`);
  const pb = 'geology.oldTimer.pileBcy';
  const pbv = t[pb];
  invariant(isObj(pbv), 'tuning geology.oldTimer.pileBcy must be a table');
  const p = (n: string): number => objField(pbv, n, pb);
  return {
    kinds: {
      drift: {
        era: [drift('eraLo'), drift('eraHi')],
        top: [drift('topLo'), drift('topHi')],
        workP: drift('workP'),
        extract: [drift('extractLo'), drift('extractHi')],
      },
      handCut: {
        era: [handCut('eraLo'), handCut('eraHi')],
        top: handCut('top'),
        maxObFt: handCut('maxObFt'),
        extract: [handCut('extractLo'), handCut('extractHi')],
      },
      dredge: {
        era: [dredge('eraLo'), dredge('eraHi')],
        minF: dredge('minF'),
        extract: [dredge('extractLo'), dredge('extractHi')],
      },
      dryWash: {
        era: [dryWash('eraLo'), dryWash('eraHi')],
        top: dryWash('top'),
        extract: [dryWash('extractLo'), dryWash('extractHi')],
      },
      hydraulic: {
        era: [hydraulic('eraLo'), hydraulic('eraHi')],
        extract: [hydraulic('extractLo'), hydraulic('extractHi')],
        obMult: hydraulic('obMult'),
      },
      recentCat: {
        top: [recent('topLo'), recent('topHi')],
        seasonBlocks: [recent('seasonBlocksLo'), recent('seasonBlocksHi')],
        pile: [recent('pileLo'), recent('pileHi')],
      },
    },
    driftBottom: {
      topFt: objField(dbv, 'topFt', db),
      bedrockFt: objField(dbv, 'bedrockFt', db),
      decayMult: objField(dbv, 'decayMult', db),
      bedrockShareMult: objField(dbv, 'bedrockShareMult', db),
    },
    dredgeEffects: {
      boulderMult: objField(dev, 'boulderMult', de),
      decayFt: objField(dev, 'decayFt', de),
      minBedrockShare: objField(dev, 'minBedrockShare', de),
    },
    maxExtraction: tNum(t, 'geology.oldTimer.maxExtraction'),
    depleteCap: tNum(t, 'geology.oldTimer.depleteCap'),
    depleteWeights: {
      hand: [hand[0] as number, hand[1] as number, hand[2] as number, hand[3] as number],
      dredge: [dredgeW[0] as number, dredgeW[1] as number, dredgeW[2] as number, dredgeW[3] as number],
    },
    pileBcy: {
      driftFt: p('driftFt'),
      drift: [p('driftLo'), p('driftHi')],
      handCut: [p('handCutLo'), p('handCutHi')],
      dryWashFt: p('dryWashFt'),
      dryWash: [p('dryWashLo'), p('dryWashHi')],
    },
    pileMix: tNums4(t, 'geology.oldTimer.pileMix'),
    preStripBlocks: tPair(t, 'geology.oldTimer.preStripBlocks'),
    preStripThawFt: tPair(t, 'geology.oldTimer.preStripThawFt'),
  };
}

/**
 * Mean of §3.11's listing season multiplier over a 52-week year: weeks 40–52 and 1–12 off-season, 13–20 pre-season,
 * 21–39 in season ((25 × 1.4 + 8 × 1.2 + 19 × 0.6) / 52 = 1.077).
 */
function meanSeasonMult(t: TuningResolved): number {
  const s = tTable(t, 'geology.supply.seasonMult', ['offSeason', 'preSeason', 'inSeason'] as const);
  return (25 * s.offSeason + 8 * s.preSeason + 19 * s.inSeason) / 52;
}

/** The template a world's district was generated from (from the snapshot). */
export function templateOf(gp: GeoGenParams, id: RegionTemplateId): RegionTemplate {
  const tpl = gp.templates[id];
  invariant(tpl !== undefined, () => `world genParams has no template '${id}'`);
  return tpl;
}

/** A per-climate-band value from a snapshot table (a missing band is a data gap for that template). */
export function byBand(table: Readonly<Partial<Record<ClimateBand, number>>>, band: ClimateBand, what: string): number {
  const v = table[band];
  invariant(v !== undefined, () => `${what} has no value for climate band '${band}'`);
  return v;
}
