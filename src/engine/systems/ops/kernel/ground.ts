// DESIGN §7 7.4 material classes and the ground/task multipliers §7 owns (D-7.2): §9's machineEffectiveRate gives the
// reference-condition rate (thawed, 150 ft push, average gravel) and §7 applies frozen, bedrock, boulder, push, cast and
// cementation multipliers on top. Rates combine as a harmonic mean over the material in the column (time per bcy is
// Σ share_i / mult_i), so a little frozen ground slows a dig more than an arithmetic mean would suggest.
import type { TuningResolved } from '../../../../data/tuning';
import { calcResult, type Calc } from '../../../core/calc';
import { pow } from '../../../core/dmath';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import { opsKernelParams, type OpsKernelParams } from './params';
import type { GroundCtx, StripMachineKind } from './types';

/**
 * §7's reference ground (D-7.2): thawed, no bedrock, no boulders or clay, a 150 ft push, a mild week. §9's
 * machineEffectiveRate at this ground is the catalog reference rate; groundTaskMult at it returns only the task's own
 * multiplier (e.g. the excavator cast for stripping).
 */
export const REFERENCE_GROUND: Readonly<GroundCtx> = Object.freeze({
  task: 'reference',
  frozenShare: 0,
  bedrockShare: 0,
  boulders: 0,
  clay: 0,
  ripping: false,
  pushFt: 150,
  tempBand: 'mild',
});

/** The pay column as the digger meets it: gravel (incl. contact dilution) over bedrock, thawed from the top down. */
export interface DigColumnMaterial {
  gravelFt: number;
  bedrockFt: number;
  /** Thawed depth below the exposed pay surface, ft. */
  thawedFt: number;
  /** §3 permafrost p: frozen share of the material below the thaw line. */
  permafrost: number;
}

/** Time per bcy of column (in reference-rate units) by state; frozen time is split unripped / ripped. */
export interface DigTimes {
  /** Thawed material (above the thaw line, plus the unfrozen share below it). */
  nonFrozen: number;
  /** All frozen material dug unripped. */
  frozenUnripped: number;
  /** All frozen material dug after a dozer rips it. */
  frozenRipped: number;
  /** Frozen bcy per bcy of column. */
  frozenShare: number;
}

/** Splits a dig column into thawed and frozen gravel and bedrock and returns the time per bcy of each part (7.4). */
export function digColumnTimes(col: DigColumnMaterial, p: OpsKernelParams): DigTimes {
  const g = Math.max(0, col.gravelFt);
  const b = Math.max(0, col.bedrockFt);
  const total = g + b;
  if (!(total > 0)) return { nonFrozen: 1, frozenUnripped: 0, frozenRipped: 0, frozenShare: 0 };
  const pf = Math.min(1, Math.max(0, col.permafrost));
  const t = Math.max(0, col.thawedFt);
  const gThawed = Math.min(t, g);
  const bThawed = Math.min(Math.max(0, t - g), b);
  const gBelow = g - gThawed;
  const bBelow = b - bThawed;
  const m = p.digMult;
  const nonFrozen =
    ((gThawed + gBelow * (1 - pf)) / m.gravelThawed + (bThawed + bBelow * (1 - pf)) / m.bedrockThawed) / total;
  const gF = (gBelow * pf) / total;
  const bF = (bBelow * pf) / total;
  return {
    nonFrozen,
    frozenUnripped: gF / m.gravelFrozen + bF / m.bedrockFrozen,
    frozenRipped: gF / m.gravelRipped + bF / m.bedrockRipped,
    frozenShare: gF + bF,
  };
}

/** The column's harmonic dig multiplier with a share ρ of its frozen material ripped (ρ = 0 unripped, 1 all ripped). */
export function digMultFromTimes(t: DigTimes, rippedShare: number): number {
  const rho = Math.min(1, Math.max(0, rippedShare));
  return 1 / (t.nonFrozen + (1 - rho) * t.frozenUnripped + rho * t.frozenRipped);
}

