// §9 claim-level readers (DESIGN §9 9.2.4, 9.7, 9.8.6, 9.10, 9.13; S08-10, S09-14, D-9.69; P1 contract §4.9): the
// camp and site support on a claim, fuel storage, the health averages §6, §7 and §8 read, the machines on a claim, the
// shop hours §8's payroll reads, the fleet's wash capacity and distress sales the observer reads, and the "sell iron"
// counter move. `machinesOnClaim`, `fuelStorageGal`, `avgKnownHealth` and `meanTrueHealth` are real (P1 forms: no
// components and no fuel tanks before P3, so storage is 0 and both health averages are 1).
import type { ClaimId, EmployeeId, MachineId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { CampTier } from '../ops/kernel/types';

export type { CampTier };

export interface CampSummary {
  capacity: number;
  tier: CampTier;
  security: number;
  overCapacity: number;
  hasSafe: boolean;
}

export interface SiteSupport {
  serviceTruck: boolean;
  fuelTruck: boolean;
  routineAvailabilityBonus: number;
  hasTable: boolean;
}

/** The camp units on a claim (applies `ops.campCapacityMult`). */
export function campSummary(_state: GameState, _claimId: ClaimId): CampSummary {
  // CONTRACT-STUB(§9) fleet.campSummary
  return { capacity: 0, tier: 'basic', security: 0, overCapacity: 0, hasSafe: false };
}

/** The support items on a claim (service and fuel trucks, the shaker table). */
export function siteSupport(_state: GameState, _claimId: ClaimId): SiteSupport {
  // CONTRACT-STUB(§9) fleet.siteSupport
  return { serviceTruck: false, fuelTruck: false, routineAvailabilityBonus: 0, hasTable: false };
}

/** Fuel storage on a claim, gal. P1: none (the 10k-gal tank is a phase-3 row). */
export function fuelStorageGal(_state: GameState, _claimId: ClaimId): number {
  return 0;
}

/** Mean of the claim's machines' known component health. P1: machines have no components, so 1. */
export function avgKnownHealth(_state: GameState, _claimId: ClaimId): number {
  return 1;
}

/** Mean true component health of the claim's machines (§6 and §8 internal reads). P1: 1. */
export function meanTrueHealth(_state: GameState, _claimId: ClaimId): number {
  return 1;
}

/** The machines located on a claim, in id order (destroyed machines excluded). */
export function machinesOnClaim(state: GameState, claimId: ClaimId): MachineId[] {
  const out: MachineId[] = [];
  for (const m of sortedValues(state.fleet.machines)) {
    if (m.location.kind === 'claim' && m.location.id === claimId && m.status !== 'destroyed') out.push(m.id);
  }
  return out;
}

export interface ShopHoursRow {
  total: number;
  byClaim: Record<ClaimId, number>;
  yard: number;
}

/** Hours each mechanic worked in the shop this week (P1: a site mechanic works his claim's shift-1 hours, S08-10). */
export function shopHours(_state: GameState): Partial<Record<EmployeeId | 'owner', ShopHoursRow>> {
  // CONTRACT-STUB(§9) fleet.shopHours
  return {};
}

/**
 * The fleet's wash capacity: the max over claims of min(Σ plant rated × grade rate mult, Σ dig and feed rates at
 * REFERENCE_GROUND with a skill-50 operator), over owned machines not in transit (D-9.69).
 */
export function fleetWashCapacityBcyHr(_state: GameState): number {
  // CONTRACT-STUB(§9) fleet.fleetWashCapacityBcyHr
  return 0;
}

/** Any `saleLog` entry with `distress` since `fromTurn` (D-9.69). */
export function distressFleetSale(_state: GameState, _fromTurn: number): boolean {
  // CONTRACT-STUB(§9) fleet.distressFleetSale
  return false;
}

/** 0.80 × Σ resaleEstimate: the "sell iron" P1 counter move (§11). */
export function sellIronLeverCents(_state: GameState): Cents {
  // CONTRACT-STUB(§9) fleet.sellIronLeverCents
  return ZERO_CENTS;
}
