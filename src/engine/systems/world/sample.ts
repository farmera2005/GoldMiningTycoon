// The sample-draw model (DESIGN §3.8): a compound-Poisson particle draw on a block's true geology. Pans and drill
// holes are dominated by the nugget effect; bulk samples converge. Pure: it never mutates state; the caller (§4)
// applies extractedBcy to Block.state and posts sampleGoldLines. The stream is the caller's (§4's 'sample' stream for
// the player and competitors, §3's 'world' for pre-game logs).
//
// Draw order (fixed; every draw is taken on every path so one sample's draw count never depends on its outcome):
//   pit mode only: water-inflow u, water stop U;  then local Z, pocket u;
//   per size class (coarse → ultrafine): Poisson (2 u32), then N particle masses (N ≤ clt) or one CLT normal;
//   volume noise, weigh noise; overburden, depth and thickness logging noise; bedrock-id u, bedrock-pick int;
//   clay N, boulders N.
import { EngineGuardError } from '../../core/assert';
import { exp, log, sqrt } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { BCY_PER_ACRE_FT, MG_PER_OZ } from './constants';
import { BEDROCK_TYPES } from './enums';
import { byBand } from './params';
import { lnMeanOne, lnMeanOneVar, poissonSwitch, uniformIn } from './random';
import type {
  BedrockType,
  BlockState,
  BlockTruth,
  DrawContext,
  SampleGoldLines,
  SampleMethodParams,
  SampleRequest,
  SampleResult,
  SizeRecord,
  Tercile,
} from './types';
import { positionMultProfile, profileOf } from './vertical';

/** A block nobody has touched (blockStates is sparse, §3.5.1). */
export const UNTOUCHED_BLOCK: BlockState = {
  strippedBcy: 0,
  minedBcy: 0,
  sampledBcy: 0,
  oldTailingsTakenBcy: 0,
  disturbed: false,
  disturbanceOrigin: 'player',
  reclaimed: false,
  thawProgress: 0,
};

export type DrawSampleErrorCode = 'NO_TAILINGS' | 'BAD_VOLUME';

/** A request §4's validator should have rejected (an engine bug, not a game outcome). */
export class DrawSampleError extends EngineGuardError {
  constructor(code: DrawSampleErrorCode, message: string) {
    super(code, message);
    this.name = 'DrawSampleError';
  }
}

type Stop = SampleResult['stopReason'];

/** Where in the column the sample comes from (§3.8 steps 1–2), in ft above the bedrock surface. */
export interface SampleInterval {
  readonly kind: 'inSitu' | 'overburden' | 'tailings';
  readonly h1: number;
  readonly h2: number;
  readonly stopReason: Stop;
  readonly bottomBelowSurfaceFt: number | null;
  readonly obNowFt: number;
  readonly depthToBedrockFt: number;
}

/**
 * Steps 1–2 of the algorithm. `waterU` and `waterStopFt` are the pit-mode draws (pass anything for other modes).
 * Exported for tests: the interval and the position multiplier are the testable heart of the position effects.
 */
