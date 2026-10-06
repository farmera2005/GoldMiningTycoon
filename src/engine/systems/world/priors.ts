// Visible priors (DESIGN §3.9, D-3.38): what any player may assume before sampling. Built ONLY from template constants
// (the world's genParams snapshot) and visible claim facts — never from a `hidden` field — so scrambling hidden state
// leaves every value here byte-identical. §4's estimator starts from claimPriors; §5 prices unproven ground from
// priorContainedOz.
import { formatId, type BlockId, type ClaimId, type DistrictId } from '../../core/ids';
import { log, sqrt } from '../../core/dmath';
import { createWeakMemo } from '../../core/memo';
import { BCY_PER_ACRE_FT, BLOCK_FT } from './constants';
import { BEDROCK_TYPES, OLD_TIMER_KINDS } from './enums';
import { templateOf } from './params';
import type {
  Claim,
  ClaimPriors,
  DepositType,
  District,
  GeoGenParams,
  ListingSetting,
  OldTimerKind,
  PriorStatus,
  RegionTemplate,
  SizeRecord,
  SizeSetting,
  SurfaceCode,
  VisibleFeature,
  VisiblePrior,
  WorldSlice,
} from './types';

/** The deposit type a listing setting stands for in visible priors (deep muck shows as valley bottom, §3.9). */
export function visibleDepositType(setting: ListingSetting): DepositType {
  switch (setting) {
    case 'valleyBottom':
      return 'creek';
    case 'bench':
      return 'bench';
    case 'dredgedGround':
      return 'dredgedGround';
    case 'fan':
      return 'desertFan';
    case 'gulch':
      return 'gulch';
  }
}

/** What a listing shows for a true deposit type (§3.9). */
export function listingSettingOf(dep: DepositType): ListingSetting {
  switch (dep) {
    case 'creek':
    case 'deepMuck':
      return 'valleyBottom';
    case 'bench':
      return 'bench';
    case 'dredgedGround':
      return 'dredgedGround';
    case 'desertFan':
      return 'fan';
    case 'gulch':
      return 'gulch';
  }
}

function mixRecord(m: readonly number[]): SizeRecord {
  return { coarse: m[0] as number, medium: m[1] as number, fine: m[2] as number, ultrafine: m[3] as number };
}

function sizePrior(tpl: RegionTemplate, s: SizeSetting): SizeRecord {
  const m = tpl.sizeMixPriors[s];
  if (m === undefined) throw new RangeError(`template ${tpl.id} has no size-mix prior '${s}'`);
  return mixRecord(m);
}

/** A listing setting's default size key when the claim-level proximal flag is not known. */
function defaultSizeSetting(tpl: RegionTemplate, setting: ListingSetting): SizeSetting {
  switch (setting) {
    case 'bench':
      return 'bench';
    case 'fan':
      return 'fan';
    case 'gulch':
      return 'gulch';
    case 'valleyBottom':
    case 'dredgedGround':
      return tpl.sizeMixPriors.midReach !== undefined ? 'midReach' : 'gulch';
  }
}

function rss(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x * x;
  return sqrt(s);
}

/**
 * visiblePrior(districtId, setting, status) (§3.9): gradeMed = gMed × depositMult.grade[setting] × statusMult[status];
 * gradeSigLn = √(σ_district² + σ_creek² + σ_rich² + σ_claim² + σ_block² (+ listedSigmaAdj when listed)).
 */
export function visiblePriorFor(
  tpl: RegionTemplate,
  setting: ListingSetting,
  status: PriorStatus,
  gp: GeoGenParams,
): VisiblePrior {
  const dep = visibleDepositType(setting);
  const dm = tpl.depositMult[dep];
  const s = tpl.sigma;
  const listedAdj = status === 'listed' ? gp.prior.listedSigmaAdj : 0;
  let meanCleanupFt = 0;
  let meanBedrockGoldShare = 0;
  for (const b of BEDROCK_TYPES) {
    const w = tpl.bedrockMix[b] ?? 0;
    meanCleanupFt += w * gp.bedrock[b].cleanupFt;
    meanBedrockGoldShare += w * gp.bedrock[b].goldShare;
  }
  const ob = tpl.overburden.sig;
  const pay = tpl.pay.sig;
  return {
    gradeMedOzBcy: tpl.gMed * dm.grade * gp.prior.statusMult[status],
    gradeSigLn: sqrt(
      s.district * s.district + s.creek * s.creek + s.rich * s.rich + s.claim * s.claim + s.block * s.block + listedAdj,
    ),
    pBarrenCreek: gp.world.barrenCreekP,
    paystreakShare: gp.prior.paystreakShare[setting],
    obMedFt: tpl.overburden.medFt * dm.ob,
    obSigClaim: rss([ob[0], ob[1], ob[2], ob[3]]),
    obSigBlock: ob[4],
    payMedFt: tpl.pay.medFt * dm.pay,
    paySigClaim: rss([pay[0], pay[1]]),
    paySigBlock: pay[2],
    bedrockMix: tpl.bedrockMix,
    meanCleanupFt,
    meanBedrockGoldShare,
    sizeMixPrior: sizePrior(tpl, defaultSizeSetting(tpl, setting)),
    fineness: tpl.fineness,
    pFrozen: tpl.permafrostP[dep] ?? 0,
  };
}

