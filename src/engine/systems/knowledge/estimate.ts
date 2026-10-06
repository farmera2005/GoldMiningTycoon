// estimateFromEvidence (DESIGN §4.18): pure, never receives truth. Two memo layers (§4.1, D-4.24, D-4.41): the
// statistical layer keyed by (parameters, prior, evidence hash), and the economic layer by that key plus the planning
// case and the quantized planning price. Identical keys return the identical object; a cold cache never changes a
// result (§2.3 item 6).
import { exp, sqrt } from '../../core/dmath';
import { hashValue } from '../../core/hash';
import { createMemo } from '../../core/memo';
import { BCY_PER_ACRE_FT } from '../world/constants';
import type { ClaimPriors } from '../world/types';
import { confidence } from './confidence';
import { economicLayer, planningPrice } from './economic';
import { evidenceHash, priorsHash } from './evidence';
import type { EstimatorParams } from './params';
import { priorModel } from './prior';
import { statisticalLayer, type StatLayer } from './statistical';
import type {
  BlockEstimate,
  ClaimEstimate,
  EstimateResult,
  EvidenceSet,
  PlanningAssumptions,
  PlanningContext,
} from './types';

export interface EstimateContext extends PlanningContext {
  readonly params: EstimatorParams;
}

const statMemo = createMemo<string, StatLayer>('knowledge.statLayer', 256);
const estimateMemo = createMemo<string, EstimateResult>('knowledge.estimate', 512);

/** The statistical layer, memoized by content (no prices or planning in it). */
export function statisticalEstimate(priors: ClaimPriors, evidence: EvidenceSet, params: EstimatorParams): {
  key: string;
  evidenceHash: string;
  stat: StatLayer;
} {
  const eh = evidenceHash(evidence);
  const key = `${priors.claimId}|${params.key}|${priorsHash(priors)}|${eh}`;
  const stat = statMemo.getOrCompute(key, () => statisticalLayer(priorModel(priors, params), evidence));
  return { key, evidenceHash: eh, stat };
}

export function estimateFromEvidence(
  priors: ClaimPriors,
  evidence: EvidenceSet,
  planning: PlanningAssumptions,
  ctx: EstimateContext,
): EstimateResult {
  if (evidence.claimId !== priors.claimId) {
    throw new RangeError(`estimateFromEvidence: evidence for ${evidence.claimId}, priors for ${priors.claimId}`);
  }
  const { key, evidenceHash: eh, stat } = statisticalEstimate(priors, evidence, ctx.params);
  const price = planningPrice(planning, ctx, ctx.params.repriceStep);
  const ekey = `${key}|${hashValue(planning)}|${price}|${hashValue(ctx.recoveryBySize)}`;
  return estimateMemo.getOrCompute(ekey, () => buildEstimate(stat, eh, planning, ctx));
}

