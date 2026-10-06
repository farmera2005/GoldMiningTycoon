// DESIGN §7 7.5 usable hours and 7.12 season factors. Each machine's hour-block is cut by staffing, mechanical
// availability, operator absence, supervision, weather and season, multiplied through in that fixed order, so the lost
// share splits into one cause each and the parts sum to the hour exactly (the idle breakdown of 7.8 reads them).
import { calcResult, type Calc } from '../../../core/calc';
import { assertNever } from '../../../core/assert';
import { KEX_OFF, kLeaf, kNode, kTune, type KernelExplainCtx } from './explain';
import type { OpsKernelParams } from './params';
import type { OpsRoleK, SeasonPhaseK, SupervisorKind, TempBand } from './types';

export interface UsableInput {
  /** An operator is paired to the machine in this hour's shift, or the machine needs none. */
  staffed: boolean;
  /** A(m, t): mechanicalAvailability. */
  availability: number;
  /** §9 masked the hour-block down (P3 breakdown): A is 0 and the loss is `breakdown`, not `servicing`. */
  masked?: boolean;
  /** e(m): §8 availableFraction of the operator (1 without an operator). */
  operatorAvail: number;
  /** F: the line's supervisor efficiency (foremanEfficiency). */
  foremanEff: number;
  /** W(t): §1 weatherHoursMult × the hours hook, for this hour's shift. */
  weatherMult: number;
  /** Z(m, t): seasonFactor. */
  seasonMult: number;
}

/** u(m, t) and the lost share by cause; u + Σ causes = 1. */
export interface UsableSplit {
  u: number;
  unstaffed: number;
  servicing: number;
  breakdown: number;
  operatorAbsent: number;
  coordination: number;
  weather: number;
  season: number;
}

function unit01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * u(m,t) = staffed × A × e × F × W × Z, and its ordered cause split: (1 − staffed) unstaffed, staffed × (1 − A)
 * servicing (breakdown when masked), … × (1 − e) operatorAbsent, … × (1 − F) coordination, … × (1 − W) weather,
 * … × (1 − Z) season (7.5).
 */
export function usableFraction(input: UsableInput, ex: KernelExplainCtx = KEX_OFF): Calc<UsableSplit> {
  const out: UsableSplit = {
    u: 0,
    unstaffed: 0,
    servicing: 0,
    breakdown: 0,
    operatorAbsent: 0,
    coordination: 0,
    weather: 0,
    season: 0,
  };
  if (!input.staffed) {
    out.unstaffed = 1;
  } else {
    const a = input.masked === true ? 0 : unit01(input.availability);
    if (input.masked === true) out.breakdown = 1;
    else out.servicing = 1 - a;
    let run = a;
    const e = unit01(input.operatorAvail);
    out.operatorAbsent = run * (1 - e);
    run *= e;
    const f = unit01(input.foremanEff);
    out.coordination = run * (1 - f);
    run *= f;
    const w = unit01(input.weatherMult);
    out.weather = run * (1 - w);
    run *= w;
    const z = unit01(input.seasonMult);
    out.season = run * (1 - z);
    run *= z;
    out.u = run;
  }
  const calc = ex.on
    ? kNode(ex, 'Usable share of the hour', 'product', 'pct', out.u, [
        kLeaf(ex, 'Staffed', input.staffed ? 1 : 0, 'count'),
        kLeaf(
          ex,
          input.masked === true ? 'Mechanical availability (broken down)' : 'Mechanical availability',
          input.masked === true ? 0 : input.availability,
          'pct',
        ),
        kLeaf(ex, 'Operator present', input.operatorAvail, 'pct'),
        kLeaf(ex, 'Supervision efficiency', input.foremanEff, 'pct'),
        kLeaf(ex, 'Weather', input.weatherMult, 'mult'),
        kLeaf(ex, 'Season', input.seasonMult, 'mult'),
      ])
    : undefined;
  return calcResult(out, calc);
}

/**
 * A(m, t) (7.5): P1–P2 the flat ops.p1MechAvailability (servicing and minor stops, no breakdowns); P3+ the routine
 * availability plus §9's site-support bonus. A masked hour-block is handled by usableFraction.
 */
export function mechanicalAvailability(p3Rules: boolean, routineBonus: number, p: OpsKernelParams): number {
  return p3Rules ? unit01(p.p3RoutineAvailability + routineBonus) : p.p1MechAvailability;
}

