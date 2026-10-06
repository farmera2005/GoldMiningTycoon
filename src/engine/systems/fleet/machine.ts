// §9 per-machine functions (DESIGN §9 9.7, 9.10; S09-4, S09-7; P1 contract §4.9). §7 and §4 read the effective rate and
// fuel burn; §11's net worth, §1's start preview and the bots read the resale estimate; §13 and the bots read the cost
// per hour and the flat P1 maintenance rate. Wave-0 stubs return zero until §9's package implements 9.7.
import { calcResult, type Calc, type ExplainCtx } from '../../core/calc';
import type { MachineId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { SeasonPhase, TempBand } from '../climate/types';
import type { GroundCtx } from '../ops/kernel/types';
import type { CostPerHourBreakdown, Machine } from './types';

/**
 * 9.7.2 (P1): spec × grade × skillProductivityMult(operator) × groundTaskMult × cold × `fleet.rateMult` (S09-7). An
 * operated class with no operator has no rate.
 */
export function machineEffectiveRate(
  _m: Machine,
  _operator: { effSkill: number } | null,
  _ground: GroundCtx,
  _ctx: { task: string; tempBand: TempBand; phase: SeasonPhase },
  _ex: ExplainCtx,
): Calc<number> {
  // CONTRACT-STUB(§9) fleet.machineEffectiveRate
  return calcResult(0, undefined);
}

/** 9.7.6 gal/hr at a load factor, brand fuel and cold multipliers, `fleet.fuelBurnMult`. */
export function fuelBurnGalHr(_m: Machine, _loadFactor: number, _ctx: { tempBand: TempBand }, _ex: ExplainCtx): Calc<number> {
  // CONTRACT-STUB(§9) fleet.fuelBurnGalHr
  return calcResult(0, undefined);
}

/** 9.7.7 resale at the visible condition (new units: price mult 1.0 at condRef for life under P1–P2, S09-4). */
export function resaleEstimate(_state: GameState, _machineId: MachineId, _ex?: ExplainCtx): Calc<Cents> {
  // CONTRACT-STUB(§9) fleet.resaleEstimate
  return calcResult(ZERO_CENTS, undefined);
}

/** The P1–P2 flat maintenance rate: `fleet.p1MaintUsdPerHr[model]` × grade, operator and in-house multipliers. */
export function p1MaintUsdPerSmrHour(_state: GameState, _machineId: MachineId, _ex: ExplainCtx): Calc<number> {
  // CONTRACT-STUB(§9) fleet.p1MaintUsdPerSmrHour
  return calcResult(0, undefined);
}

/** 9.10 cost per hour over a window (the §2.11 canonical selector). */
export function machineCostPerHour(
  _state: GameState,
  _machineId: MachineId,
  window: 'ttm' | 'season',
): CostPerHourBreakdown {
  // CONTRACT-STUB(§9) fleet.machineCostPerHour
  return {
    window,
    smrHours: 0,
    workHours: 0,
    outputBcy: 0,
    lines: {
      econDep: ZERO_CENTS,
      interest: ZERO_CENTS,
      insurance: ZERO_CENTS,
      leaseRental: ZERO_CENTS,
      fuel: ZERO_CENTS,
      pm: ZERO_CENTS,
      repairs: ZERO_CENTS,
      operator: ZERO_CENTS,
      partsHolding: ZERO_CENTS,
    },
    perSmrHourCents: ZERO_CENTS,
    perWorkHourCents: ZERO_CENTS,
    availability: 0,
  };
}