function buildEstimate(stat: StatLayer, eh: string, planning: PlanningAssumptions, ctx: EstimateContext): EstimateResult {
  const econ = economicLayer(stat, planning, ctx);
  const conf = confidence(stat, econ);
  const m = stat.model;
  const n = m.n;
  const geo = stat.geo;
  const blocks: BlockEstimate[] = [];
  for (let b = 0; b < n; b++) {
    const lnT = geo.T.mean[b] as number;
    const sdT = sqrt(geo.T.varDiag[b] as number);
    // Block contained ounces by moments of the mixture (display): ln O = ln G + ln T + ln(1613 a f_rem).
    const fr = stat.fRem[b] as number;
    const alive = stat.agg.alive[b] === 1;
    const muO = (stat.lnGMean[b] as number) + lnT;
    const sdO = sqrt((stat.lnGSd[b] as number) * (stat.lnGSd[b] as number) + sdT * sdT);
    const vol = BCY_PER_ACRE_FT * (m.acres[b] as number) * fr;
    const worked = stat.depl.workedKind[b];
    const est: BlockEstimate = {
      blockId: m.blockIds[b] as BlockEstimate['blockId'],
      gradeP10: stat.gradeQ.p10[b] as number,
      gradeP50: stat.gradeQ.p50[b] as number,
      gradeP90: stat.gradeQ.p90[b] as number,
      lnGradeMean: stat.lnGMean[b] as number,
      lnGradeSd: stat.lnGSd[b] as number,
      sampleCount: stat.stats.count[b] as number,
      sampledVolumeBcy: stat.stats.volumeBcy[b] as number,
      bedrockSamples: stat.stats.bedrock[b] as number,
      pStreak: stat.pStreak[b] as number,
      depthToBedrockFtP50: exp(geo.D.mean[b] as number),
      payColumnFtP10: exp(lnT - 1.2816 * sdT),
      payColumnFtP50: exp(lnT),
      payColumnFtP90: exp(lnT + 1.2816 * sdT),
      overburdenFtP10: econ.blocks.obP10[b] as number,
      overburdenFtP50: econ.blocks.ob50[b] as number,
      overburdenFtP90: econ.blocks.obP90[b] as number,
      strip50: econ.blocks.strip50[b] as number,
      remainingFrac: fr,
      containedOzP10: alive ? vol * exp(muO - 1.2816 * sdO) : 0,
      containedOzP50: alive ? vol * exp(muO) : 0,
      containedOzP90: alive ? vol * exp(muO + 1.2816 * sdO) : 0,
      costUsdPerPayBcy50: econ.blocks.costPerPayBcy[b] as number,
      marginUsdPerPayBcy50: econ.blocks.margin[b] as number,
      cutoffOzPerBcy: econ.blocks.cutoff[b] as number,
      minable: econ.blocks.minable[b] === 1,
      confidence: conf.blockClass[b] ?? 'speculative',
      ...(worked !== undefined ? { worked } : {}),
      ...((stat.confirmedOz[b] as number) > 0 ? { pocket: 'confirmed' as const } : {}),
    };
    blocks.push(est);
  }
  const minableBlockIds = blocks.filter((x) => x.minable).map((x) => x.blockId);
  const c = stat.contained;
  const R = exp(stat.coarse.mr);
  const sdR = sqrt(stat.coarse.vr);
  const claim: ClaimEstimate = {
    claimId: m.priors.claimId,
    evidenceHash: eh,
    independent: false,
    priorStatus: m.priors.priorStatus,
    containedOzP10: c.p10,
    containedOzP50: c.p50,
    containedOzP90: c.p90,
    containedOzMean: c.mean,
    spreadFactor: c.p10 > 0 ? c.p90 / c.p10 : Infinity,
    baseContainedOzP10: c.baseP10,
    baseContainedOzP50: c.baseP50,
    baseContainedOzP90: c.baseP90,
    baseSpreadFactor: c.baseP10 > 0 ? c.baseP90 / c.baseP10 : Infinity,
    pocketUpsideOzMean: c.mean - c.baseMean,
    pBarrenCreek: stat.pBarren,
    minableOzP10: econ.minable.p10,
    minableOzP50: econ.minable.p50,
    minableOzP90: econ.minable.p90,
    minableBcy: econ.minableBcy,
    minableBlockIds,
    avgStrip: econ.avgStrip,
    avgMinableGradeP50: econ.avgMinableGradeP50,
    recovery: econ.recovery,
    recoverableRawOzP50: econ.recoverableRawOzP50,
    fineOzP50: econ.fineOzP50,
    costUsdPerPayBcyM: econ.costUsdPerPayBcyM,
    confidence: conf.cls,
    gates: conf.gates,
    finenessP50: stat.fineness.p50,
    finenessSd: stat.fineness.sd,
    sizeMixP50: stat.sizeMixP50,
    coarseFactorP10: 1 + R * exp(-1.2816 * sdR),
    coarseFactorP50: 1 + R,
    coarseFactorP90: 1 + R * exp(1.2816 * sdR),
    coarseLogSd: sdR,
    planning,
    planningPriceUsed: econ.priceUsed,
    hypotheses: { evaluated: stat.evaluatedHypotheses, surviving: stat.hyps.count },
  };
  return { claim, blocks };
}
