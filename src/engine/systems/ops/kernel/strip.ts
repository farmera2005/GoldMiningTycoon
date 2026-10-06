// DESIGN §7 7.6.1 stripping capacity. Dozers push overburden (rate falls with push distance); excavators cast it. Below
// the thaw line the material is a mix of frozen (share p) and unfrozen ground, dug at the harmonic mean rate. A competent
// foreman hands the thawed pool to the machines that do worst on frozen ground (non-ripper dozers, then excavators,
// then ripper dozers) and saves the rippers for the frozen mix (7.6.1, the 7.8 "D8 is the only thing keeping up" example).
import { calcResult, type Calc } from '../../../core/calc';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import { cementationStripFactor, frozenMixMult, pushFactorOf, stripFrozenMultOf } from './ground';
import type { OpsKernelParams } from './params';
import { STRIP_THAWED_ORDER, type StripMachineKind } from './types';

/**
 * Push distance (7.6.1): ops.basePushFt + ops.pushFtPerExtraCol × (across-valley columns in the cut − 1) + the dump
 * surcharge when overburden goes to a dump rather than adjacent backfill.
 */
export function pushDistanceFt(acrossCols: number, toDump: boolean, p: OpsKernelParams): number {
  return p.basePushFt + p.pushFtPerExtraCol * Math.max(0, acrossCols - 1) + (toDump ? p.dumpExtraPushFt : 0);
}

/** (ops.dozerRefPushFt / pushFt)^ops.dozerPushExp, with its explanation. */
export function pushFactor(pushFt: number, p: OpsKernelParams, ex: KernelExplainCtx = KEX_OFF): Calc<number> {
  const v = pushFactorOf(pushFt, p);
  const calc = ex.on
    ? kNode(ex, 'Push factor', 'product', 'mult', v, [
        kTune(ex, 'ops.dozerRefPushFt', p.dozerRefPushFt, 'ft', 'Reference push'),
        kLeaf(ex, 'Push distance', pushFt, 'ft'),
        kTune(ex, 'ops.dozerPushExp', p.dozerPushExp, 'ratio', 'Push exponent'),
      ])
    : undefined;
  return calcResult(v, calc);
}

export interface StripMachineInput {
  id: string;
  kind: StripMachineKind;
  /** r_m: §9 reference rate × the productivity hook, bcy/hr. */
  refRate: number;
  /** u(m, t). */
  u: number;
}

export interface StripGround {
  /** Push factor of the cut (pushFactorOf(pushDistanceFt(…))). */
  pushFactor: number;
  /** §3 cementation of the overburden. */
  cementation: number;
  /** §3 permafrost: frozen share below the thaw line. */
  permafrost: number;
}

export interface StripRate {
  id: string;
  kind: StripMachineKind;
  /** bcy of thawed overburden per hour-block (r × push or cast × u × cementation). */
  thawedCap: number;
  /** bcy of below-thaw mix per hour-block (thawedCap × frozenMixMult). */
  mixCap: number;
  frozenMult: number;
}

/** A strip machine's capacities this hour-block (7.6.1). */
export function stripRate(m: StripMachineInput, g: StripGround, p: OpsKernelParams): StripRate {
  const task = m.kind === 'excavator' ? p.excavatorStripCastMult : g.pushFactor;
  const thawedCap = Math.max(0, m.refRate * task * m.u * cementationStripFactor(g.cementation, p));
  const frozenMult = stripFrozenMultOf(m.kind, p);
  return { id: m.id, kind: m.kind, thawedCap, mixCap: thawedCap * frozenMixMult(g.permafrost, frozenMult), frozenMult };
}

export interface StripMachineWork {
  id: string;
  thawedBcy: number;
  /** below-thaw mix stripped (frozen + unfrozen). */
  mixBcy: number;
  /** frozen share of the mix (mixBcy × p). */
  frozenBcy: number;
  /** share of the hour-block's capacity used (0..1); the rest is waiting time. */
  timeUsed: number;
}

export interface StripAllocation {
  byMachine: StripMachineWork[];
  thawedBcy: number;
  mixBcy: number;
  frozenBcy: number;
}

function kindRank(kind: StripMachineKind): number {
  return STRIP_THAWED_ORDER.indexOf(kind);
}

/**
 * Splits one hour-block's strip work among the strip machines (7.6.1). The thawed pool goes first to the worst frozen
 * performers (non-ripper dozers, then excavators, then ripper dozers); machines with time left then strip the
 * below-thaw mix, the best frozen performers first when the mix is limited. Ties keep the input order (pass machines
 * in ascending id). `mixAvail` may be Infinity (a deep queue). Returns machines in input order.
 */
export function allocateStripWork(
  rates: readonly StripRate[],
  thawedAvail: number,
  mixAvail: number,
  permafrost: number,
): StripAllocation {
  const n = rates.length;
  const work: StripMachineWork[] = rates.map((r) => ({ id: r.id, thawedBcy: 0, mixBcy: 0, frozenBcy: 0, timeUsed: 0 }));
  const idx = rates.map((_, i) => i);
  const thawedOrder = [...idx].sort((a, b) => kindRank(rates[a]!.kind) - kindRank(rates[b]!.kind) || a - b);
  const mixOrder = [...idx].sort((a, b) => kindRank(rates[b]!.kind) - kindRank(rates[a]!.kind) || a - b);
  let pool = Math.max(0, thawedAvail);
  for (const i of thawedOrder) {
    const r = rates[i]!;
    const w = work[i]!;
    if (pool <= 0 || !(r.thawedCap > 0)) continue;
    const take = Math.min(pool, r.thawedCap);
    w.thawedBcy = take;
    w.timeUsed = take / r.thawedCap;
    pool -= take;
  }
  let mix = Math.max(0, mixAvail);
  const pf = Math.min(1, Math.max(0, permafrost));
  for (const i of mixOrder) {
    const r = rates[i]!;
    const w = work[i]!;
    const left = 1 - w.timeUsed;
    if (mix <= 0 || left <= 0 || !(r.mixCap > 0)) continue;
    const take = Math.min(mix, r.mixCap * left);
    w.mixBcy = take;
    w.frozenBcy = take * pf;
    w.timeUsed += take / r.mixCap;
    mix -= take;
  }
  let thawedBcy = 0;
  let mixBcy = 0;
  let frozenBcy = 0;
  for (let i = 0; i < n; i++) {
    const w = work[i]!;
    if (w.timeUsed > 1) w.timeUsed = 1;
    thawedBcy += w.thawedBcy;
    mixBcy += w.mixBcy;
    frozenBcy += w.frozenBcy;
  }
  return { byMachine: work, thawedBcy, mixBcy, frozenBcy };
}

/**
 * Strip need (7.8 "Stripping coverage"): (stripFt / (columnFt × (1 + wall dilution))) × the week's pay dug — the
 * overburden that must come off per bcy of pay dug.
 */
export function stripNeedBcy(stripFt: number, columnFt: number, payDugBcy: number, p: OpsKernelParams): number {
  const colWithWall = columnFt * (1 + p.wallDilutionFrac);
  return colWithWall > 0 ? (stripFt / colWithWall) * payDugBcy : 0;
}

/** Dozer hours to clear vegetation and moss (7.3 clearBlockIds): ops.clearDozerHrPerAcre per acre. */
export function clearingDozerHours(acres: number, p: OpsKernelParams): number {
  return Math.max(0, acres) * p.clearDozerHrPerAcre;
}