export function visiblePrior(
  world: WorldSlice,
  districtId: DistrictId,
  setting: ListingSetting,
  status: PriorStatus,
): VisiblePrior {
  const d = world.districts[districtId];
  if (d === undefined) throw new RangeError(`visiblePrior: unknown district ${districtId}`);
  return visiblePriorFor(templateOf(world.genParams, d.templateId), setting, status, world.genParams);
}

/** The prior status a claim's public status implies (held, listed or open ground). */
export function priorStatusOf(claim: Pick<Claim, 'status'>): PriorStatus {
  switch (claim.status) {
    case 'listed':
      return 'listed';
    case 'open':
    case 'withdrawn':
      return 'open';
    case 'heldNpc':
    case 'player':
    case 'competitor':
      return 'held';
  }
}

/**
 * priorContainedOz(claimId) = nBlocks × paystreakShare × (payMedFt + B̄) × 1,613 × gradeMed × oldWorkingsMult
 * (dredge tailings visible 0.15 | tailings piles visible 0.6 | else 1).
 */
export function priorContainedOz(world: WorldSlice, claimId: ClaimId, status?: PriorStatus): number {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`priorContainedOz: unknown claim ${claimId}`);
  const vp = visiblePrior(world, claim.districtId, claim.setting, status ?? priorStatusOf(claim));
  const om = world.genParams.prior.oldWorkingsMult;
  const mult = claim.visibleFeatures.includes('dredgeTailings')
    ? om.dredgeTailings
    : claim.visibleFeatures.includes('tailingsPiles')
      ? om.tailingsPiles
      : 1;
  const nBlocks = claim.nAlong * claim.nAcross;
  return nBlocks * vp.paystreakShare * (vp.payMedFt + vp.meanCleanupFt) * BCY_PER_ACRE_FT * vp.gradeMedOzBcy * mult;
}

/** Kinds of old workings consistent with what is visible from the air (§3.6, §3.9, D-3.45). */
function consistentKinds(features: readonly VisibleFeature[]): readonly OldTimerKind[] {
  if (features.includes('dredgeTailings')) return ['dredge'];
  if (
    features.includes('recentDisturbance') ||
    features.includes('ponds') ||
    features.includes('preStripped') ||
    features.includes('improvements')
  ) {
    return ['recentCat'];
  }
  if (features.includes('tailingsPiles')) return ['handCut', 'dryWash', 'hydraulic'];
  // Drift shafts and their winter dumps are overgrown: invisible from the air.
  return ['none', 'drift'];
}

/**
 * oldTimerOdds(depositType, visibleFeatures) (§3.9): the template mix for the deposit type renormalized over the kinds
 * consistent with what is visible; uniform over them if the mix gives them no weight.
 */
export function oldTimerOdds(
  tpl: RegionTemplate,
  depositType: DepositType,
  features: readonly VisibleFeature[],
): Partial<Record<OldTimerKind, number>> {
  const mix = tpl.oldTimerMix[depositType] ?? { none: 1 };
  const kinds = consistentKinds(features);
  let total = 0;
  for (const k of kinds) total += mix[k] ?? 0;
  const out: Partial<Record<OldTimerKind, number>> = {};
  for (const k of OLD_TIMER_KINDS) {
    if (!kinds.includes(k)) continue;
    const w = total > 0 ? (mix[k] ?? 0) / total : 1 / kinds.length;
    if (w > 0) out[k] = w;
  }
  return out;
}

/** The claim's size-mix key and proximal flag, from visible geometry (§3.9: proximal = top 30% of the creek's rows or an order-3 creek). */
export function visibleSizeSetting(world: WorldSlice, claim: Claim): { setting: SizeSetting; proximal: boolean } {
  const creek = world.creeks[claim.creekId];
  if (creek === undefined) throw new RangeError(`claim ${claim.id} has no creek`);
  const mid = claim.geometry.rowStart + claim.nAlong / 2;
  const proximal = creek.order === 3 || mid >= (1 - world.genParams.world.proximalTopFrac) * creek.rows;
  return { setting: claim.sizeSetting, proximal };
}

