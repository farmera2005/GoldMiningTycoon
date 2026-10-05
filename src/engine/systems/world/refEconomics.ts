// The reference-economics yardstick (DESIGN §3.7, D-3.7, D-3.36): a truth-based, sluice-only reference operator at
// the opening spot that mines exactly the blocks that pay. It defines the economic classes for the simulator, tests,
// supply adverse selection (econClass) and the dev reveal. It reads hidden truth: never call it from selectors or bots.
import { BCY_PER_ACRE_FT } from './constants';
import { byBand } from './params';
import type { BlockState, BlockTruth, ClaimTruth, ClimateBand, EconClass, RefEconParams } from './types';

export interface RefBlockEcon {
  readonly payBcy: number;
  readonly overburdenBcy: number;
  readonly recovery: number;
  readonly revenueUsd: number;
  readonly costUsd: number;
}

export interface RefEconResult {
  readonly econClass: EconClass;
  readonly cdvUsd: number;
  readonly margin: number;
  readonly minedIdxs: readonly number[];
  readonly revenueUsd: number;
  readonly costUsd: number;
  readonly minedPayBcy: number;
  readonly minedOverburdenBcy: number;
  /** Metal oz contained in the yardstick's mined blocks (current grade × remaining pay). */
  readonly minedContainedOz: number;
}

/** Remaining pay and overburden of a block given its state (§3.5.1 derived quantities; partly mined blocks count). */
export function remainingVolumes(bt: BlockTruth, bs: BlockState | undefined): { payBcy: number; overburdenBcy: number } {
  const payTotal = (bt.payThicknessFt + bt.bedrockCleanupFt) * BCY_PER_ACRE_FT;
  const obTotal = bt.overburdenFt * BCY_PER_ACRE_FT;
  const mined = bs?.minedBcy ?? 0;
  const sampled = bs?.sampledBcy ?? 0;
  const stripped = bs?.strippedBcy ?? 0;
  const pile = bt.oldTailings === undefined ? 0 : Math.max(0, bt.oldTailings.bcy - (bs?.oldTailingsTakenBcy ?? 0));
  return {
    payBcy: Math.max(0, payTotal - mined - sampled),
    overburdenBcy: Math.max(0, obTotal - stripped) + pile,
  };
}

/** Sluice-only recovery R = Σ_k sizeMix_k × capture_k × (1 − 0.15 × clay). */
export function refRecovery(bt: BlockTruth, re: RefEconParams): number {
  const c = re.capture;
  const r =
    bt.sizeMix.coarse * c[0] + bt.sizeMix.medium * c[1] + bt.sizeMix.fine * c[2] + bt.sizeMix.ultrafine * c[3];
  return r * (1 - re.clayRecoveryPenalty * bt.clay);
}

/** Per-block revenue and cost of the yardstick (§3.7). */
export function refBlockEconomics(
  bt: BlockTruth,
  bs: BlockState | undefined,
  band: ClimateBand,
  re: RefEconParams,
): RefBlockEcon {
  const { payBcy, overburdenBcy } = remainingVolumes(bt, bs);
  const recovery = refRecovery(bt, re);
  const revenueUsd = payBcy * bt.gradeOzPerBcy * recovery * bt.fineness * re.spotUsdPerFineOz * re.payable;
  const strip = byBand(re.stripUsd, band, 'geology.refEcon.stripUsd');
  const wash = byBand(re.washUsd, band, 'geology.refEcon.washUsd');
  // frozenWashAdd charges frozen pay for the throughput the engine loses digging and thawing it (§7, D-3.36).
  const costUsd =
    overburdenBcy * strip * (1 + re.frozenStripAdd * bt.permafrost + re.cementStripAdd * bt.cementation) +
    payBcy * wash * (1 + re.boulderWashAdd * bt.boulders + re.clayWashAdd * bt.clay + re.frozenWashAdd * bt.permafrost);
  return { payBcy, overburdenBcy, recovery, revenueUsd, costUsd };
}

/** The grade at which the yardstick's block revenue equals its cost (oz/bcy). */
export function refBreakEvenGrade(bt: BlockTruth, bs: BlockState | undefined, band: ClimateBand, re: RefEconParams): number {
  const e = refBlockEconomics(bt, bs, band, re);
  const perOz = e.payBcy * e.recovery * bt.fineness * re.spotUsdPerFineOz * re.payable;
  return perOz > 0 ? e.costUsd / perOz : Infinity;
}

export function classify(cdvUsd: number, margin: number, re: RefEconParams): EconClass {
  if (cdvUsd <= 0) return 'uneconomic';
  if (cdvUsd >= re.excellentCdvUsd && margin >= re.excellentMargin) return 'excellent';
  if (cdvUsd >= re.goodCdvUsd && margin >= re.goodMargin) return 'good';
  return 'marginal';
}

/**
 * refEconomics(K, T) (§3.7): mined set M = {rev > cost}; CDV = Σ_M (rev − cost) − devBase − devPerAcre·|M|;
 * margin = Σ_M (rev − cost) / Σ_M rev; class by the CDV and margin thresholds.
 */
export function refEconomics(
  truth: ClaimTruth,
  stateOf: (blockIdx: number) => BlockState | undefined,
  band: ClimateBand,
  re: RefEconParams,
): RefEconResult {
  let net = 0;
  let rev = 0;
  let cost = 0;
  let pay = 0;
  let ob = 0;
  let oz = 0;
  const minedIdxs: number[] = [];
  truth.blocks.forEach((bt, idx) => {
    const e = refBlockEconomics(bt, stateOf(idx), band, re);
    if (!(e.revenueUsd > e.costUsd)) return;
    minedIdxs.push(idx);
    net += e.revenueUsd - e.costUsd;
    rev += e.revenueUsd;
    cost += e.costUsd;
    pay += e.payBcy;
    ob += e.overburdenBcy;
    oz += e.payBcy * bt.gradeOzPerBcy;
  });
  const devBase = byBand(re.devBaseUsd, band, 'geology.refEcon.devBaseUsd');
  const devPerAcre = byBand(re.devPerAcreUsd, band, 'geology.refEcon.devPerAcreUsd');
  const cdvUsd = net - devBase - devPerAcre * minedIdxs.length;
  const margin = rev > 0 ? net / rev : 0;
  return {
    econClass: classify(cdvUsd, margin, re),
    cdvUsd,
    margin,
    minedIdxs,
    revenueUsd: rev,
    costUsd: cost,
    minedPayBcy: pay,
    minedOverburdenBcy: ob,
    minedContainedOz: oz,
  };
}
