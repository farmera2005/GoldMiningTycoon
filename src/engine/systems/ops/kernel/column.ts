// DESIGN §7 7.3: cuts, blocks and the pay column. The foreman strips to the contact with an error ε ~ N(μ_c, σ_c) (D-7.10),
// so the dug column carries overburden dilution and the top of the pay can go to waste; mining shares §3's vertical gold
// profile (D-7.4), and each week's area slice draws gold without replacement with a mean-one sub-block factor (D-7.5).
import { calcResult, drawNode, type Calc } from '../../../core/calc';
import { exp, normCdf, sqrt } from '../../../core/dmath';
import type { BlockId, ClaimId } from '../../../core/ids';
import { rng } from '../../../core/rng';
import { BCY_PER_ACRE_FT } from '../../world/constants';
import type { VerticalProfile } from '../../world/types';
import { verticalGoldShareProfile } from '../../world/vertical';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { GoldParcelK, PayTopPolicy, SizeRecord } from './types';

const INV_SQRT_2PI = 1 / sqrt(2 * Math.PI);

/** The sub-block grade factor's clamp (7.3: f = clamp(exp(σz − σ²/2), 0.4, 2.5)). */
export const SUB_BLOCK_FACTOR_MIN = 0.4;
export const SUB_BLOCK_FACTOR_MAX = 2.5;

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** The effective digging skill on a line: S_dig = 0.8 × S_op + 0.2 × qF (7.2 "Pay contact"). */
export function digSkill(sOp: number, qF: number): number {
  return 0.8 * sOp + 0.2 * qF;
}

/** σ_c = contactErrorSdFt × (1 + contactSkillSlope × (50 − S_dig)/50), ft; skill narrows the contact error. */
export function contactSigmaFt(sDig: number, p: OpsKernelParams): number {
  return Math.max(0, p.contactErrorSdFt * (1 + (p.contactSkillSlope * (50 - sDig)) / 50));
}

/**
 * Closed-form contact expectations for ε ~ N(μ, σ): dilFt = E[max(0, ε)] (overburden washed as pay) and
 * lossFt = E[max(0, −ε)] = dilFt − μ (pay stripped to waste). σ = 0 is the deterministic limit.
 */
export function contactExpectation(muFt: number, sigmaFt: number): { dilFt: number; lossFt: number } {
  if (!(sigmaFt > 0)) return { dilFt: Math.max(0, muFt), lossFt: Math.max(0, -muFt) };
  const z = muFt / sigmaFt;
  const dilFt = muFt * normCdf(z) + sigmaFt * exp(-(z * z) / 2) * INV_SQRT_2PI;
  return { dilFt, lossFt: Math.max(0, dilFt - muFt) };
}

export interface PayColumnInput {
  /** Overburden over the block (truth in the flow, the player's P50 in the projection), ft. */
  overburdenFt: number;
  /** T_p: pay gravel thickness, ft. */
  payThicknessFt: number;
  /** x_b: the plan's bedrock take, ft (clamped to [0, ops.bedrockTakeFtMax]). */
  bedrockTakeFt: number;
  policy: PayTopPolicy;
  /** S_dig of the line (digSkill). */
  sDig: number;
  /** Stripped before the game (§3 strippedBcy = overburdenBcy): stripped to the contact, μ_c = 0 (s07 #7). */
  preStripped?: boolean;
}

export interface PayColumn {
  muFt: number;
  sigmaFt: number;
  dilFt: number;
  lossFt: number;
  /** ft actually stripped (overburden − μ_c). */
  stripFt: number;
  /** ft dug as pay above bedrock: T_p + μ_c (contact dilution digs like gravel, 7.4). */
  gravelFt: number;
  /** ft of bedrock dug: x_b. */
  bedrockFt: number;
  /** gravelFt + bedrockFt. */
  columnFt: number;
  stripBcyTotal: number;
  /** columnFt × 1613 × (1 + wall dilution). */
  payBcyTotal: number;
}

/**
 * The block's strip and pay column (7.3), fixed when work starts. The mean contact offset never exceeds the overburden
 * there is (a dozer cannot leave overburden that does not exist), and a block with no overburden is not stripped, so it
 * has no contact error.
 */
