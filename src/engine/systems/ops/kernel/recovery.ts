// DESIGN §7 7.9 recovery. Contained gold splits by particle size, and each size meets the circuit's base capture B_s
// (concentrators treat only what their capacity allows, the sluice the rest), raised to a product of loss exponents
// (D-7.3): capture = B^M stays in [0, 1], composes multiplicatively, and reproduces R3's "+25% feed ≈ 1.5× fine losses".
// Overfeed, lean water, operator skill, loaded riffles, cold water, unclassified feed and events each scale the
// exponent; clay and oversize take a flat share. Lost gold goes to the line's tailings deposit (7.14).
import { calcResult, type Calc, type CalcNode } from '../../../core/calc';
import { exp, log } from '../../../core/dmath';
import { compareIds } from '../../../core/ids';
import { SIZE_CLASSES } from '../../world/enums';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import {
  zeroSizes,
  type CaptureDevice,
  type CircuitKey,
  type ConcentratorDevice,
  type Prep,
  type SizeClass,
  type SizeRecord,
  type TempBand,
} from './types';

export interface ConcentratorInput {
  id: string;
  device: ConcentratorDevice;
  /** §9 fineTreatCapBcyHr (plant-feed-equivalent bcy/hr). */
  fineTreatCapBcyHr: number;
}

export interface CircuitBlendInput {
  prep: Prep;
  /** Concentrators online on the line's plant this hour (after power shedding). */
  concentrators: readonly ConcentratorInput[];
  /** Feed rate while running (W / u), bcy/hr. */
  feedRateBcyHr: number;
}

export interface CircuitBlend {
  /** Blended base capture by size. */
  B: SizeRecord;
  /** Share of the feed each concentrator treats, in fill order. */
  treated: { id: string; device: ConcentratorDevice; share: number }[];
  /** Share of the feed whose fines only the sluice sees. */
  sluiceShare: number;
  circuit: CircuitKey;
}

