// Old tailings piles (DESIGN §4.7 "Old tailings piles"; s04 #3): each visible pile ("tailings piles", "dredge
// tailings") gets an independent lognormal estimate from its era's prior median grade, §3's pile size mix and its
// visible footprint volume. P1 ships the prior only (pile sampling, target 'oldTailings', is P2): §7 reads it for the
// pile feed's visible-model ounces (`pileRawOzEst`, §7.16), which recordProduction subtracts before attributing a
// cleanup to in-situ blocks.
import { exp, log, sqrt } from '../../core/dmath';
import type { OldTimerKind, SizeClass, SizeRecord } from '../world/types';

/** The era a pile's prior median comes from (geology.recordsTailingsPriorMedian). */
export type TailingsEra = 'handEra' | 'dozer' | 'dredge';

/**
 * §4.7's spread of a pile's grade about its era median, log sd 0.7, and of its volume about the visible footprint,
 * ±30% (CV). Design delta: DESIGN gives both in prose; keys `geology.recordsTailingsPriorLogSd` and
 * `geology.estTailingsVolumeCv` would make them levers like the era medians.
 */
export const TAILINGS_GRADE_LOG_SD = 0.7;
export const TAILINGS_VOLUME_CV = 0.3;

const Z90 = 1.2815515655446004;
const SIZES: readonly SizeClass[] = ['coarse', 'medium', 'fine', 'ultrafine'];

/** The tailings era of an old-timer kind: hand-era workings, recent dozer operators, dredges; none for 'none'. */
export function tailingsEraOf(kind: OldTimerKind): TailingsEra | null {
  switch (kind) {
    case 'drift':
    case 'handCut':
    case 'dryWash':
    case 'hydraulic':
      return 'handEra';
    case 'recentCat':
      return 'dozer';
    case 'dredge':
      return 'dredge';
    case 'none':
      return null;
  }
}

export interface PilePriorParams {
  readonly tailingsPriorMedian: Readonly<Record<TailingsEra, number>>;
  /** §3's historic pile size mix (geology.oldTimer.pileMix, 5/20/45/30). */
  readonly pileMix: SizeRecord;
}

/** A pile's estimate: grade and contained metal oz (lognormal), volume and size mix. */
export interface PileEstimate {
  readonly era: TailingsEra;
  readonly volumeBcyP50: number;
  readonly volumeLogSd: number;
  /** Metal oz per bcy. */
  readonly gradeP10: number;
  readonly gradeP50: number;
  readonly gradeP90: number;
  readonly gradeMean: number;
  readonly gradeLogSd: number;
  readonly containedOzP10: number;
  readonly containedOzP50: number;
  readonly containedOzP90: number;
  readonly containedOzMean: number;
  readonly sizeMix: SizeRecord;
}

/**
 * The prior estimate of a pile of visible footprint volume `footprintBcy` (§4.7): grade ~ LN(ln median_era, 0.7²),
 * volume ~ LN(ln footprint, ln(1 + 0.3²)) independent, contained = grade × volume.
 */
export function pilePrior(
  era: TailingsEra,
  footprintBcy: number,
  P: PilePriorParams,
  gradeLogSd = TAILINGS_GRADE_LOG_SD,
  volumeCv = TAILINGS_VOLUME_CV,
): PileEstimate {
  const g50 = P.tailingsPriorMedian[era];
  const sv2 = log(1 + volumeCv * volumeCv);
  const sv = sqrt(sv2);
  const v50 = Math.max(0, footprintBcy);
  const sg2 = gradeLogSd * gradeLogSd;
  const so = sqrt(sg2 + sv2);
  const o50 = g50 * v50;
  return {
    era,
    volumeBcyP50: v50,
    volumeLogSd: sv,
    gradeP10: g50 * exp(-Z90 * gradeLogSd),
    gradeP50: g50,
    gradeP90: g50 * exp(Z90 * gradeLogSd),
    gradeMean: g50 * exp(sg2 / 2),
    gradeLogSd,
    containedOzP10: o50 * exp(-Z90 * so),
    containedOzP50: o50,
    containedOzP90: o50 * exp(Z90 * so),
    containedOzMean: o50 * exp((sg2 + sv2) / 2),
    sizeMix: { ...P.pileMix },
  };
}

/**
 * Is the pile worth washing at the planning case (§4.7: strip 0)? gradeP50 × rec × fineness × price × payable ≥ the
 * planning wash cost per bcy.
 */
export function pileMinable(
  est: PileEstimate,
  recovery: number,
  finenessP50: number,
  priceUsdPerFineOz: number,
  payable: number,
  mineWashUsdPerBcy: number,
): boolean {
  return est.gradeP50 * recovery * finenessP50 * priceUsdPerFineOz * payable >= mineWashUsdPerBcy;
}

/**
 * The visible model's weighed raw oz from washing `pileBcyWashed` of the pile (§7.16 pileRawOzEst):
 * bcy × grade × Σ_s mix_s × capture_s × (1 − goldRoomLoss_s) ÷ (1 − dirt). It uses the MEAN grade: recordProduction
 * subtracts it from the weighed gold as the pile's expected share (design delta: §7.16 says "the player's pile grade
 * estimate"; the median would leave ≈ 28% of the expected pile gold to be read as in-situ grade at log sd 0.7).
 */
export function pileRawOzEst(
  pileBcyWashed: number,
  est: PileEstimate,
  captureBySize: SizeRecord,
  goldRoomLossBySize: SizeRecord,
  estDirtFrac: number,
): number {
  if (!(pileBcyWashed > 0)) return 0;
  let chain = 0;
  for (const s of SIZES) chain += est.sizeMix[s] * captureBySize[s] * (1 - goldRoomLossBySize[s]);
  return (pileBcyWashed * est.gradeMean * chain) / (1 - estDirtFrac);
}