/** digMult(column) of 7.6.2 (no boulder or sequence term). */
export function digMultColumn(
  col: DigColumnMaterial,
  rippedShare: number,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const t = digColumnTimes(col, p);
  const v = digMultFromTimes(t, rippedShare);
  const calc = ex.on
    ? kNode(ex, 'Dig multiplier of the pay column', 'ratio', 'mult', v, [
        kLeaf(ex, 'Gravel', col.gravelFt, 'ft'),
        kLeaf(ex, 'Bedrock take', col.bedrockFt, 'ft'),
        kLeaf(ex, 'Thawed depth', col.thawedFt, 'ft'),
        kLeaf(ex, 'Permafrost (frozen share below the thaw line)', col.permafrost, 'pct'),
        kLeaf(ex, 'Frozen share ripped ahead', Math.min(1, Math.max(0, rippedShare)), 'pct'),
        kTune(ex, 'ops.digMult.gravelFrozen', p.digMult.gravelFrozen, 'mult', 'Frozen gravel'),
        kTune(ex, 'ops.digMult.bedrockThawed', p.digMult.bedrockThawed, 'mult', 'Bedrock'),
        kTune(ex, 'ops.digMult.bedrockFrozen', p.digMult.bedrockFrozen, 'mult', 'Frozen bedrock'),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** Harmonic rate multiplier of material with frozen share p dug at `frozenMult` (the unfrozen rest at 1). */
export function frozenMixMult(permafrost: number, frozenMult: number): number {
  const pf = Math.min(1, Math.max(0, permafrost));
  if (pf <= 0) return 1;
  if (!(frozenMult > 0)) return 0;
  return 1 / (1 - pf + pf / frozenMult);
}

/** (1 − boulders × ops.boulderDigPenalty), never negative. */
export function boulderDigFactor(boulders: number, p: OpsKernelParams): number {
  return Math.max(0, 1 - boulders * p.boulderDigPenalty);
}

/**
 * seqMult (7.6.2, P2+): a cut advancing down-valley drains into the face; without a support pump for dewatering the dig
 * runs at ops.downValleySeqDigMult. Under P1 rules it is 1.
 */
export function digSequenceMult(
  advancesDownValley: boolean,
  hasDewateringPump: boolean,
  ruleActive: boolean,
  p: OpsKernelParams,
): number {
  return ruleActive && advancesDownValley && !hasDewateringPump ? p.downValleySeqDigMult : 1;
}

/** Strip time per bcy × (1 + ops.cementationStripSlope × cementation) for dozers and excavators (s07 #19). */
export function cementationStripFactor(cementation: number, p: OpsKernelParams): number {
  return 1 / (1 + p.cementationStripSlope * Math.max(0, cementation));
}

/** The frozen-overburden multiplier of a strip machine (7.4 table). */
export function stripFrozenMultOf(kind: StripMachineKind, p: OpsKernelParams): number {
  switch (kind) {
    case 'dozerRipper':
      return p.stripFrozenMult.dozerRipper;
    case 'dozerNoRipper':
      return p.stripFrozenMult.dozerNoRipper;
    case 'excavator':
      return p.stripFrozenMult.excavator;
  }
}

/** Dozer push factor (7.6.1): (ops.dozerRefPushFt / pushFt)^ops.dozerPushExp. */
export function pushFactorOf(pushFt: number, p: OpsKernelParams): number {
  if (!(pushFt > 0)) return 1;
  return pow(p.dozerRefPushFt / pushFt, p.dozerPushExp);
}

/** Rip capacity of the dig-role dozers on a line (7.4): R = Σ rate × ops.stripFrozenMult.dozerRipper × u, frozen bcy. */
export function ripCapacityBcy(dozers: readonly { refRate: number; u: number }[], p: OpsKernelParams): number {
  let r = 0;
  for (const d of dozers) r += d.refRate * p.stripFrozenMult.dozerRipper * d.u;
  return r;
}

export interface DigCapacityInput {
  /** r_m: the excavator's reference rate (§9 machineEffectiveRate × the productivity hook), bcy/hr. */
  refRate: number;
  boulders: number;
  /** digSequenceMult. */
  seqMult: number;
  /** u(m, t). */
  u: number;
  column: DigColumnMaterial;
  /** The line's rip capacity this hour-block (ripCapacityBcy), frozen bcy; 0 without a dig-role dozer. */
  ripCapBcy: number;
}

export interface DigCapacity {
  /** bcy the excavator can dig in this hour-block. */
  digBcy: number;
  /** frozen bcy ripped ahead (≤ ripCapBcy); the rest of the frozen bcy dig at the frozen multipliers. */
  rippedBcy: number;
  /** share of the frozen material ripped. */
  rippedShare: number;
  /** effective column multiplier (digBcy ÷ (r × boulder × seq × u)). */
  digMult: number;
  /** instantaneous rate r × digMult × boulder × seq, bcy/hr (the "loader" rate of 7.6.3). */
  digRateBcyHr: number;
}

/**
 * 7.6.2 dig capacity with 7.4 rip assist, solved in closed form. Digging D bcy takes D·(a + t_f) + R·(t_r − t_f)/φ_f
 * reference-hours when R < D·φ_f frozen bcy are ripped (a = thawed time, t_f / t_r = frozen time unripped / ripped,
 * φ_f = frozen share), which must equal the hour's usable reference capacity r·u; with R ≥ D·φ_f all frozen bcy are
 * ripped and D = r·u / (a + t_r).
 */
export function digCapacity(
  input: DigCapacityInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<DigCapacity> {
  const t = digColumnTimes(input.column, p);
  const rAdj = input.refRate * boulderDigFactor(input.boulders, p) * input.seqMult;
  const cap = rAdj * Math.max(0, input.u);
  let digBcy: number;
  let rippedBcy: number;
  if (!(cap > 0)) {
    digBcy = 0;
    rippedBcy = 0;
  } else if (t.frozenShare <= 0 || !(input.ripCapBcy > 0)) {
    digBcy = cap / (t.nonFrozen + t.frozenUnripped);
    rippedBcy = 0;
  } else {
    const full = cap / (t.nonFrozen + t.frozenRipped);
    if (input.ripCapBcy >= full * t.frozenShare) {
      digBcy = full;
      rippedBcy = full * t.frozenShare;
    } else {
      const r = input.ripCapBcy;
      digBcy = (cap - (r * (t.frozenRipped - t.frozenUnripped)) / t.frozenShare) / (t.nonFrozen + t.frozenUnripped);
      rippedBcy = r;
    }
  }
  const frozenBcy = digBcy * t.frozenShare;
  const rippedShare = frozenBcy > 0 ? Math.min(1, rippedBcy / frozenBcy) : 0;
  const digMult = cap > 0 ? digBcy / cap : digMultFromTimes(t, rippedShare);
  const v: DigCapacity = { digBcy, rippedBcy, rippedShare, digMult, digRateBcyHr: rAdj * digMult };
  const calc = ex.on
    ? kNode(ex, 'Dig capacity this hour', 'product', 'bcy', digBcy, [
        kLeaf(ex, 'Reference rate', input.refRate, 'bcyPerHour'),
        kNode(ex, 'Boulder factor', 'product', 'mult', boulderDigFactor(input.boulders, p), [
          kLeaf(ex, 'Boulders', input.boulders, 'ratio'),
          kTune(ex, 'ops.boulderDigPenalty', p.boulderDigPenalty, 'ratio', 'Boulder dig penalty'),
        ]),
        kLeaf(ex, 'Sequence factor', input.seqMult, 'mult'),
        kLeaf(ex, 'Usable share of the hour', input.u, 'pct'),
        kNode(ex, 'Column multiplier (with rip assist)', 'ratio', 'mult', digMult, [
          kLeaf(ex, 'Frozen share of the column', t.frozenShare, 'pct'),
          kLeaf(ex, 'Rip capacity', input.ripCapBcy, 'bcy'),
          kLeaf(ex, 'Frozen share ripped', rippedShare, 'pct'),
        ]),
      ])
    : undefined;
  return calcResult(v, calc);
}

/** §9 classes with ground multipliers; every other class (trucks, plants, pumps …) takes 1. */
type GroundClass = 'excavator' | 'dozer' | 'loader';

function groundClass(classId: string): GroundClass | null {
  return classId === 'excavator' || classId === 'dozer' || classId === 'loader' ? classId : null;
}

/**
 * groundTaskMult(classId, task, ground) (7.4, D-7.2): the multiplier §7 applies to §9's reference rate for a machine
 * class doing a task on the given ground, published so §4 programs and previews use §7's table. Tasks: 'dig'
 * (pay column: frozen/bedrock harmonic, ripped when ground.ripping, × boulder factor), 'digTailings' (loose surface pile
 * or own tailings), 'strip' (dozer push factor; excavator cast; frozen share at the machine's frozen multiplier, a
 * dozer with ground.ripping at the ripper value), 'rip' (a dig-role dozer's rip capacity per reference bcy), 'feed'
 * (pad feed, frozen pad bcy at the frozen-gravel rate). Any other class or task returns 1 (haul uses the cycle model).
 * Cementation is not a GroundCtx field: §7's strip caps apply it separately (cementationStripFactor).
 */
export function groundTaskMult(classId: string, task: string, ground: Readonly<GroundCtx>, p: OpsKernelParams): number {
  const cls = groundClass(classId);
  if (cls === null) return 1;
  const f = Math.min(1, Math.max(0, ground.frozenShare));
  switch (task) {
    case 'dig': {
      if (cls === 'dozer') return p.stripFrozenMult.dozerRipper;
      const b = Math.min(1, Math.max(0, ground.bedrockShare));
      const m = p.digMult;
      const time =
        (1 - b) * ((1 - f) / m.gravelThawed + f / (ground.ripping ? m.gravelRipped : m.gravelFrozen)) +
        b * ((1 - f) / m.bedrockThawed + f / (ground.ripping ? m.bedrockRipped : m.bedrockFrozen));
      return boulderDigFactor(ground.boulders, p) / time;
    }
    case 'digTailings':
      return cls === 'dozer' ? 1 : p.tailingsDigMult;
    case 'strip': {
      if (cls === 'loader') return 1;
      if (cls === 'excavator') return p.excavatorStripCastMult * frozenMixMult(f, p.stripFrozenMult.excavator);
      const push = pushFactorOf(ground.pushFt ?? p.dozerRefPushFt, p);
      const frozenMult = ground.ripping ? p.stripFrozenMult.dozerRipper : p.stripFrozenMult.dozerNoRipper;
      return push * frozenMixMult(f, frozenMult);
    }
    case 'rip':
      return cls === 'dozer' ? p.stripFrozenMult.dozerRipper : 1;
    case 'feed':
      return cls === 'dozer' ? 1 : frozenMixMult(f, p.digMult.gravelFrozen);
    default:
      return 1;
  }
}

/**
 * groundTaskMult for callers that hold a game's resolved tuning (§9 machineEffectiveRate, §4 programs): the kernel
 * parameters are cached per tuning object.
 */
export function groundTaskMultForTuning(
  tuning: TuningResolved,
  classId: string,
  task: string,
  ground: Readonly<GroundCtx>,
): number {
  return groundTaskMult(classId, task, ground, opsKernelParams(tuning));
}
