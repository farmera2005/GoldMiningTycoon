// DESIGN §7 7.10 cleanup and the gold room. The box holds metal (gold-silver alloy); the gold room loses a little by size
// (more without a shaker table and with an unskilled operator); the certified scale reads metal plus the black sand and
// quartz the room could not remove, so weighed raw oz = metal ÷ (1 − dirtFrac), floored to 0.001 oz (D-7.26). The
// sub-milli-ounce remainder stays in the box, so metal is conserved exactly.
import { calcResult, type Calc } from '../../../core/calc';
import { floorMilliOz, milliOz, milliOzToOz, type MilliOz } from '../../../core/money';
import { SIZE_CLASSES } from '../../world/enums';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import { sumSizes, zeroSizes, type GoldParcelK, type SizeRecord } from './types';

export interface GoldRoomInput {
  /** The line's box (inBox), metal oz by size and fine oz (hidden truth). */
  box: GoldParcelK;
  /** §9 siteSupport(claimId).hasTable. */
  hasTable: boolean;
  /** §8 skillRecoveryMult(S_gr) of the gold-room operator (ops.untrainedPlantSkill without one). */
  skillMult: number;
  /** The P5 skim roll fired (P1–P4: always false, and no ops-skim draw is taken). */
  skimmed: boolean;
}

export interface GoldRoomResult {
  grossOz: number;
  /** Gold-room losses by size → the claim's goldRoom tailings deposit (re-runnable, 7.14). */
  grLoss: GoldParcelK;
  /** High-grading skim (P5) → leaves the company before weighing. */
  skim: GoldParcelK;
  /** Metal handed to the scale. */
  metalOz: number;
  dirtFrac: number;
  rawWeighedMilliOz: MilliOz;
  rawWeighedOz: number;
  /** Metal that left the box with the weighing: rawWeighed × (1 − dirtFrac). */
  weighedMetalOz: number;
  /** Fine oz in the weighed metal (the lot's true fine content: rawWeighed × alloyFineness × (1 − dirtFrac)). */
  weighedFineOz: number;
  /** Sub-milli-ounce metal left in the box, by size (pro rata to the net metal), ≥ 0. */
  remainder: GoldParcelK;
  /** True alloy fineness of the box: fineOz ÷ Σ gross metal (0 for an empty box). */
  alloyFineness: number;
}

function scale(s: Readonly<SizeRecord>, f: number): SizeRecord {
  return { coarse: s.coarse * f, medium: s.medium * f, fine: s.fine * f, ultrafine: s.ultrafine * f };
}

/** dirtFrac = ops.goldRoomDirtFrac[hasTable] × skillRecoveryMult(S_gr), kept below 1. */
export function goldRoomDirtFrac(hasTable: boolean, skillMult: number, p: OpsKernelParams): number {
  return Math.min(0.99, Math.max(0, (hasTable ? p.goldRoomDirtFracTable : p.goldRoomDirtFracNoTable) * skillMult));
}

/**
 * One line's cleanup through the gold room and the scale (7.10): grLoss_s = gross_s × goldRoomLoss[table][s] ×
 * skillMult; net = gross − grLoss; skim_s = skimmed ? net_s × ops.skimFrac : 0; metal = Σ(net − skim);
 * rawWeighed = floor3(metal / (1 − dirt)); remainder = metal − rawWeighed × (1 − dirt), clamped at 0 (the floor's
 * decimal snap can round up by ~1e-11 oz relative, far inside the 1e-6 oz conservation tolerance).
 * box = grLoss + skim + weighedMetal + remainder holds to rounding.
 */