/**
 * F_ℓ (7.2 "Foreman execution"): foremanEffMin + (foremanEffMax − foremanEffMin) × qF/100 for a hired foreman, the
 * owner or a lead hand (§8's qF already carries the lead hand's 0.6 × skill); the flat ops.noForemanEfficiency for a
 * small crew; 0 for 'none' (the line stands down).
 */
export function foremanEfficiency(
  kind: SupervisorKind,
  qF: number,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  let v: number;
  switch (kind) {
    case 'hired':
    case 'owner':
    case 'leadHand':
      v = p.foremanEffMin + ((p.foremanEffMax - p.foremanEffMin) * Math.min(100, Math.max(0, qF))) / 100;
      break;
    case 'smallCrew':
      v = p.noForemanEfficiency;
      break;
    case 'none':
      v = 0;
      break;
    default:
      return assertNever(kind);
  }
  const calc = ex.on
    ? kind === 'smallCrew'
      ? kTune(ex, 'ops.noForemanEfficiency', v, 'pct', 'Small crew, no foreman')
      : kNode(ex, 'Supervision efficiency', 'sum', 'pct', v, [
          kTune(ex, 'ops.foremanEffMin', p.foremanEffMin, 'pct', 'At supervisor skill 0'),
          kTune(ex, 'ops.foremanEffMax', p.foremanEffMax, 'pct', 'At supervisor skill 100'),
          kLeaf(ex, `Supervisor skill (${kind})`, qF, 'score'),
        ])
    : undefined;
  return calcResult(v, calc);
}

export interface SeasonFactorInput {
  phase: SeasonPhaseK;
  role: OpsRoleK;
  tempBand: TempBand;
  /** P3 plan option: strip, dig and clear on frozen ground in winter. */
  winterOps?: boolean;
  /** P5: freeze-up plant hours by temperature band instead of the P1 flat value. */
  freezeupByBand?: boolean;
}

/**
 * Z(m, t) (7.5, 7.12). Winter: no washing; strip, dig and haul only with winterOps (× ops.winterWorkMult, 0 in deepCold
 * weeks), and earthworks (reclaim) not at all. Breakup: no washing; strip and dig × ops.breakupWorkMult. Operating:
 * the plant × ops.plantHoursMultByBand (cool-week night-freeze shutdowns). Freeze-up: the plant × ops.freezeupPlantMult
 * (P5: by band). Every other machine-role and phase combination is 1.
 */
export function seasonFactor(
  input: SeasonFactorInput,
  p: OpsKernelParams,
  ex: KernelExplainCtx = KEX_OFF,
): Calc<number> {
  const { phase, role, tempBand } = input;
  let v = 1;
  let key: string | null = null;
  switch (phase) {
    case 'winter':
      if (role === 'plant' || role === 'feed' || role === 'reclaim' || role === 'water' || role === 'power') v = 0;
      else if (role === 'strip' || role === 'dig' || role === 'haul' || role === 'support') {
        v = input.winterOps === true && tempBand !== 'deepCold' ? p.winterWorkMult : 0;
        key = input.winterOps === true ? 'ops.winterWorkMult' : null;
      }
      break;
    case 'breakup':
      if (role === 'plant' || role === 'feed') v = 0;
      else if (role === 'strip' || role === 'dig') {
        v = p.breakupWorkMult;
        key = 'ops.breakupWorkMult';
      }
      break;
    case 'operating':
      if (role === 'plant') {
        v = p.plantHoursMultByBand[tempBand];
        key = `ops.plantHoursMultByBand.${tempBand}`;
      }
      break;
    case 'freezeup':
      if (role === 'plant') {
        v = input.freezeupByBand === true ? p.freezeupPlantMultByBand[tempBand] : p.freezeupPlantMult;
        key = input.freezeupByBand === true ? `ops.freezeupPlantMultByBand.${tempBand}` : 'ops.freezeupPlantMult';
      }
      break;
    default:
      return assertNever(phase);
  }
  const calc = ex.on
    ? key !== null
      ? kTune(ex, key, v, 'mult', `Season (${phase}, ${role})`)
      : kLeaf(ex, `Season (${phase}, ${role})`, v, 'mult')
    : undefined;
  return calcResult(v, calc);
}
