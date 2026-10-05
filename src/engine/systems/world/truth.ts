// Claim truth generation (DESIGN §3.5.3): the district → creek → claim → block lognormal hierarchy, the paystreak
// overlap, a separable AR(1) block field, ground conditions and rare rich pockets. Stream: rng(seed,'world',D.id,K.id).
// Draw order (fixed): claimGrade, claimOb, bedrock type, 4 size-mix jitters, coarse mass, claim fineness, λg jitter,
// frozen u, frozen degree, clay, boulders, cementation; the z field (nAcross normals per row, row-major); then per block
// (row-major): OB, T, Bc, s_b, pocket u, pocket bcy, pocket mult, 4 size jitters, fineness, permafrost N, permafrost u,
// clay N, boulders N, cementation N.
import { exp, sqrt } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { BCY_PER_ACRE_FT, BLOCK_FT, HALF_BLOCK_FT } from './constants';
import { BEDROCK_TYPES } from './enums';
import type { CreekProfile, GenClaim, GenCreek, GenDistrict } from './genTypes';
import { clamp, lnMedian, pickKey, uniformIn } from './random';
import type { BedrockType, BlockTruth, GeoGenParams, SizeRecord } from './types';

export type Mix4 = [number, number, number, number];

/** Mutable block truth used during generation; gStreak is transient (never stored). */
export interface WorkBlock {
  readonly i: number;
  readonly j: number;
  gStreak: number;
  overburdenFt: number;
  payThicknessFt: number;
  bedrockCleanupFt: number;
  gradeOzPerBcy: number;
  virginGradeOzPerBcy: number;
  mix: Mix4;
  fineness: number;
  permafrost: number;
  clay: number;
  boulders: number;
  cementation: number;
  bedrockType: BedrockType;
  bedrockGoldShare: number;
  verticalDecayFt: number;
  paystreakFraction: number;
  minedOutFraction: number;
  pocket: { bcy: number; gradeOzPerBcy: number } | null;
  oldTailings: { bcy: number; gradeOzPerBcy: number; mix: Mix4 } | null;
}

export interface ClaimTruthGen {
  readonly coarseMeanMg: number;
  readonly blocks: WorkBlock[];
}

/** Share of a 209-ft block width inside the paystreak [−h, h], for a block centred d ft from the centreline (§3.5.3). */
export function overlap(d: number, halfWidthFt: number): number {
  const lo = Math.max(d - HALF_BLOCK_FT, -halfWidthFt);
  const hi = Math.min(d + HALF_BLOCK_FT, halfWidthFt);
  return Math.max(0, hi - lo) / BLOCK_FT;
}

export function normalize4(v: readonly number[]): Mix4 {
  const s = (v[0] as number) + (v[1] as number) + (v[2] as number) + (v[3] as number);
  return [(v[0] as number) / s, (v[1] as number) / s, (v[2] as number) / s, (v[3] as number) / s];
}

export function mixRecord(m: readonly number[]): SizeRecord {
  return { coarse: m[0] as number, medium: m[1] as number, fine: m[2] as number, ultrafine: m[3] as number };
}

export function mixTuple(m: SizeRecord): Mix4 {
  return [m.coarse, m.medium, m.fine, m.ultrafine];
}

/** payBcy = (T + Bc) × 1,613 (D-3.3: grade is over the pay column, gravel plus bedrock cleanup). */
export function payBcyOf(b: { payThicknessFt: number; bedrockCleanupFt: number }): number {
  return (b.payThicknessFt + b.bedrockCleanupFt) * BCY_PER_ACRE_FT;
}

/**
 * The separable AR block field z[i][j] with unit variance (§3.5.3): along-valley ρa, across-valley ρc, so
 * Corr(z[i][j], z[i'][j']) = ρa^|Δi| · ρc^|Δj|. nAlong × nAcross normals, row-major.
 */
export function blockField(r: Rng, nAlong: number, nAcross: number, rangeAlongFt: number, rangeAcrossFt: number): number[][] {
  const ra = exp(-BLOCK_FT / rangeAlongFt);
  const rc = exp(-BLOCK_FT / rangeAcrossFt);
  const sa = sqrt(1 - ra * ra);
  const sc = sqrt(1 - rc * rc);
  const z: number[][] = [];
  for (let i = 0; i < nAlong; i++) {
    const u: number[] = new Array<number>(nAcross);
    let w = 0;
    for (let j = 0; j < nAcross; j++) {
      const e = r.normal();
      w = j === 0 ? e : rc * w + sc * e;
      u[j] = w;
    }
    const prev = z[i - 1];
    z.push(prev === undefined ? u : u.map((x, j) => ra * (prev[j] as number) + sa * x));
  }
  return z;
}