export function goldRoom(
  input: GoldRoomInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<GoldRoomResult> {
  const gross = input.box.rawOz;
  const grossOz = sumSizes(gross);
  const alloyFineness = grossOz > 0 ? input.box.fineOz / grossOz : 0;
  const lossRates = input.hasTable ? p.goldRoomLoss.table : p.goldRoomLoss.noTable;
  const grLossOz = zeroSizes();
  const net = zeroSizes();
  const skimOz = zeroSizes();
  for (const s of SIZE_CLASSES) {
    grLossOz[s] = gross[s] * Math.min(1, lossRates[s] * input.skillMult);
    net[s] = gross[s] - grLossOz[s];
    skimOz[s] = input.skimmed ? net[s] * p.skimFrac : 0;
  }
  const kept = zeroSizes();
  for (const s of SIZE_CLASSES) kept[s] = net[s] - skimOz[s];
  const metalOz = sumSizes(kept);
  const dirtFrac = goldRoomDirtFrac(input.hasTable, input.skillMult, p);
  const rawWeighedMilliOz = metalOz > 0 ? floorMilliOz(metalOz / (1 - dirtFrac)) : milliOz(0);
  const rawWeighedOz = milliOzToOz(rawWeighedMilliOz);
  const weighedMetalOz = rawWeighedOz * (1 - dirtFrac);
  const remainderOz = Math.max(0, metalOz - weighedMetalOz);
  const remShare = metalOz > 0 ? remainderOz / metalOz : 0;
  const remainderRaw = scale(kept, remShare);
  const v: GoldRoomResult = {
    grossOz,
    grLoss: { rawOz: grLossOz, fineOz: sumSizes(grLossOz) * alloyFineness },
    skim: { rawOz: skimOz, fineOz: sumSizes(skimOz) * alloyFineness },
    metalOz,
    dirtFrac,
    rawWeighedMilliOz,
    rawWeighedOz,
    weighedMetalOz,
    weighedFineOz: weighedMetalOz * alloyFineness,
    remainder: { rawOz: remainderRaw, fineOz: remainderOz * alloyFineness },
    alloyFineness,
  };
  const calc = ex.on
    ? kNode(ex, 'Weighed raw oz', 'ratio', 'rawOz', rawWeighedOz, [
        kNode(ex, 'Metal to the scale', 'sum', 'oz', metalOz, [
          kLeaf(ex, 'Metal in the box', grossOz, 'oz'),
          kNode(ex, 'Gold-room loss', 'sum', 'oz', -sumSizes(grLossOz), [
            kLeaf(ex, 'Shaker table', input.hasTable ? 1 : 0, 'count'),
            kLeaf(ex, 'Gold-room operator skill (loss exponent)', input.skillMult, 'ratio'),
          ]),
          input.skimmed ? kTune(ex, 'ops.skimFrac', p.skimFrac, 'pct', 'High-grading skim') : undefined,
        ]),
        kNode(ex, 'Residual dirt in the raw weight', 'product', 'pct', dirtFrac, [
          kTune(
            ex,
            input.hasTable ? 'ops.goldRoomDirtFrac.table' : 'ops.goldRoomDirtFrac.noTable',
            input.hasTable ? p.goldRoomDirtFracTable : p.goldRoomDirtFracNoTable,
            'pct',
            input.hasTable ? 'Dirt with a shaker table' : 'Dirt without a shaker table',
          ),
          kLeaf(ex, 'Gold-room operator skill (loss exponent)', input.skillMult, 'ratio'),
        ]),
      ])
    : undefined;
  return calcResult(v, calc);
}

/**
 * Site security (7.10, D-7.43): min(ops.siteSecurityCap, §9 campSummary.security + ops.ownerPresentSecurity when the
 * owner is on the claim). §12's siteSecurity reads the same value.
 */
export function siteSecurity(campSecurity: number, ownerPresent: boolean, p: OpsKernelParams): number {
  return Math.min(p.siteSecurityCap, Math.max(0, campSecurity) + (ownerPresent ? p.ownerPresentSecurity : 0));
}

export interface SkimInput {
  /** §8 minCrewReliability (true, hidden; 100 when no employee works the claim, so an owner-only site never skims). */
  minCrewReliability: number;
  security: number;
  /** The high-grading hook value for the claim. */
  highGradeMult: number;
  /** §8 crewGoldShareFrac: share of the crew on a gold-share pay plan. */
  crewGoldShareFrac: number;
}

/**
 * P5 skim odds per line cleanup (7.10, D-7.36): pSkim = ops.skimBase × (1 − reliability/100)² × (1 − security) ×
 * highGradeMult × (1 − 0.5 × crewGoldShareFrac), clamped to [0, 1]. P1–P4 use pSkim = 0 and take no draw.
 */
export function skimProbability(input: SkimInput, p: OpsKernelParams): number {
  const rel = 1 - Math.min(100, Math.max(0, input.minCrewReliability)) / 100;
  const v =
    p.skimBase *
    rel *
    rel *
    (1 - Math.min(1, Math.max(0, input.security))) *
    input.highGradeMult *
    (1 - 0.5 * Math.min(1, Math.max(0, input.crewGoldShareFrac)));
  return Math.min(1, Math.max(0, v));
}