function buildClaimPriors(world: WorldSlice, claim: Claim, priorStatus: PriorStatus): ClaimPriors {
  const gp = world.genParams;
  const d = world.districts[claim.districtId] as District;
  const tpl = templateOf(gp, d.templateId);
  const vp = visiblePriorFor(tpl, claim.setting, priorStatus, gp);
  const dep = visibleDepositType(claim.setting);
  const dm = tpl.depositMult[dep];
  const { setting: sizeSetting, proximal } = visibleSizeSetting(world, claim);
  const coarse = tpl.coarseMg[sizeSetting];
  if (coarse === undefined) throw new RangeError(`template ${tpl.id} has no coarse mass '${sizeSetting}'`);
  const listed = priorStatus === 'listed';
  const bench = claim.setting === 'bench';
  const u = gp.grade.pocketBcy;
  const workedSet = claim.visibleWorkings;
  const blocks: ClaimPriors['blocks'][number][] = [];
  for (let i = 0; i < claim.nAlong; i++) {
    for (let j = 0; j < claim.nAcross; j++) {
      const idx = i * claim.nAcross + j;
      const x =
        claim.geometry.axisOffsetFt +
        (j - (claim.nAcross - 1) / 2) * BLOCK_FT -
        (bench ? claim.geometry.axisOffsetFt : 0);
      blocks.push({
        blockId: formatId('blk', claim.blockIdBase + idx) as BlockId,
        i,
        j,
        xFt: x,
        acres: 1,
        surface: (claim.env.surfaceCodes[idx] ?? 'u') as SurfaceCode,
        visibleWorkings: workedSet.includes(idx),
      });
    }
  }
  const quality = d.recordsQuality * (claim.access === 'flyIn' ? gp.records.flyInQualityMult : 1);
  return {
    claimId: claim.id,
    districtId: claim.districtId,
    creekId: claim.creekId,
    templateId: tpl.id,
    setting: claim.setting,
    priorStatus,
    recordsQuality: quality,
    logGradeMedian: log(vp.gradeMedOzBcy),
    sigma: {
      district: tpl.sigma.district,
      creek: tpl.sigma.creek,
      rich: tpl.sigma.rich,
      claim: listed ? sqrt(tpl.sigma.claim * tpl.sigma.claim + gp.prior.listedSigmaAdj) : tpl.sigma.claim,
      block: tpl.sigma.block,
    },
    rangeAlongFt: tpl.blockRangeAlongFt,
    rangeAcrossFt: gp.grade.blockRangeAcrossFt,
    streak: {
      wanderSdFt: tpl.wanderSdFt,
      halfWidthMedFt: tpl.halfWidthMedFt * dm.halfWidth,
      sigHalfWidth: tpl.sigHalfWidth,
      bgRatio: tpl.bgRatio,
    },
    pBarrenCreek: gp.world.barrenCreekP,
    barrenMult: gp.world.barrenCreekFactor,
    pocket: {
      pPerStreakBlock: tpl.pocketP * (proximal || sizeSetting === 'gulch' ? gp.grade.pocketProximalMult : 1),
      // Moments of U(lo, hi): E[V] = (lo + hi)/2, E[V²] = (hi³ − lo³) / (3 (hi − lo)).
      bcyMean: (u[0] + u[1]) / 2,
      bcy2Mean: (u[1] * u[1] * u[1] - u[0] * u[0] * u[0]) / (3 * (u[1] - u[0])),
      gradeMin: gp.grade.pocketGradeClamp[0],
      gradeMult: gp.grade.pocketMultMedian,
    },
    oldTimer: { pKind: oldTimerOdds(tpl, dep, claim.visibleFeatures) },
    sizeMixPrior: sizePrior(tpl, sizeSetting),
    sizeMixJitterLogSd: gp.prior.sizeMixJitterLogSd,
    coarseMeanMg: coarse,
    coarseMassLogSd: gp.prior.coarseMassLogSd,
    fineness: { mean: tpl.fineness.mean, districtSd: tpl.fineness.districtSd, claimSd: tpl.fineness.claimSd },
    verticalDecayFt: tpl.verticalDecayFt[dep] ?? 2,
    bedrockMix: tpl.bedrockMix,
    geometry: {
      obMedFt: vp.obMedFt,
      obSigClaim: vp.obSigClaim,
      obSigBlock: vp.obSigBlock,
      payMedFt: vp.payMedFt,
      paySigClaim: vp.paySigClaim,
      paySigBlock: vp.paySigBlock,
    },
    blocks,
  };
}

// Memoized per claim object and status. A claim record is immutable in state (Immer replaces it when it changes), and
// the snapshot and district it reads are immutable after generation; the entry also checks it was built against the
// same snapshot and district objects, so a cold or stale cache never changes a result (§2.3 item 6).
interface PriorEntry {
  readonly gp: GeoGenParams;
  readonly district: District;
  readonly priors: ClaimPriors;
}
const priorMemos = {
  held: createWeakMemo<Claim, PriorEntry>('world.claimPriors.held'),
  listed: createWeakMemo<Claim, PriorEntry>('world.claimPriors.listed'),
  open: createWeakMemo<Claim, PriorEntry>('world.claimPriors.open'),
};

/** claimPriors(state, claimId, priorStatus) (§3.9, §4 4.5.1). */
export function claimPriors(world: WorldSlice, claimId: ClaimId, priorStatus?: PriorStatus): ClaimPriors {
  const claim = world.claims[claimId];
  if (claim === undefined) throw new RangeError(`claimPriors: unknown claim ${claimId}`);
  const status = priorStatus ?? priorStatusOf(claim);
  const district = world.districts[claim.districtId] as District;
  const memo = priorMemos[status];
  const hit = memo.get(claim);
  if (hit !== undefined && hit.gp === world.genParams && hit.district === district) return hit.priors;
  const priors = buildClaimPriors(world, claim, status);
  memo.set(claim, { gp: world.genParams, district, priors });
  return priors;
}