export function genClaimTruth(
  r: Rng,
  K: GenClaim,
  d: GenDistrict,
  c: GenCreek,
  prof: CreekProfile,
  gp: GeoGenParams,
): ClaimTruthGen {
  const tpl = d.tpl;
  const cc = gp.grade.claim;
  const dep = K.depositType;
  const bench = dep === 'bench';
  const dm = tpl.depositMult[dep];

  const claimGrade = lnMedian(r, 1, tpl.sigma.claim) * dm.grade;
  const claimOb = lnMedian(r, 1, tpl.overburden.sig[3]) * dm.ob;
  const bedrockType = pickKey(r, BEDROCK_TYPES, tpl.bedrockMix);
  const br = gp.bedrock[bedrockType];
  const prior = tpl.sizeMixPriors[K.sizeSetting];
  if (prior === undefined) throw new RangeError(`template ${tpl.id} has no size-mix prior for ${K.sizeSetting}`);
  const mixK = normalize4(prior.map((p) => p * lnMedian(r, 1, gp.prior.sizeMixJitterLogSd)));
  const coarseBase = tpl.coarseMg[K.sizeSetting];
  if (coarseBase === undefined) throw new RangeError(`template ${tpl.id} has no coarse mass for ${K.sizeSetting}`);
  const coarseMeanMg = coarseBase * lnMedian(r, 1, gp.prior.coarseMassLogSd);
  const fin = tpl.fineness;
  const finenessK = clamp(d.finenessMean + r.normal(0, fin.claimSd), fin.lo, fin.hi);
  const lambdaG = (tpl.verticalDecayFt[dep] ?? 2) * uniformIn(r, cc.decayJitter);
  // §3.4.1: north-facing benches freeze more often, south-facing less.
  const pFrozen = clamp((tpl.permafrostP[dep] ?? 0) * (bench ? 1 + gp.env.aspectFrozenSlope * K.northness : 1), 0, cc.frozenMaxP);
  const frozenU = r.next();
  const frozenDeg = uniformIn(r, cc.frozenDegree);
  const frozenDegree = frozenU < pFrozen ? frozenDeg : 0;
  const clayK = Math.min(1, lnMedian(r, tpl.clayMed, cc.clayLogSd));
  const bouldersK = Math.min(1, lnMedian(r, tpl.boulderMed * gp.grade.boulderSettingMult[K.sizeSetting], cc.boulderLogSd));
  const cementK = Math.min(1, lnMedian(r, tpl.cementMed[dep] ?? 0, cc.cementLogSd));

  const z = blockField(r, K.nAlong, K.nAcross, tpl.blockRangeAlongFt, gp.grade.blockRangeAcrossFt);

  const pocketP = tpl.pocketP * (K.proximal || K.sizeSetting === 'gulch' ? gp.grade.pocketProximalMult : 1);
  const subarctic = tpl.climateBand === 'subarctic';
  const ob = tpl.overburden;
  const blocks: WorkBlock[] = [];
  for (let i = 0; i < K.nAlong; i++) {
    const row = Math.min(c.rows - 1, K.rowStart + i);
    const hw = tpl.halfWidthMedFt * dm.halfWidth * exp(prof.hwLog[row] as number);
    for (let j = 0; j < K.nAcross; j++) {
      const x = K.axisOffsetFt + (j - (K.nAcross - 1) / 2) * BLOCK_FT;
      const dOff = x - (bench ? K.axisOffsetFt : 0) - (prof.centerFt[row] as number);
      const f = overlap(dOff, hw);
      // No difficulty term: truth is identical at every difficulty (D-3.18).
      const gStreak =
        tpl.gMed *
        d.gradeFactor *
        c.gradeFactor *
        exp(prof.richLog[row] as number) *
        claimGrade *
        exp(tpl.sigma.block * ((z[i] as number[])[j] as number));
      let g = f * gStreak + (1 - f) * gStreak * tpl.bgRatio;
      const axisD = (x - K.axisOffsetFt) / gp.grade.obAxisScaleFt;
      const OB = clamp(
        ob.medFt *
          d.obFactor *
          prof.obFactor *
          exp(prof.obLog[row] as number) *
          claimOb *
          (1 + gp.grade.obAxisBoost * exp(-axisD * axisD)) *
          lnMedian(r, 1, ob.sig[4]),
        0,
        cc.maxOverburdenFt,
      );
      const T = clamp(
        tpl.pay.medFt *
          prof.payFactor *
          exp(prof.payLog[row] as number) *
          dm.pay *
          (1 - cc.payStreakWeight + cc.payStreakWeight * f) *
          lnMedian(r, 1, tpl.pay.sig[2]),
        cc.minPayFt,
        cc.maxPayFt,
      );
      const Bc = br.cleanupFt * uniformIn(r, cc.bedrockJitter);
      const sb = br.goldShare * uniformIn(r, cc.bedrockJitter);
      const payBcy = (T + Bc) * BCY_PER_ACRE_FT;
      const pocketU = r.next();
      const pocketBcyDraw = uniformIn(r, gp.grade.pocketBcy);
      const pocketMult = lnMedian(r, gp.grade.pocketMultMedian, gp.grade.pocketMultSigma);
      let pocket: WorkBlock['pocket'] = null;
      if (f >= gp.grade.pocketStreakMinF && pocketU < pocketP) {
        const bcy = Math.min(pocketBcyDraw, gp.grade.pocketMaxPayFrac * payBcy);
        const grade = clamp(gStreak * pocketMult, gp.grade.pocketGradeClamp[0], gp.grade.pocketGradeClamp[1]);
        pocket = { bcy, gradeOzPerBcy: grade };
        g = (g * (payBcy - bcy) + grade * bcy) / payBcy;
      }
      // Coarse gold stays in the channel: the coarse share thins off the paystreak.
      const thin = cc.coarseStreakThin + (1 - cc.coarseStreakThin) * f;
      const mix = normalize4(
        mixK.map((m, k) => m * (k === 0 ? thin : 1) * lnMedian(r, 1, cc.blockMixJitterLogSd)),
      );
      const fineness = clamp(finenessK + r.normal(0, cc.blockFinenessSd), fin.lo, fin.hi);
      const pfN = r.normal(0, cc.permafrostBlockSd);
      const pfU = r.next();
      const permafrost =
        frozenDegree > 0 ? clamp(frozenDegree + pfN, 0, 1) : subarctic ? cc.unfrozenSubarcticMax * pfU : 0;
      let clay = clamp(clayK + r.normal(0, cc.groundBlockSd), 0, 1);
      if (bedrockType === 'clayFalse') clay = Math.max(clay, cc.clayFalseMinClay);
      const boulders = clamp(bouldersK + r.normal(0, cc.groundBlockSd), 0, 1);
      const cemN = r.normal(0, cc.groundBlockSd);
      // No cementation where the claim has none (a zero median), rather than half-normal noise.
      const cementation = cementK > 0 ? clamp(cementK + cemN, 0, 1) : 0;
      blocks.push({
        i,
        j,
        gStreak,
        overburdenFt: OB,
        payThicknessFt: T,
        bedrockCleanupFt: Bc,
        gradeOzPerBcy: g,
        virginGradeOzPerBcy: g,
        mix,
        fineness,
        permafrost,
        clay,
        boulders,
        cementation,
        bedrockType,
        bedrockGoldShare: sb,
        verticalDecayFt: lambdaG,
        paystreakFraction: f,
        minedOutFraction: 0,
        pocket,
        oldTailings: null,
      });
    }
  }
  return { coarseMeanMg, blocks };
}

