// §5 tenures and production interests (DESIGN §5.2, §5.5, §5.12, §5.14; P1 contract §4.5). The lookups over active
// tenures are real (§1, §4, §7, §9, history and the simulator read them); creating a tenure or an interest mints ids
// and posts to the ledger, so until §5's package lands those are creation stubs that throw.
import { ContractStubError } from '../../core/assert';
import type { ClaimId, DistrictId, ProductionInterestId, TenureId } from '../../core/ids';
import { sortIds, sortedValues } from '../../core/iter';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { FixtureSpec } from '../../state/fixture';
import type { GameState } from '../../state/types';
import type { Obligation } from '../permits/types';
import type { NewProductionInterest, NewTenure, SamplingAccess, Tenure } from './types';

/** A tenure still in force (not ended). */
export function isTenureActive(t: Pick<Tenure, 'status'>): boolean {
  return t.status !== 'ended';
}

/** The player's tenure on a claim in force, or null. */
export function tenureOf(state: GameState, claimId: ClaimId): Tenure | null {
  for (const t of sortedValues(state.land.tenures)) if (t.claimId === claimId && isTenureActive(t)) return t;
  return null;
}

/** Claims the player holds through a tenure in force, ascending. */
export function heldClaimIds(state: GameState): ClaimId[] {
  const out: ClaimId[] = [];
  for (const t of sortedValues(state.land.tenures)) if (isTenureActive(t)) out.push(t.claimId);
  return sortIds(out);
}

/** Districts where the player holds ground, ascending. */
export function heldDistrictIds(state: GameState): DistrictId[] {
  const seen: Partial<Record<DistrictId, true>> = {};
  const out: DistrictId[] = [];
  for (const claimId of heldClaimIds(state)) {
    const d = state.world.claims[claimId]?.districtId;
    if (d !== undefined && seen[d] !== true) {
      seen[d] = true;
      out.push(d);
    }
  }
  return sortIds(out);
}

/** The number of claims the player controls (history's `claimsHeld`, the simulator's O-03 input). */
export function controlledClaimCount(state: GameState): number {
  return heldClaimIds(state).length;
}

/** §5.5 who may sample a claim (§4's program checks). */
export function samplingAccess(_state: GameState, _claimId: ClaimId): SamplingAccess {
  // CONTRACT-STUB(§5) land.samplingAccess
  return { tier: 'none', untilTurn: null, reason: 'none' };
}

/** Creation stub until §5's package lands (§1 N9, fixtures, `land/acceptAsk`). */
export function createTenure(_draft: GameState, _spec: NewTenure): TenureId {
  // CONTRACT-STUB(§5) land.createTenure
  throw new ContractStubError('land.createTenure');
}

/** Creation stub (PI_BURDEN_TOO_HIGH when the burdens would leave no lot). */
export function addProductionInterest(_draft: GameState, _spec: NewProductionInterest): ProductionInterestId {
  // CONTRACT-STUB(§5) land.addProductionInterest
  throw new ContractStubError('land.addProductionInterest');
}

export function endProductionInterest(_draft: GameState, _interestId: ProductionInterestId, _reason: string): void {
  // CONTRACT-STUB(§5) land.endProductionInterest
}

/** A fixture game's tenure (BALANCE §2.1). Creation stub. */
export function fixtureTenure(_draft: GameState, _claimId: ClaimId, _spec: FixtureSpec): TenureId {
  // CONTRACT-STUB(§5) land.fixtureTenure
  throw new ContractStubError('land.fixtureTenure');
}

/** Annual holding cost (owned ground 0 under rules < 2; leases their AMR, s05 #11). */
export function holdingCostAnnual(_state: GameState, _tenureId: TenureId): Cents {
  // CONTRACT-STUB(§5) land.holdingCostAnnual
  return ZERO_CENTS;
}

/** §6 routes a missed §5 obligation here (lease default notice, cure, termination). */
export function onObligationMissed(_draft: GameState, _obligation: Obligation): void {
  // CONTRACT-STUB(§5) land.onObligationMissed
}

/** §6 reports a satisfied §5 obligation (pushes the AMR recoup credit, s05 #2). */
export function onObligationSatisfied(_draft: GameState, _obligation: Obligation): void {
  // CONTRACT-STUB(§5) land.onObligationSatisfied
}