export function payColumn(input: PayColumnInput, p: OpsKernelParams, ex: KernelExplainCtx = KEX_OFF): Calc<PayColumn> {
  const ob = Math.max(0, input.overburdenFt);
  const tp = Math.max(0, input.payThicknessFt);
  const policyMu = p.contactMeanFt[input.policy];
  const noStrip = ob <= 0;
  const muFt = input.preStripped === true || noStrip ? 0 : Math.min(policyMu, ob);
  const sigmaFt = noStrip ? 0 : contactSigmaFt(input.sDig, p);
  const e = contactExpectation(muFt, sigmaFt);
  const lossFt = Math.min(e.lossFt, tp);
  const stripFt = input.preStripped === true ? ob : Math.max(0, ob - muFt);
  const bedrockFt = clamp(input.bedrockTakeFt, 0, p.bedrockTakeFtMax);
  const gravelFt = tp + muFt;
  const columnFt = gravelFt + bedrockFt;
  const v: PayColumn = {
    muFt,
    sigmaFt,
    dilFt: e.dilFt,
    lossFt,
    stripFt,
    gravelFt,
    bedrockFt,
    columnFt,
    stripBcyTotal: stripFt * BCY_PER_ACRE_FT,
    payBcyTotal: columnFt * BCY_PER_ACRE_FT * (1 + p.wallDilutionFrac),
  };
  const calc = ex.on
    ? kNode(ex, 'Pay bcy in the block', 'product', 'bcy', v.payBcyTotal, [
        kNode(ex, 'Column dug as pay', 'sum', 'ft', columnFt, [
          kLeaf(ex, 'Pay gravel thickness', tp, 'ft'),
          kNode(
            ex,
            'Contact offset (overburden left on the pay)',
            'min',
            'ft',
            muFt,
            [
              kTune(ex, `ops.contactMeanFt.${input.policy}`, policyMu, 'ft', `Pay contact policy (${input.policy})`),
              kLeaf(ex, 'Overburden', ob, 'ft'),
            ],
            input.preStripped === true ? { note: 'Stripped before the game: stripped to the contact' } : undefined,
          ),
          kLeaf(ex, 'Bedrock take', bedrockFt, 'ft'),
        ]),
        kLeaf(ex, 'bcy per acre-foot', BCY_PER_ACRE_FT, 'bcy'),
        kTune(ex, 'ops.wallDilutionFrac', p.wallDilutionFrac, 'pct', 'Wall dilution'),
        kNode(ex, 'Expected overburden washed as pay', 'sum', 'ft', e.dilFt, [
          kNode(ex, 'Contact error sd', 'product', 'ft', sigmaFt, [
            kTune(ex, 'ops.contactErrorSdFt', p.contactErrorSdFt, 'ft', 'Contact error sd at skill 50'),
            kTune(ex, 'ops.contactSkillSlope', p.contactSkillSlope, 'ratio', 'Skill slope'),
            kLeaf(ex, 'Digging skill', input.sDig, 'score'),
          ]),
        ]),
        kLeaf(ex, 'Expected pay stripped to waste', lossFt, 'ft'),
      ])
    : undefined;
  return calcResult(v, calc);
}

export interface GoldShares {
  /** Share of the column's gold inside the dug column (bedrock below T_b is barren). */
  shareTaken: number;
  /** Top of the pay stripped to waste with the overburden. */
  shareWaste: number;
  /** Bedrock gold below the take. */
  shareLeft: number;
}

/**
 * 7.3 gold shares on §3's vertical profile (h = ft above the bedrock surface; gravel 0..T_p, bedrock −T_b..0):
 * taken = VG(−min(x_b, T_b), T_p − lossFt), waste = VG(T_p − lossFt, T_p), left = VG(−T_b, −min(x_b, T_b)).
 */