// ---------------------------------------------------------------------------------------------------------------------
// Conversions between the mutable generation form and BlockTruth
// ---------------------------------------------------------------------------------------------------------------------

export function toBlockTruth(b: WorkBlock, coarseMeanMg: number): BlockTruth {
  const bt: {
    -readonly [K in keyof BlockTruth]: BlockTruth[K];
  } = {
    overburdenFt: b.overburdenFt,
    payThicknessFt: b.payThicknessFt,
    bedrockCleanupFt: b.bedrockCleanupFt,
    gradeOzPerBcy: b.gradeOzPerBcy,
    virginGradeOzPerBcy: b.virginGradeOzPerBcy,
    sizeMix: mixRecord(b.mix),
    coarseMeanMg,
    fineness: b.fineness,
    permafrost: b.permafrost,
    clay: b.clay,
    boulders: b.boulders,
    cementation: b.cementation,
    bedrockType: b.bedrockType,
    bedrockGoldShare: b.bedrockGoldShare,
    verticalDecayFt: b.verticalDecayFt,
    paystreakFraction: b.paystreakFraction,
    minedOutFraction: b.minedOutFraction,
  };
  if (b.pocket !== null) bt.pocket = { bcy: b.pocket.bcy, gradeOzPerBcy: b.pocket.gradeOzPerBcy };
  if (b.oldTailings !== null) {
    bt.oldTailings = { bcy: b.oldTailings.bcy, gradeOzPerBcy: b.oldTailings.gradeOzPerBcy, sizeMix: mixRecord(b.oldTailings.mix) };
  }
  return bt;
}

export function fromBlockTruth(bt: BlockTruth, i: number, j: number, gStreak: number): WorkBlock {
  return {
    i,
    j,
    gStreak,
    overburdenFt: bt.overburdenFt,
    payThicknessFt: bt.payThicknessFt,
    bedrockCleanupFt: bt.bedrockCleanupFt,
    gradeOzPerBcy: bt.gradeOzPerBcy,
    virginGradeOzPerBcy: bt.virginGradeOzPerBcy,
    mix: mixTuple(bt.sizeMix),
    fineness: bt.fineness,
    permafrost: bt.permafrost,
    clay: bt.clay,
    boulders: bt.boulders,
    cementation: bt.cementation,
    bedrockType: bt.bedrockType,
    bedrockGoldShare: bt.bedrockGoldShare,
    verticalDecayFt: bt.verticalDecayFt,
    paystreakFraction: bt.paystreakFraction,
    minedOutFraction: bt.minedOutFraction,
    pocket: bt.pocket === undefined ? null : { bcy: bt.pocket.bcy, gradeOzPerBcy: bt.pocket.gradeOzPerBcy },
    oldTailings:
      bt.oldTailings === undefined
        ? null
        : { bcy: bt.oldTailings.bcy, gradeOzPerBcy: bt.oldTailings.gradeOzPerBcy, mix: mixTuple(bt.oldTailings.sizeMix) },
  };
}
