// Sample execution (DESIGN §4.3): the only §4 code that reads truth. It turns one completed unit of a program (or a
// calibration draw) into a SampleRecord: caving and boulder stops, false bedrock, the method row at the logger's TRUE
// skill (D-4.9), §3's drawSample, and the log the player sees. Streams: execution rolls on
// rng(seed,'prospect',claimId,blockId,methodId,k), §3's draw on rng(seed,'sample',claimId,blockId,methodId,k), so the
// week, the program and other claims never change what a given pit finds (D-4.21).
import type { TuningKey, TuningResolved } from '../../../data/tuning';
import { invariant } from '../../core/assert';
import { exp, log, sqrt } from '../../core/dmath';
import type { BlockId, ClaimId, EmployeeId, ProgramId, SampleId } from '../../core/ids';
import { rng } from '../../core/rng';
import { BCY_PER_ACRE_FT, MG_PER_OZ } from '../world/constants';
import { drawSample, sampleGoldLines } from '../world/sample';
import type {
  BlockState,
  BlockTruth,
  DrawContext,
  SampleGoldLines,
  SampleRequest,
  SampleResult,
  SizeRecord,
} from '../world/types';
import { effectiveDrawParams, methodSpec, noiseMult, samplerCaptureMult, type LoggingRules } from './methods';
import type { LoggedBy, MethodId, SampleFlag, SampleInterval, SampleRecord } from './types';

export interface ExecutionParams extends LoggingRules {
  readonly pitStopBase: number;
  readonly pitStopBoulder: number;
  /** Difficulty knob (§1 1.11) times the event hook prospect.pitStopProbMult (P0: 1). */
  readonly pitStopMult: number;
  readonly falseBedrockGeoBase: number;
  readonly falseBedrockGeoPerSkill: number;
  readonly unloggedFalseBedrockMult: number;
}

function num(t: TuningResolved, key: TuningKey): number {
  const v = t[key];
  invariant(typeof v === 'number' && Number.isFinite(v), () => `tuning ${key} must be a number`);
  return v;
}

/** `hookPitStopMult` is effective('prospect.pitStopProbMult') read by the caller (P0 has no events: 1). */
export function executionParams(t: TuningResolved, hookPitStopMult = 1): ExecutionParams {
  return {
    pitStopBase: num(t, 'geology.pitStopBase'),
    pitStopBoulder: num(t, 'geology.pitStopBoulder'),
    pitStopMult: num(t, 'geology.pitStopMult') * hookPitStopMult,
    falseBedrockGeoBase: num(t, 'geology.falseBedrockGeoBase'),
    falseBedrockGeoPerSkill: num(t, 'geology.falseBedrockGeoPerSkill'),
    unloggedFalseBedrockMult: num(t, 'geology.unloggedFalseBedrockMult'),
    geoNoiseMultBase: num(t, 'geology.geoNoiseMultBase'),
    geoNoiseMultPerSkill: num(t, 'geology.geoNoiseMultPerSkill'),
    unloggedNoiseMult: num(t, 'geology.unloggedNoiseMult'),
    unloggedCaptureMult: num(t, 'geology.unloggedCaptureMult'),
  };
}

export interface Logger {
  readonly kind: LoggedBy['kind'];
  /** Drives the draw (hidden for staff). */
  readonly trueSkill: number;
  /** What the record shows and the estimator uses (résumé midpoint). */
  readonly shownSkill: number;
  readonly employeeId?: EmployeeId;
}

export interface ExecuteRequest {
  readonly seed: string;
  readonly sampleId: SampleId;
  readonly claimId: ClaimId;
  readonly blockId: BlockId;
  readonly methodId: MethodId;
  /** Per-block, per-method draw index (knowledge.drawIndex, §4.3). */
  readonly k: number;
  readonly turn: number;
  readonly availableTurn?: number;
  readonly programId?: ProgramId;
  /** Sample volume for fixed, choice and range methods (default: the row's); drills take theirs from the column. */
  readonly volumeBcy?: number;
  /** §9 reachFt of the excavator for machine-limited methods. */
  readonly machineReachFt?: number;
  /** Bulk samples: the plan's bedrock cleanup, ft. */
  readonly bedrockPenFt?: number;
  readonly logger: Logger;
  /** Old tailings piles are sampled with target 'oldTailings' (P2). */
  readonly target?: 'inSitu' | 'oldTailings';
  /** Gold from ground the player does not hold stays with the seller (§4.12): booked as processing loss. */
  readonly creditable?: boolean;
}

