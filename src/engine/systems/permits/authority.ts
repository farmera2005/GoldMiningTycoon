// §6 operating authority, P1 forms (DESIGN §6.18 P1: "No permits"; P1 contract §4.6). P1 has no permit system: every
// held claim operates under a plan-level authority, every activity is allowed, no condition limits apply and no
// Notice bulk-sample budget exists. These are the P1 bodies (not stubs); P2 replaces them behind rulesAtLeast(2).
import type { ClaimId } from '../../core/ids';
import type { GameState } from '../../state/types';
import { tenureOf } from '../land/tenure';
import type { Tenure } from '../land/types';
import type { ActivityKind } from './types';

export type OperatingAuthority = 'none' | 'casual' | 'notice' | 'plan';

/** P1: 'plan' for every claim the player holds, else 'none'. */
export function operatingAuthority(state: GameState, claimId: ClaimId): OperatingAuthority {
  return tenureOf(state, claimId) === null ? 'none' : 'plan';
}

export type ActivityCheck = { ok: true } | { ok: false; code: 'PERMIT_REQUIRED' | 'DISTURBANCE_CAP' | 'BULK_SAMPLE_LIMIT' };

/** P1: every activity is allowed (permits arrive in P2). */
export function activityAllowed(
  _state: GameState,
  _claimId: ClaimId,
  _activity: ActivityKind,
  _params?: { bcy?: number; gpm?: number; acres?: number },
): ActivityCheck {
  return { ok: true };
}

/** A permit condition's limit on a claim (P2+). */
export interface ConditionLimits {
  maxWaterGpm?: number;
  maxDisturbedAcres?: number;
  noNightShift?: boolean;
}

/** P1: no condition limits. */
export function conditionLimits(_state: GameState, _claimId: ClaimId): ConditionLimits {
  return {};
}

/** P1: strict (the player's compliance setting arrives with permits in P2). */
export function complianceMode(_state: GameState): 'strict' | 'lenient' {
  return 'strict';
}

/** P1: no Notice bulk-sample budget. */
export function bulkSampleRemainingBcy(_state: GameState, _claimId: ClaimId): number {
  return 0;
}

/** Registers a tenure's statutory obligations (claim fees, recording; P2). P1: nothing. */
export function registerTenureObligations(_draft: GameState, _tenure: Tenure): void {
  // P1 has no claim fees or recording (§6.18).
}