export function goldShares(
  profile: VerticalProfile,
  bedrockTakeFt: number,
  lossFt: number,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<GoldShares> {
  const tp = profile.Tg;
  const xb = Math.min(Math.max(0, bedrockTakeFt), profile.B);
  const top = tp - clamp(lossFt, 0, tp);
  const v: GoldShares = {
    shareTaken: verticalGoldShareProfile(profile, -xb, top),
    shareWaste: verticalGoldShareProfile(profile, top, tp),
    shareLeft: verticalGoldShareProfile(profile, -profile.B, -xb),
  };
  const calc = ex.on
    ? kNode(ex, 'Share of the block gold dug', 'lookup', 'pct', v.shareTaken, [
        kLeaf(ex, 'Pay gravel thickness', tp, 'ft'),
        kLeaf(ex, 'Bedrock cleanup zone', profile.B, 'ft'),
        kLeaf(ex, 'Bedrock gold share', profile.sb, 'pct'),
        kLeaf(ex, 'Bedrock take (within the zone)', xb, 'ft'),
        kLeaf(ex, 'Top of pay stripped to waste', tp - top, 'ft'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** 7.3 mining loss λ = base × (1 + slope × (50 − S_dig)/50) + boulders × boulderAdd, clamped to [0, 1]. */
export function miningLossFrac(
  sDig: number,
  boulders: number,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const v = clamp(
    p.miningLossBase * (1 + (p.miningLossSkillSlope * (50 - sDig)) / 50) + boulders * p.miningLossBoulderAdd,
    0,
    1,
  );
  const calc = ex.on
    ? kNode(ex, 'Mining loss', 'sum', 'pct', v, [
        kTune(ex, 'ops.miningLossBase', p.miningLossBase, 'pct', 'Base loss at skill 50'),
        kTune(ex, 'ops.miningLossSkillSlope', p.miningLossSkillSlope, 'ratio', 'Skill slope'),
        kLeaf(ex, 'Digging skill', sDig, 'score'),
        kTune(ex, 'ops.miningLossBoulderAdd', p.miningLossBoulderAdd, 'pct', 'Loss per unit of boulders'),
        kLeaf(ex, 'Boulders', boulders, 'ratio'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** §3's pay-column basis: payBcy = (T_p + T_b) × 1613. */
export function s3PayBcy(payThicknessFt: number, bedrockCleanupFt: number): number {
  return (payThicknessFt + bedrockCleanupFt) * BCY_PER_ACRE_FT;
}

export interface BlockGoldStartInput {
  /** §3 current pay-column grade (already net of old-timer removal, D-7.4: never × (1 − minedOutFraction)). */
  gradeOzPerBcy: number;
  payThicknessFt: number;
  bedrockCleanupFt: number;
  /** §3 Block.state.minedBcy (pre-game mining included, s07 #6). */
  minedBcy: number;
  /** §3 Block.state.sampledBcy at the first dig (pits after it are refused, s07 #26). */
  sampledBcy: number;
}

export interface BlockGoldStart {
  /** G0: metal oz in the column when §7 first digs the block. */
  g0: number;
  /** areaMined at the first dig = minedBcy / payBcy (§3 basis). */
  areaMined0: number;
  /** A block mined out before the game opens minedOut. */
  minedOut: boolean;
}

/**
 * G0 = grade × (payBcy − minedBcy − sampledBcy), fixed at the block's first dig (stripping books no gold), with
 * areaMined starting at minedBcy / payBcy (s07 #6, #26). The gold is spread over the unmined area.
 */
export function blockGoldAtFirstDig(input: BlockGoldStartInput, ex: KernelExplainCtx = KEX_OFF): Calc<BlockGoldStart> {
  const payBcy = s3PayBcy(input.payThicknessFt, input.bedrockCleanupFt);
  const areaMined0 = payBcy > 0 ? clamp(input.minedBcy / payBcy, 0, 1) : 1;
  const g0 = Math.max(0, input.gradeOzPerBcy * (payBcy - input.minedBcy - input.sampledBcy));
  const v: BlockGoldStart = { g0, areaMined0, minedOut: areaMined0 >= 1 };
  const calc = ex.on
    ? kNode(ex, 'Gold in the block at the first dig', 'product', 'oz', g0, [
        kLeaf(ex, 'Current pay grade', input.gradeOzPerBcy, 'ozPerBcy'),
        kNode(ex, 'Unmined, unsampled pay', 'sum', 'bcy', Math.max(0, payBcy - input.minedBcy - input.sampledBcy), [
          kLeaf(ex, 'Pay column (§3 basis)', payBcy, 'bcy'),
          kLeaf(ex, 'Mined before', -input.minedBcy, 'bcy'),
          kLeaf(ex, 'Sampled', -input.sampledBcy, 'bcy'),
        ]),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** strippedFrac = strippedBcy / stripBcyTotal, capped at 1 (pre-game stripping can exceed §7's total, s07 #7). */
export function strippedFraction(strippedBcy: number, stripBcyTotal: number): number {
  if (!(stripBcyTotal > 0)) return 1;
  return clamp(strippedBcy / stripBcyTotal, 0, 1);
}

/** 7.3 exposure ramp: minableArea = clamp((strippedFrac − rampStart) / (1 − rampStart), 0, 1). */
export function minableAreaFraction(strippedFrac: number, p: OpsKernelParams): number {
  const r = p.payExposureRampStart;
  if (r >= 1) return strippedFrac >= 1 ? 1 : 0;
  return clamp((strippedFrac - r) / (1 - r), 0, 1);
}

/** availablePayBcy = (minableArea − areaMined) × payBcyTotal, never negative. */
export function availablePayBcy(minableArea: number, areaMined: number, payBcyTotal: number): number {
  return Math.max(0, minableArea - areaMined) * payBcyTotal;
}

/** 7.3 sub-block grade factor from a standard normal z: f = clamp(exp(σz − σ²/2), 0.4, 2.5), mean one before the clamp. */
export function subBlockFactor(z: number, sigma: number): number {
  return clamp(exp(sigma * z - (sigma * sigma) / 2), SUB_BLOCK_FACTOR_MIN, SUB_BLOCK_FACTOR_MAX);
}

/**
 * The week's grade factor of one block: one normal (2 u32) from rng(seed, 'ops-grade', turn, claimId, blockId). Each
 * block's draw has its own key, so it is taken lazily at the block's first dig in the week and cached for the week
 * (s07 #9); the order blocks are dug in cannot shift another block's draw.
 */
export function drawSubBlockFactor(
  seed: string,
  turn: number,
  claimId: ClaimId,
  blockId: BlockId,
  sigma: number,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<{ z: number; f: number }> {
  const z = rng(seed, 'ops-grade', turn, claimId, blockId).normal();
  const f = subBlockFactor(z, sigma);
  const calc = ex.on
    ? drawNode(
        ex,
        'Sub-block grade factor',
        f,
        'mult',
        'ops-grade',
        [turn, claimId, blockId],
        [kTune(ex, 'ops.subBlockGradeSigma', sigma, 'ratio', 'Sub-block grade log-sd')],
      )
    : undefined;
  if (calc !== undefined && ex.hidden === true) calc.hidden = true;
  return calcResult({ z, f }, calc);
}

/** Per-block gold that §7 tracks once it starts a block (BlockOps.goldRemaining and the unmined area). */
export interface BlockGoldState {
  goldRemaining: number;
  /** 1 − areaMined. */
  aRemaining: number;
}

export interface ExtractionSlice {
  deltaA: number;
  sliceGold: number;
  /** → the line's pad pile, split by the block's size mix. */
  extracted: number;
  /** stripped with the overburden. */
  lostToWaste: number;
  /** bedrock not taken + mining loss. */
  leftInPit: number;
  goldRemaining: number;
  aRemaining: number;
  /** The slice took the rest of the block. */
  finished: boolean;
}

/**
 * One week's area slice of a block (7.3): Δa = bcyDug / payBcyTotal; the last slice takes all remaining gold, so the
 * block total is exact (D-7.5). extracted = slice × shareTaken × (1 − λ), lostToWaste = slice × shareWaste, and
 * leftInPit is the rest, so the three sum to the slice.
 */
export function extractSlice(
  st: BlockGoldState,
  bcyDug: number,
  payBcyTotal: number,
  f: number,
  shares: GoldShares,
  lambda: number,
): ExtractionSlice {
  const want = payBcyTotal > 0 ? Math.max(0, bcyDug) / payBcyTotal : 0;
  const finished = st.aRemaining > 0 && want >= st.aRemaining - 1e-12;
  let deltaA: number;
  let sliceGold: number;
  if (finished || st.aRemaining <= 0) {
    deltaA = Math.max(0, st.aRemaining);
    sliceGold = st.goldRemaining;
  } else {
    deltaA = want;
    sliceGold = Math.min(st.goldRemaining, ((st.goldRemaining * deltaA) / st.aRemaining) * f);
  }
  const lostToWaste = sliceGold * clamp(shares.shareWaste, 0, 1);
  const extracted = Math.min(sliceGold - lostToWaste, sliceGold * clamp(shares.shareTaken, 0, 1) * (1 - lambda));
  const leftInPit = sliceGold - lostToWaste - extracted;
  return {
    deltaA,
    sliceGold,
    extracted,
    lostToWaste,
    leftInPit,
    goldRemaining: st.goldRemaining - sliceGold,
    aRemaining: finished || st.aRemaining <= 0 ? 0 : st.aRemaining - deltaA,
    finished: finished || st.aRemaining <= 0,
  };
}

/** Metal oz split by a size mix, carrying the alloy fineness into fine oz (7.3: extracted gold enters the pad pile). */
export function goldParcelOf(metalOz: number, sizeMix: Readonly<SizeRecord>, alloyFineness: number): GoldParcelK {
  return {
    rawOz: {
      coarse: metalOz * sizeMix.coarse,
      medium: metalOz * sizeMix.medium,
      fine: metalOz * sizeMix.fine,
      ultrafine: metalOz * sizeMix.ultrafine,
    },
    fineOz: metalOz * alloyFineness,
  };
}
