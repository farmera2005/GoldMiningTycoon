// estimateFromEvidence (DESIGN §4.18): pure, never receives truth. Memo layers (§4.1, D-4.24, D-4.41, §4.5.2): the
// anchor solve keyed by (parameters, prior, the anchor's evidence and quantized block state); the appended production
// rows on it; the solve summary; the state layer (continuous block state, assays); and the economic layer (planning
// case, quantized planning price, recovery). Identical keys return the identical object; a cold cache never changes a
// result (§2.3 item 6).
import { exp, sqrt } from '../../core/dmath';
import { canonicalJson } from '../../core/hash';
import { compareIds } from '../../core/ids';
import { createMemo } from '../../core/memo';
import { BCY_PER_ACRE_FT } from '../world/constants';
import type { ClaimPriors } from '../world/types';
import { confidence } from './confidence';
import { economicLayer, planningPrice } from './economic';
import { canonicalEvidence, evidenceHash, hashList, itemHash, priorsHash } from './evidence';
import { appendProduction, fullSolveAnchor, type AppendedSolve, type EstimateAnchor } from './incremental';
import type { EstimatorParams } from './params';
import { priorModel } from './prior';
import { prepareProduction, type PreparedProduction } from './production';
import {
  anchorPosterior,
  anchorSolve,
  continuousState,
  solveSummary,
  stateLayer,
  type AnchorSolve,
  type SolveSummary,
  type StatLayer,
} from './statistical';
import type {
  BlockEstimate,
  ClaimEstimate,
  EstimateResult,
  EvidenceSet,
  PlanningAssumptions,
  PlanningContext,
  SampleRecord,
} from './types';

export interface EstimateContext extends PlanningContext {
  readonly params: EstimatorParams;
}

const anchorMemo = createMemo<string, AnchorSolve>('knowledge.anchorSolve', 128);
const appendMemo = createMemo<string, AppendedSolve>('knowledge.appendedSolve', 128);
const summaryMemo = createMemo<string, SolveSummary>('knowledge.solveSummary', 256);
const statMemo = createMemo<string, StatLayer>('knowledge.statLayer', 256);
const estimateMemo = createMemo<string, EstimateResult>('knowledge.estimate', 512);

/** Hit/miss counts of the estimator's memo layers (diagnostics: how many full solves, appends and reruns ran). */
export function estimatorMemoStats(): Record<
  'anchor' | 'appended' | 'summary' | 'state' | 'estimate',
  { hits: number; misses: number }
> {
  const of = (m: { stats: { hits: number; misses: number } }): { hits: number; misses: number } => ({
    hits: m.stats.hits,
    misses: m.stats.misses,
  });
  return {
    anchor: of(anchorMemo),
    appended: of(appendMemo),
    summary: of(summaryMemo),
    state: of(statMemo),
    estimate: of(estimateMemo),
  };
}

export interface StatisticalEstimate {
  readonly key: string;
  readonly evidenceHash: string;
  readonly stat: StatLayer;
  /** The anchor solve behind it (incremental path, explain). */
  readonly anchor: AnchorSolve;
}

/**
 * The statistical layer of the evidence anchored at `anchor` (§4.5.2): the anchor solve over the evidence up to the
 * anchor turn at the anchor's block state, the production rows after it appended, and the state layer at the current
 * block state. With `fullSolveAnchor(evidence)` this is the full solve.
 */