export function sampleInterval(
  bt: BlockTruth,
  bs: BlockState,
  req: SampleRequest,
  m: SampleMethodParams,
  ctx: DrawContext,
  waterU: number,
  waterStopFt: number,
): SampleInterval {
  const P = ctx.physics;
  const T = bt.payThicknessFt;
  const B = bt.bedrockCleanupFt;
  const obNowFt = Math.max(0, bt.overburdenFt - bs.strippedBcy / BCY_PER_ACRE_FT);
  const depth = obNowFt + T;
  const base = { obNowFt, depthToBedrockFt: depth };
  if (req.target === 'oldTailings') {
    return { ...base, kind: 'tailings', h1: 0, h2: 0, stopReason: 'none', bottomBelowSurfaceFt: null };
  }
  const face = (): [number, number] => {
    const iv = req.interval;
    return iv !== undefined ? [iv.h1, iv.h2] : [-Math.min(B, m.bedrockPenFt), T];
  };
  let h1: number;
  let h2 = T;
  let stop: Stop = 'none';
  let bottom: number | null = null;
  switch (m.positionMode) {
    case 'exposure': {
      if (req.fromOpenCut === true || obNowFt <= P.exposureMaxObFt) {
        [h1, h2] = face();
      } else if (ctx.surface === 'c') {
        // A cutbank or bar on the active channel: the natural exposure of the gravel top (D-3.25).
        h1 = T * (1 - (m.exposureDepthFrac ?? P.exposureDepthFrac));
      } else {
        return { ...base, kind: 'overburden', h1: T, h2: T, stopReason: 'none', bottomBelowSurfaceFt: null };
      }
      break;
    }
    case 'pit': {
      const frozenLimit =
        bt.permafrost >= P.frozenThreshold && !m.frozenOk ? Math.max(P.activeLayerFt, bs.thawProgress) : Infinity;
      const reach = m.maxDepthFt ?? Infinity;
      const full = depth + m.bedrockPenFt;
      let b = Math.min(reach, frozenLimit, full);
      if (b < full) stop = reach <= frozenLimit ? 'reach' : 'frozen';
      const waterTable = byBand(P.waterTableFt, ctx.climateBand, 'geology.sample.waterTableFt');
      const inflowP = byBand(P.waterInflowP, ctx.climateBand, 'geology.sample.waterInflowP');
      if (bt.permafrost < P.frozenThreshold && depth > waterTable && waterU < inflowP) {
        const wb = depth - waterStopFt;
        if (wb < b) {
          b = wb;
          stop = 'water';
        }
      }
      bottom = Math.max(0, b);
      h1 = depth - bottom;
      if (h1 >= T) return { ...base, kind: 'overburden', h1: T, h2: T, stopReason: stop, bottomBelowSurfaceFt: bottom };
      break;
    }
    case 'fullColumn': {
      h1 = -Math.min(B, m.bedrockPenFt);
      const reach = m.maxDepthFt ?? Infinity;
      if (depth - h1 > reach) {
        h1 = depth - reach;
        stop = 'reach';
      }
      bottom = depth - h1;
      if (h1 >= T) return { ...base, kind: 'overburden', h1: T, h2: T, stopReason: stop, bottomBelowSurfaceFt: bottom };
      break;
    }
    case 'interval':
      [h1, h2] = face();
      break;
  }
  h1 = Math.max(h1, -B);
  h2 = Math.min(h2, T);
  if (!(h2 > h1)) return { ...base, kind: 'overburden', h1: T, h2: T, stopReason: stop, bottomBelowSurfaceFt: bottom };
  return { ...base, kind: 'inSitu', h1, h2, stopReason: stop, bottomBelowSurfaceFt: bottom };
}

function tercile(x: number, cuts: readonly [number, number]): Tercile {
  return x < cuts[0] ? 'low' : x < cuts[1] ? 'med' : 'high';
}

function record(a: readonly number[]): SizeRecord {
  return { coarse: a[0] as number, medium: a[1] as number, fine: a[2] as number, ultrafine: a[3] as number };
}