export interface ExecuteResult {
  readonly record: SampleRecord;
  readonly result: SampleResult;
  /** Pay bcy to add to Block.state.sampledBcy (§4.3 step 5). */
  readonly extractedBcy: number;
  readonly credited: boolean;
  readonly goldLines: SampleGoldLines;
}

/** LNmean(1, cv) = e^(σZ − σ²/2) from an already-drawn Z (§3.8). */
function lnMeanOneOf(z: number, cv: number): number {
  const s2 = log(1 + cv * cv);
  return exp(sqrt(s2) * z - s2 / 2);
}

/** Storage rounding (§4.3): masses to 0.01 mg, volumes to 0.001 bcy, depths to 0.01 ft. */
function round(x: number, dp: 2 | 3): number {
  const f = dp === 2 ? 100 : 1000;
  return Math.round(x * f) / f;
}

function roundRecord(r: SizeRecord, dp: 2 | 3): SizeRecord {
  return {
    coarse: round(r.coarse, dp),
    medium: round(r.medium, dp),
    fine: round(r.fine, dp),
    ultrafine: round(r.ultrafine, dp),
  };
}

export function executeSample(
  bt: BlockTruth,
  bs: BlockState,
  ctx: DrawContext,
  req: ExecuteRequest,
  ep: ExecutionParams,
): ExecuteResult {
  const spec = methodSpec(req.methodId);
  const draw = spec.draw;
  if (draw === null) throw new RangeError(`executeSample: ${req.methodId} is not a sampling method`);
  const P = ctx.physics;
  const rp = rng(req.seed, 'prospect', req.claimId, req.blockId, req.methodId, req.k);
  const rs = rng(req.seed, 'sample', req.claimId, req.blockId, req.methodId, req.k);
  // Execution draws, always taken in this order (§2.3 rule e).
  const uStop = rp.next();
  const uStopDepth = rp.next();
  const uFb = rp.next();
  const uFbHeight = rp.next();
  const zFbDepth = rp.normal();
  const zFbThick = rp.normal();

  const T = bt.payThicknessFt;
  const B = bt.bedrockCleanupFt;
  const obNow = Math.max(0, bt.overburdenFt - bs.strippedBcy / BCY_PER_ACRE_FT);
  const D = obNow + T;
  const tailings = req.target === 'oldTailings';
  let reach: number | null = spec.depthLimit === 'machineReach' ? (req.machineReachFt ?? null) : draw.maxDepthFt;
  invariant(spec.depthLimit !== 'machineReach' || reach !== null, 'executeSample: machine reach required');

  // 1. Caving and boulder stops (pits and trenches, §4.3).
  const pitLike = spec.family === 'pit' || spec.family === 'trench' || spec.family === 'handPit';
  if (pitLike && !tailings) {
    const pStop = (ep.pitStopBase + ep.pitStopBoulder * bt.boulders) * ep.pitStopMult;
    if (uStop < pStop) reach = Math.min(reach ?? Infinity, D * (0.5 + 0.5 * uStopDepth));
  }
  const pen = req.bedrockPenFt ?? draw.bedrockPenFt;
  const nm = noiseMult(req.logger.kind, req.logger.trueSkill, ep);
  const params = effectiveDrawParams(draw, nm, { maxDepthFt: reach, bedrockPenFt: pen });

  // Sample volume: drills take bcyPerFt over the pay column the hole crossed (§4.2.B).
  const frozenLimit =
    bt.permafrost >= P.frozenThreshold && !draw.frozenOk ? Math.max(P.activeLayerFt, bs.thawProgress) : Infinity;
  const bottomLimit = Math.min(reach ?? Infinity, frozenLimit, D + pen);
  let volume: number;
  switch (spec.sampleBcy.kind) {
    case 'fixed':
      volume = req.volumeBcy ?? spec.sampleBcy.bcy;
      break;
    case 'choices':
    case 'range':
      volume = req.volumeBcy ?? spec.sampleBcy.defaultBcy;
      break;
    case 'perFtOfColumn': {
      const column = Math.min(Math.max(0, bottomLimit - obNow), T + Math.min(B, pen));
      volume = spec.sampleBcy.bcyPerFt * Math.max(column, 1);
      break;
    }
    case 'none':
      throw new RangeError(`executeSample: ${req.methodId} has no sample volume`);
  }

  // 2. False bedrock: the sample stops on a clay layer partway up the gravel and logs it as bedrock.
  const geoFB =
    req.logger.kind === 'none'
      ? ep.unloggedFalseBedrockMult
      : ep.falseBedrockGeoBase - ep.falseBedrockGeoPerSkill * req.logger.trueSkill;
  const pFB = spec.falseBedrockP * (0.5 + bt.clay) * geoFB;
  const hFb = T * (0.2 + 0.5 * uFbHeight);
  const falseBedrock = !tailings && spec.falseBedrockP > 0 && uFb < pFB && D - bottomLimit <= hFb;

  const sreq: SampleRequest = {
    blockId: req.blockId,
    volumeBcy: volume,
    ...(tailings ? { target: 'oldTailings' as const } : {}),
    ...(falseBedrock ? { interval: { h1: hFb, h2: T } } : {}),
    samplerCaptureMult: samplerCaptureMult(req.logger.kind, ep),
  };
  const drawParams = falseBedrock ? { ...params, positionMode: 'interval' as const } : params;
  const result = drawSample(bt, bs, sreq, drawParams, rs, ctx);

  // 3. The log.
  const inSitu = result.reachedPay;
  let interval: SampleInterval;
  if (tailings) interval = 'tailings';
  else if (!inSitu) interval = 'overburdenOnly';
  else if (falseBedrock || result.reachedBedrock) interval = 'fullColumn';
  else if (draw.positionMode === 'exposure') interval = 'exposure';
  else interval = 'upperPay';
  const bedrockLogged = interval === 'fullColumn';
  let depthReached: number;
  if (falseBedrock) depthReached = D - hFb;
  else if (result.intervalDepthFt !== null) depthReached = result.intervalDepthFt[1];
  else depthReached = draw.positionMode === 'exposure' ? 0 : Math.max(0, bottomLimit);
  const o = result.observed;
  const observed: SampleRecord['observed'] = {
    ...(o.overburdenFt !== undefined ? { overburdenFt: round(o.overburdenFt, 2) } : {}),
    ...(falseBedrock
      ? {
          depthToBedrockFt: round((obNow + T - hFb) * lnMeanOneOf(zFbDepth, params.geomCv), 2),
          payThicknessFt: round((T - hFb) * lnMeanOneOf(zFbThick, params.thickCv ?? P.defaultThickCv), 2),
        }
      : {
          ...(o.depthToBedrockFt !== undefined ? { depthToBedrockFt: round(o.depthToBedrockFt, 2) } : {}),
          ...(o.payThicknessFt !== undefined ? { payThicknessFt: round(o.payThicknessFt, 2) } : {}),
          ...(o.bedrockType !== undefined ? { bedrockType: o.bedrockType } : {}),
        }),
    permafrost: o.permafrost,
    clay: o.clay,
    boulders: o.boulders,
    waterInflow: result.stopReason === 'water',
    oldWorkings: inSitu && interval !== 'exposure' && bt.minedOutFraction > 0,
  };
  const massMg = result.massBySizeMg === null ? null : roundRecord(result.massBySizeMg, 2);
  const recoveredMg = round(result.recoveredMg, 2);
  const volumeBcy = round(result.volumeMeasuredBcy, 3);
  const cap = draw.captureBySize;
  const nc =
    massMg === null ? 0 : massMg.medium / cap.medium + massMg.fine / cap.fine + massMg.ultrafine / cap.ultrafine;
  const flags: SampleFlag[] = [];
  if (inSitu && !bedrockLogged && interval !== 'exposure') flags.push('shortOfBedrock');
  if (!(recoveredMg > 0)) flags.push('blank');
  if (result.colorsBySize.coarse > 0 && massMg === null) flags.push('nuggetHit');
  const credited = spec.credited && (req.creditable ?? true);
  const record: SampleRecord = {
    id: req.sampleId,
    claimId: req.claimId,
    blockId: req.blockId,
    methodId: req.methodId,
    ...(req.programId !== undefined ? { programId: req.programId } : {}),
    drawIndex: req.k,
    source: 'own',
    turn: req.turn,
    availableTurn: req.availableTurn ?? req.turn + spec.resultLagWeeks,
    volumeBcy,
    interval,
    bedrockLogged,
    depthReachedFt: round(depthReached, 2),
    ...(req.bedrockPenFt !== undefined ? { bedrockPenFt: req.bedrockPenFt } : {}),
    observed,
    colours: result.colorsBySize,
    massMg,
    recoveredMg,
    headGradeOzPerBcy: result.reportedGradeOzPerBcy,
    ncGradeOzPerBcy: volumeBcy > 0 ? nc / MG_PER_OZ / volumeBcy : 0,
    loggedBy: {
      kind: req.logger.kind,
      shownSkill: req.logger.shownSkill,
      ...(req.logger.employeeId !== undefined ? { employeeId: req.logger.employeeId } : {}),
    },
    flags,
  };
  return { record, result, extractedBcy: result.extractedBcy, credited, goldLines: sampleGoldLines(result, credited) };
}