export function anchoredStatisticalEstimate(
  priors: ClaimPriors,
  evidence: EvidenceSet,
  anchor: EstimateAnchor,
  params: EstimatorParams,
): StatisticalEstimate {
  if (evidence.claimId !== priors.claimId) {
    throw new RangeError(`estimator: evidence for ${evidence.claimId}, priors for ${priors.claimId}`);
  }
  // Memo keys are plain concatenations of the evidence items' cached content hashes (the Map hashes the string
  // natively): a weekly refresh that hits every layer costs a sort and a few joins (§2.13).
  const canon = canonicalEvidence(evidence);
  const anchored: SampleRecord[] = [];
  const appendedRecs: SampleRecord[] = [];
  for (const s of canon.samples) {
    if (s.source === 'production' && s.production !== undefined && s.production.cleanupTurn > anchor.turn) {
      appendedRecs.push(s);
    } else anchored.push(s);
  }
  const recordHashes = hashList(canon.records);
  const aKey =
    `${priors.claimId}|${params.key}|${priorsHash(priors)}|A${hashList(anchored)}#${recordHashes}` +
    `#${anchor.minedBlockIds.slice().sort(compareIds).join(',')}#${canonicalJson(anchor.strippedFt)}`;
  const an = anchorMemo.getOrCompute(aKey, () =>
    anchorSolve(priorModel(priors, params), {
      samples: anchored,
      records: canon.records,
      state: anchor,
    }),
  );
  let prepared: PreparedProduction[] | null = null;
  const appended = (): PreparedProduction[] => (prepared ??= prepareProduction(an.model.indexOf, appendedRecs, params));
  const pKey = appendedRecs.length === 0 ? aKey : `${aKey}|P${hashList(appendedRecs)}`;
  const ap: AppendedSolve =
    appendedRecs.length === 0
      ? anchorPosterior(an)
      : appendMemo.getOrCompute(pKey, () => appendProduction(an, appended()));
  const sum = summaryMemo.getOrCompute(pKey, () => solveSummary(an, ap.sol, ap.CG));
  const sKey = `${pKey}|S${canonicalJson({ blockState: canon.blockState, assays: canon.assays })}`;
  const stat = statMemo.getOrCompute(sKey, () =>
    stateLayer(
      an,
      ap,
      sum,
      continuousState(an.model, canon.blockState),
      canon.assays,
      appendedRecs.length === 0 ? an.production : [...an.production, ...appended()],
    ),
  );
  return {
    key: sKey,
    get evidenceHash(): string {
      return evidenceHash(canon);
    },
    stat,
    anchor: an,
  };
}

/** The statistical layer of a full solve (no incremental path), memoized by content (no prices or planning in it). */
export function statisticalEstimate(
  priors: ClaimPriors,
  evidence: EvidenceSet,
  params: EstimatorParams,
): StatisticalEstimate {
  return anchoredStatisticalEstimate(priors, evidence, fullSolveAnchor(evidence), params);
}

/** The estimate of a full solve: every production row in the anchor, the current block state (P0's entry point). */
export function estimateFromEvidence(
  priors: ClaimPriors,
  evidence: EvidenceSet,
  planning: PlanningAssumptions,
  ctx: EstimateContext,
): EstimateResult {
  return estimateAnchored(priors, evidence, fullSolveAnchor(evidence), planning, ctx);
}

/**
 * The estimate on the incremental production path (§4.5.2): the anchor from `knowledge.anchors` (see
 * `refreshAnchor`), production after it appended, the economic layer on top. This is what `knownEstimate` reads.
 */
export function estimateAnchored(
  priors: ClaimPriors,
  evidence: EvidenceSet,
  anchor: EstimateAnchor,
  planning: PlanningAssumptions,
  ctx: EstimateContext,
): EstimateResult {
  const st = anchoredStatisticalEstimate(priors, evidence, anchor, ctx.params);
  const price = planningPrice(planning, ctx, ctx.params.repriceStep);
  const ekey = `${st.key}|${itemHash(planning)}|${price}|${itemHash(ctx.recoveryBySize)}`;
  return estimateMemo.getOrCompute(ekey, () => buildEstimate(st.stat, st.evidenceHash, planning, ctx));
}

function buildEstimate(
  stat: StatLayer,
  eh: string,
  planning: PlanningAssumptions,
  ctx: EstimateContext,
): EstimateResult {
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
      depthToBedrockFtP50: Math.max(0, exp(geo.D.mean[b] as number) - (stat.obShiftFt[b] as number)),
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