/** drawSample(bt, bs, req, method, rng, ctx) (§3.8, D-3.34). */
export function drawSample(
  bt: BlockTruth,
  bs: BlockState,
  req: SampleRequest,
  m: SampleMethodParams,
  rng: Rng,
  ctx: DrawContext,
): SampleResult {
  const P = ctx.physics;
  const V = req.volumeBcy;
  if (!(V > 0) || !Number.isFinite(V)) throw new DrawSampleError('BAD_VOLUME', `drawSample: volume must be > 0, got ${V}`);
  const pile = bt.oldTailings;
  if (req.target === 'oldTailings' && pile === undefined) {
    throw new DrawSampleError('NO_TAILINGS', 'drawSample: the block has no old tailings pile');
  }

  // Steps 1–2 (pit mode takes its two water draws first).
  const isPit = m.positionMode === 'pit' && req.target !== 'oldTailings';
  const waterU = isPit ? rng.next() : 1;
  const waterStopFt = isPit ? uniformIn(rng, P.waterStopFt) : 0;
  const iv = sampleInterval(bt, bs, req, m, ctx, waterU, waterStopFt);

  // Step 3–4: position, local variability and pockets.
  const zLocal = rng.normal();
  const pocketU = rng.next();
  const sizeMix = iv.kind === 'tailings' && pile !== undefined ? pile.sizeMix : bt.sizeMix;
  let mixLoc = [sizeMix.coarse, sizeMix.medium, sizeMix.fine, sizeMix.ultrafine];
  let gLoc: number;
  let accountingGrade: number;
  if (iv.kind === 'overburden') {
    // Trace colours from the overburden (§3.5.4): not contained gold, books nothing.
    gLoc = P.obGradeRatio * bt.gradeOzPerBcy;
    accountingGrade = 0;
  } else if (iv.kind === 'tailings' && pile !== undefined) {
    const Vb = Math.max(1e-9, pile.bcy - bs.oldTailingsTakenBcy);
    const s2 = V < Vb ? P.deWijsAlpha * log(Vb / V) : 0;
    gLoc = pile.gradeOzPerBcy * expMeanOne(s2, zLocal);
    accountingGrade = pile.gradeOzPerBcy;
  } else {
    const posMult = positionMultProfile(profileOf(bt, P.bedrockDecayFt), iv.h1, iv.h2);
    const Vb = (bt.payThicknessFt + bt.bedrockCleanupFt) * BCY_PER_ACRE_FT;
    const g = bt.gradeOzPerBcy;
    const pocket = bt.pocket;
    const gMatrix = pocket !== undefined ? Math.max(0, (g * Vb - pocket.bcy * pocket.gradeOzPerBcy) / (Vb - pocket.bcy)) : g;
    const s2 = V < Vb ? P.deWijsAlpha * log(Vb / V) : 0;
    gLoc = gMatrix * posMult * expMeanOne(s2, zLocal);
    if (pocket !== undefined && pocketU < Math.min(1, (pocket.bcy + V) / Vb)) {
      const phi = Math.min(1, pocket.bcy / V);
      gLoc = (1 - phi) * gLoc + phi * pocket.gradeOzPerBcy * posMult;
      mixLoc = mixLoc.map((x, k) => (1 - phi) * x + phi * (P.pocketMix[k] as number));
    }
    accountingGrade = g;
  }

  // Step 5: compound Poisson per class.
  const meanMg = [bt.coarseMeanMg, P.particleMeanMg[0], P.particleMeanMg[1], P.particleMeanMg[2]];
  const counts: number[] = [];
  const drawnMg: number[] = [];
  for (let k = 0; k < 4; k++) {
    const mk = meanMg[k] as number;
    const ck = P.massCv[k] as number;
    const lambda = (gLoc * V * (mixLoc[k] as number) * MG_PER_OZ) / mk;
    const N = poissonSwitch(rng, lambda, P.poissonNormalLambda);
    let M = 0;
    if (N <= P.cltParticleThreshold) {
      const s2 = log(1 + ck * ck);
      for (let i = 0; i < N; i++) M += mk * lnMeanOneVar(rng, s2);
    } else {
      M = Math.max(0, N * mk + sqrt(N) * mk * ck * rng.normal());
    }
    counts.push(N);
    drawnMg.push(M);
  }

  // Step 6: capture and measurement.
  const capMult = req.samplerCaptureMult ?? 1;
  const cap = [m.captureBySize.coarse, m.captureBySize.medium, m.captureBySize.fine, m.captureBySize.ultrafine].map(
    (c) => Math.min(1, c * capMult),
  );
  const keptMg = drawnMg.map((M, k) => M * (cap[k] as number));
  const keptTotal = keptMg.reduce((a, x) => a + x, 0);
  const drawnTotal = drawnMg.reduce((a, x) => a + x, 0);
  const vNoise = lnMeanOne(rng, m.volumeCv);
  const wNoise = lnMeanOne(rng, m.weighCv);
  const Vmeas = V * vNoise;
  const Wmeas = keptTotal * wNoise;
  const reported = (Wmeas / MG_PER_OZ / Vmeas) * m.biasMult;

  // Step 7: observations (only what the sampler could see).
  const obNoise = lnMeanOne(rng, m.geomCv);
  const depthNoise = lnMeanOne(rng, m.geomCv);
  const thickNoise = lnMeanOne(rng, m.thickCv ?? P.defaultThickCv);
  const bedrockU = rng.next();
  const others = BEDROCK_TYPES.filter((b) => b !== bt.bedrockType);
  const otherPick = rng.int(0, others.length - 1);
  const clayN = rng.normal(0, P.groundObsSd);
  const bouldersN = rng.normal(0, P.groundObsSd);

  const inSitu = iv.kind === 'inSitu';
  const reachedPay = inSitu;
  const reachedBedrock = inSitu && iv.h1 <= 0;
  const observed: {
    -readonly [K in keyof SampleResult['observed']]: SampleResult['observed'][K];
  } = {
    permafrost: iv.kind !== 'tailings' && bt.permafrost >= P.frozenThreshold && iv.h1 < bt.payThicknessFt,
    clay: tercile(bt.clay + clayN, P.tercileCuts),
    boulders: tercile(bt.boulders + bouldersN, P.tercileCuts),
  };
  if (reachedPay) observed.overburdenFt = iv.obNowFt * obNoise;
  if (reachedBedrock) {
    observed.depthToBedrockFt = iv.depthToBedrockFt * depthNoise;
    observed.payThicknessFt = bt.payThicknessFt * thickNoise;
    const logged: BedrockType = bedrockU < P.bedrockIdP ? bt.bedrockType : (others[otherPick] as BedrockType);
    observed.bedrockType = logged;
  }
  const reportsMasses = m.reportsClassMasses ?? m.positionMode === 'pit';
  const booked = iv.kind !== 'overburden';
  return {
    blockId: req.blockId,
    methodId: m.id,
    volumeBcy: V,
    volumeMeasuredBcy: Vmeas,
    intervalDepthFt: inSitu ? [iv.depthToBedrockFt - iv.h2, iv.depthToBedrockFt - iv.h1] : null,
    reachedPay,
    reachedBedrock,
    stopReason: iv.stopReason,
    reportedGradeOzPerBcy: reported,
    recoveredMg: Wmeas,
    colorsBySize: record(counts.map((n, k) => Math.round(n * (cap[k] as number)))),
    massBySizeMg: reportsMasses ? record(keptMg.map((x) => x * wNoise)) : null,
    observed,
    extractedBcy: booked ? V : 0,
    hidden: {
      drawnRawOz: booked ? drawnTotal / MG_PER_OZ : 0,
      recoveredRawOz: booked ? keptTotal / MG_PER_OZ : 0,
      accountingRawOz: accountingGrade * V,
    },
  };
}

/** The mean-one lognormal factor e^(σZ − σ²/2) from an already-drawn Z (1 when σ² = 0). */
function expMeanOne(s2: number, z: number): number {
  return s2 > 0 ? exp(sqrt(s2) * z - s2 / 2) : 1;
}

/**
 * Splits a sample's accounting gold exactly into §2.14's sample lines (§3.8 sampleGoldLines, D-3.37):
 * accounting = credited + captureLoss + processingLoss + samplingVariance. Credited samples (pits, trenches, bulk)
 * keep their concentrate; pans and drill holes do not. Overburden-only results book all zeros.
 */
export function sampleGoldLines(result: SampleResult, credited: boolean): SampleGoldLines {
  const h = result.hidden;
  const sampleCaptureLoss = h.drawnRawOz - h.recoveredRawOz;
  const creditedRawOz = credited ? h.recoveredRawOz : 0;
  const sampleProcessingLoss = credited ? 0 : h.recoveredRawOz;
  const samplingVariance = h.accountingRawOz - h.drawnRawOz;
  return { accountingRawOz: h.accountingRawOz, creditedRawOz, sampleCaptureLoss, sampleProcessingLoss, samplingVariance };
}