function unit(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function deviceMean(p: OpsKernelParams, d: CaptureDevice): number {
  const b = p.baseCapture[d];
  return (b.coarse + b.medium + b.fine + b.ultrafine) / 4;
}

function circuitKeyOf(hasJig: boolean, hasCentrifuge: boolean): CircuitKey {
  if (hasJig && hasCentrifuge) return 'sluice+jig+centrifuge';
  if (hasJig) return 'sluice+jig';
  if (hasCentrifuge) return 'sluice+centrifuge';
  return 'sluice';
}

/**
 * The base capture B_s of a line's circuit (7.9): concentrators are filled best-first (highest mean base capture, then
 * ascending id), each treating min(remaining, fineTreatCap / W) of the feed; the sluice carries the rest. A dry washer
 * plant uses base['dryWasher'] and takes no wet concentrators.
 */
export function circuitBlend(
  input: CircuitBlendInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<CircuitBlend> {
  if (input.prep === 'dryWasher') {
    const b = p.baseCapture.dryWasher;
    const v: CircuitBlend = { B: { ...b }, treated: [], sluiceShare: 0, circuit: 'dryWasher' };
    return calcResult(
      v,
      ex.on ? kTune(ex, 'ops.baseCapture.dryWasher', b.fine, 'pct', 'Dry washer base capture (fine)') : undefined,
    );
  }
  const order = [...input.concentrators].sort(
    (a, b) => deviceMean(p, b.device) - deviceMean(p, a.device) || compareIds(a.id, b.id),
  );
  const w = input.feedRateBcyHr;
  let remaining = 1;
  const treated: { id: string; device: ConcentratorDevice; share: number }[] = [];
  for (const c of order) {
    const cap = w > 0 ? Math.max(0, c.fineTreatCapBcyHr) / w : Number.POSITIVE_INFINITY;
    const share = Math.min(remaining, cap);
    treated.push({ id: c.id, device: c.device, share });
    remaining -= share;
  }
  const sluiceShare = Math.max(0, remaining);
  const B = zeroSizes();
  for (const s of SIZE_CLASSES) {
    let v = sluiceShare * p.baseCapture.sluice[s];
    for (const t of treated) v += t.share * p.baseCapture[t.device][s];
    B[s] = v;
  }
  const circuit = circuitKeyOf(
    order.some((c) => c.device === 'jig'),
    order.some((c) => c.device === 'centrifuge'),
  );
  const v: CircuitBlend = { B, treated, sluiceShare, circuit };
  const calc = ex.on
    ? kNode(ex, 'Base capture of the circuit (fine)', 'sum', 'pct', B.fine, [
        kLeaf(ex, 'Feed rate while running', w, 'bcyPerHour'),
        ...treated.map((t) => kLeaf(ex, `Share treated by ${t.device} ${t.id}`, t.share, 'pct')),
        kLeaf(ex, 'Share on the sluice only', sluiceShare, 'pct'),
      ])
    : undefined;
  return calcResult(v, calc);
}

export interface RiffleState {
  /** sinceCleanup.bcyWashed of the line. */
  bcyWashedSinceCleanup: number;
  /** R_eff of the plant. */
  rEff: number;
  /** Pad (head) grade, metal oz per bcy: rich gravel loads riffles sooner. */
  gradePad: number;
  /** P3: health of the sluiceRiffles component (1 = new); P1–P2 pass 1. */
  health?: number;
}

export interface CaptureInput {
  B: Readonly<SizeRecord>;
  prep: Prep;
  /** φ: feed rate while running ÷ R_eff. */
  phi: number;
  /** ω: water ratio (1 when not lean; a dry washer ignores it). */
  omega: number;
  /** §8 skillRecoveryMult(S_plant): a loss exponent, 1.5 at skill 0 … 1.0 at 55 … 0.75 at 100 (D-7.20). */
  skillMult: number;
  tempBand: TempBand;
  /** bcy-weighted pad clay. */
  clay: number;
  hasScrubber: boolean;
  /** A nugget trap on the oversize (7.9: ops.oversizeCoarseLossTrap). */
  nuggetTrap: boolean;
  riffle: RiffleState;
  /** The §12 recovery-loss-exponent hook value (1 without an event). */
  eventExpMult: number;
  /** ops.rerunHardnessExp when re-running own tailings (escaped particles are the hard ones, 7.14); else 1. */
  hardnessExp?: number;
}

export interface CaptureBySize {
  capture: SizeRecord;
  /** The total loss exponent M_s. */
  exponent: SizeRecord;
  mFeed: SizeRecord;
  mWater: SizeRecord;
  mRiffle: SizeRecord;
  clayLoss: number;
  oversize: SizeRecord;
}

// Powers are taken as exp(y · ln x) with ln x computed once per call and shared by the four sizes: deterministic (dmath),
// within ~3e-15 of dmath.pow and cheaper than a pow per size on the flow's hottest path (each running hour, every line).

/** ln of the feed-ratio base and the exponent scale: M_feed,s = exp(k_s × scale × ln). */
function feedLog(phi: number, p: OpsKernelParams): { ln: number; scale: number } {
  if (phi >= 1) return { ln: phi === 1 ? 0 : log(phi), scale: 1 };
  return { ln: log(Math.max(phi, p.underfeedPhiFloor)), scale: p.underfeedBenefitFactor };
}

/** ln of the water-ratio base and which exponent table applies: M_water,s = exp(k_s × ln). */
function waterLog(omega: number, p: OpsKernelParams): { ln: number; lean: boolean } {
  if (omega === 1) return { ln: 0, lean: false };
  if (omega < 1) return { ln: -log(Math.max(omega, p.leanWaterFloor)), lean: true };
  return { ln: log(omega), lean: false };
}

/** M_feed,s = φ ≥ 1 ? φ^k_s : max(φ, floor)^(k_s × ops.underfeedBenefitFactor) (D-7.22: a floored underfeed benefit). */
export function feedLossExp(phi: number, s: SizeClass, p: OpsKernelParams): number {
  const f = feedLog(phi, p);
  return f.ln === 0 ? 1 : exp(p.overfeedExp[s] * f.scale * f.ln);
}

/** M_water,s = ω < 1 ? (1 / max(ω, ops.leanWaterFloor))^kl_s : ω^kh_s (penalises lean and excess water). */
export function waterLossExp(omega: number, s: SizeClass, p: OpsKernelParams): number {
  const w = waterLog(omega, p);
  return w.ln === 0 ? 1 : exp((w.lean ? p.leanWaterExp[s] : p.excessWaterExp[s]) * w.ln);
}

/**
 * M_riffle,s load × wear (7.9): hEq = bcy washed since cleanup / R_eff; H* = ops.riffleLoadHoursRef ×
 * min(1, ops.riffleLoadGradeRef / grade); load = min(ExpMax, 1 + ExpPer25h × max(0, hEq − H*)/25), coarse taking half
 * the excess (heavy nuggets stay in loaded riffles); wear (P3) = 1 + ops.riffleWearExp × (1 − health).
 */
export function riffleLossExp(r: RiffleState, s: SizeClass, p: OpsKernelParams): number {
  const t = riffleTerms(r, p);
  return s === 'coarse' ? t.coarse : t.other;
}

/** The riffle exponent for coarse gold and for the other sizes (they differ only in the share of the excess). */
function riffleTerms(r: RiffleState, p: OpsKernelParams): { coarse: number; other: number } {
  const hEq = r.rEff > 0 ? Math.max(0, r.bcyWashedSinceCleanup) / r.rEff : 0;
  const hStar = p.riffleLoadHoursRef * (r.gradePad > 0 ? Math.min(1, p.riffleLoadGradeRef / r.gradePad) : 1);
  const excess = (p.riffleLoadExpPer25h * Math.max(0, hEq - hStar)) / 25;
  const health = r.health === undefined ? 1 : Math.min(1, Math.max(0, r.health));
  const wear = 1 + p.riffleWearExp * (1 - health);
  return {
    coarse: Math.min(p.riffleLoadExpMax, 1 + 0.5 * excess) * wear,
    other: Math.min(p.riffleLoadExpMax, 1 + excess) * wear,
  };
}

/**
 * capture_s = B_s^(M_feed × M_water × M_skill × M_riffle × M_cold × M_prep × M_evt [× hardness]) × (1 − clayLoss)
 * × (1 − oversize_s) (7.9). Cold-water and prep exponents act on fine and ultrafine gold only; a dry washer has no
 * water, so neither the water ratio nor cold water applies to it.
 */
export function captureBySize(
  input: CaptureInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<CaptureBySize> {
  const dry = input.prep === 'dryWasher';
  const scrub = input.hasScrubber ? p.clayScrubFactor.scrubber : p.clayScrubFactor[input.prep];
  const clayLoss = Math.min(1, Math.max(0, input.clay) * p.clayLossMax * scrub);
  const hard = input.hardnessExp ?? 1;
  const out: CaptureBySize = {
    capture: zeroSizes(),
    exponent: zeroSizes(),
    mFeed: zeroSizes(),
    mWater: zeroSizes(),
    mRiffle: zeroSizes(),
    clayLoss,
    oversize: zeroSizes(),
  };
  const f = feedLog(input.phi, p);
  const w = dry ? { ln: 0, lean: false } : waterLog(input.omega, p);
  const riffle = riffleTerms(input.riffle, p);
  for (const s of SIZE_CLASSES) {
    const fineish = s === 'fine' || s === 'ultrafine';
    const mFeed = f.ln === 0 ? 1 : exp(p.overfeedExp[s] * f.scale * f.ln);
    const mWater = w.ln === 0 ? 1 : exp((w.lean ? p.leanWaterExp[s] : p.excessWaterExp[s]) * w.ln);
    const mRiffle = s === 'coarse' ? riffle.coarse : riffle.other;
    const mCold = fineish && !dry ? p.coldWaterExp[input.tempBand] : 1;
    const mPrep = fineish ? p.prepFineLossExp[input.prep] : 1;
    const m = mFeed * mWater * input.skillMult * mRiffle * mCold * mPrep * input.eventExpMult * hard;
    const oversize = s === 'coarse' ? (input.nuggetTrap ? p.oversizeCoarseLossTrap : p.oversizeCoarseLoss) : 0;
    const b = Math.min(1, Math.max(0, input.B[s]));
    out.mFeed[s] = mFeed;
    out.mWater[s] = mWater;
    out.mRiffle[s] = mRiffle;
    out.exponent[s] = m;
    out.oversize[s] = oversize;
    out.capture[s] = (b <= 0 ? 0 : b === 1 ? 1 : exp(m * log(b))) * (1 - clayLoss) * (1 - oversize);
  }
  const calc = ex.on ? captureCalc(input, out, p, ex) : undefined;
  return calcResult(out, calc);
}

function captureCalc(
  input: CaptureInput,
  out: CaptureBySize,
  p: OpsKernelParams,
  ex: KernelExplainCtx,
): CalcNode | undefined {
  const sizeNode = (s: SizeClass): CalcNode | undefined =>
    kNode(ex, `Capture (${s})`, 'product', 'pct', out.capture[s], [
      kLeaf(ex, 'Base capture of the circuit', input.B[s], 'pct'),
      kNode(ex, 'Loss exponent', 'product', 'ratio', out.exponent[s], [
        kNode(ex, 'Feed rate (φ)', 'product', 'ratio', out.mFeed[s], [
          kLeaf(ex, 'Feed ÷ effective rated', input.phi, 'ratio'),
          kTune(ex, `ops.overfeedExp.${s}`, p.overfeedExp[s], 'ratio', 'Overfeed exponent'),
        ]),
        kNode(ex, 'Water ratio (ω)', 'product', 'ratio', out.mWater[s], [
          kLeaf(ex, 'Water ratio', input.omega, 'ratio'),
        ]),
        kLeaf(ex, 'Plant operator skill', input.skillMult, 'ratio'),
        kLeaf(ex, 'Riffle loading', out.mRiffle[s], 'ratio'),
        kLeaf(ex, 'Events', input.eventExpMult, 'ratio'),
      ]),
      kNode(ex, 'Clay loss', 'product', 'pct', out.clayLoss, [
        kLeaf(ex, 'Pad clay', input.clay, 'ratio'),
        kTune(ex, 'ops.clayLossMax', p.clayLossMax, 'pct', 'Clay loss at clay 1'),
      ]),
      s === 'coarse' ? kLeaf(ex, 'Oversize loss', out.oversize[s], 'pct') : undefined,
    ]);
  return kNode(
    ex,
    'Recovery by size',
    'lookup',
    'pct',
    out.capture.fine,
    SIZE_CLASSES.map((s) => sizeNode(s)),
  );
}

/** The gold in this hour's washed bcy: C_s = W × padGold_s / pad.bcy (the pad is well mixed, D-7.6). */
export function containedInWash(washedBcy: number, padGold: Readonly<SizeRecord>, padBcy: number): SizeRecord {
  const f = padBcy > 0 ? Math.min(1, Math.max(0, washedBcy) / padBcy) : 0;
  return {
    coarse: padGold.coarse * f,
    medium: padGold.medium * f,
    fine: padGold.fine * f,
    ultrafine: padGold.ultrafine * f,
  };
}

/** recovered_s = C_s × capture_s → the box; lost_s = C_s − recovered_s → tailings (exact by construction). */
export function splitRecovery(
  contained: Readonly<SizeRecord>,
  capture: Readonly<SizeRecord>,
): { recovered: SizeRecord; lost: SizeRecord } {
  // Unrolled: this runs every running hour of every line.
  const rc = contained.coarse * unit(capture.coarse);
  const rm = contained.medium * unit(capture.medium);
  const rf = contained.fine * unit(capture.fine);
  const ru = contained.ultrafine * unit(capture.ultrafine);
  return {
    recovered: { coarse: rc, medium: rm, fine: rf, ultrafine: ru },
    lost: {
      coarse: contained.coarse - rc,
      medium: contained.medium - rm,
      fine: contained.fine - rf,
      ultrafine: contained.ultrafine - ru,
    },
  };
}

/** Whole-feed recovery of a size mix: Σ mix_s × capture_s. */
export function recoveryOfMix(mix: Readonly<SizeRecord>, capture: Readonly<SizeRecord>): number {
  let r = 0;
  for (const s of SIZE_CLASSES) r += mix[s] * capture[s];
  return r;
}

/** Tailings-audit noise (7.14): σ_a = lerp(ops.tailingsAuditCvMax, ops.tailingsAuditCvMin, S_plant/100). */
export function tailingsAuditSigma(sPlant: number, p: OpsKernelParams): number {
  const t = Math.min(1, Math.max(0, sPlant / 100));
  return p.tailingsAuditCvMax + (p.tailingsAuditCvMin - p.tailingsAuditCvMax) * t;
}

/** The audit's estimate of lost oz by size: est_s = lost_s × exp(σ_a·z_s − σ_a²/2) for standard normals z_s (7.14). */
export function auditEstimateBySize(lost: Readonly<SizeRecord>, z: Readonly<SizeRecord>, sigma: number): SizeRecord {
  const out = zeroSizes();
  for (const s of SIZE_CLASSES) out[s] = lost[s] * exp(sigma * z[s] - (sigma * sigma) / 2);
  return out;
}
