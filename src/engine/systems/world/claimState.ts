// §3 claim readers over game state (DESIGN §3.3.3, §3.3.4, §3.14; P1 contract §4.3): this week's access and water of a
// claim, its visible water facts, the access cost factors and the district map. Each reads visible fields only (the
// claim's hidden water and truth stay with the physics).
import { EXPLAIN_OFF, type Calc, type ExplainCtx } from '../../core/calc';
import type { ClaimId, DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';
import { accessFactors, type AccessFactors } from './access';
import type { ClaimAccess, ClaimWaterView, DistrictMap, OpenParcel } from './listingTypes';
import type { Claim } from './types';
import { lowFlowGpm, waterAvailableFromFlow } from './water';

export class WorldLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldLookupError';
  }
}

function claimOf(state: GameState, claimId: ClaimId): Claim {
  const claim = Object.prototype.hasOwnProperty.call(state.world.claims, claimId)
    ? state.world.claims[claimId]
    : undefined;
  if (claim === undefined) throw new WorldLookupError(`no claim ${claimId}`);
  return claim;
}

/** This week's access to a claim: §1 `accessOpen` plus the claim-scoped `geology.access.closed` (D-1.74, s01 #8). */
export function claimAccess(_state: GameState, _claimId: ClaimId): ClaimAccess {
  // CONTRACT-STUB(§3) world.claimAccess
  return { heavyOpen: true, freightOpen: true, freightMode: 'road' };
}

/**
 * This week's physical water (gpm): the flow factor of §1's weather and, on springs and wells,
 * `ops.waterAvailableMult`. Wave 0 reads the neutral week (sff 1, no drought).
 */
export function waterAvailableGpm(state: GameState, claimId: ClaimId): number {
  // CONTRACT-STUB(§3) world.waterAvailableGpm (sff and the drought hook)
  return waterAvailableFromFlow(claimOf(state, claimId).water, 1, 1);
}

/** The climatological low flow (§6's water-grant cap). */
export function lowFlowGpmOf(state: GameState, claimId: ClaimId): number {
  return lowFlowGpm(claimOf(state, claimId).water, state.world.genParams);
}

/** The flow a listing shows for the claim's mid season (gpm). */
export function listedFlowGpm(state: GameState, claimId: ClaimId): number {
  // CONTRACT-STUB(§3) world.listedFlowGpm (the listing's gauge-biased mid flow, D-3.76)
  return claimOf(state, claimId).water.baseGpm;
}

/** The visible fields of a claim's water plus its listed flow. */
export function claimWater(state: GameState, claimId: ClaimId): ClaimWaterView {
  const w = claimOf(state, claimId).water;
  const view: ClaimWaterView = {
    sourceKind: w.sourceKind,
    baseGpm: w.baseGpm,
    benchLiftFt: w.benchLiftFt,
    nearestFillMi: w.nearestFillMi,
    listedFlowGpm: listedFlowGpm(state, claimId),
  };
  return w.rightStub === undefined ? view : { ...view, rightStub: { ...w.rightStub } };
}

/** §3.3.3 access cost factors of a claim, state form (cpiIndex is §10's: 1 until P5). */
export function claimAccessFactors(
  state: GameState,
  claimId: ClaimId,
  ex: ExplainCtx = EXPLAIN_OFF,
): Calc<AccessFactors> {
  return accessFactors(state.world, claimId, 1, ex);
}

/** §3.14 the district's base map for §13. */
export function districtMap(state: GameState, districtId: DistrictId): DistrictMap {
  // CONTRACT-STUB(§3) world.districtMap (creeks, routes, airstrips, overlays, claims)
  const d = state.world.districts[districtId];
  if (d === undefined) throw new WorldLookupError(`no district ${districtId}`);
  return {
    widthMi: d.mapMi.w,
    heightMi: d.mapMi.h,
    outlet: { ...d.outletMi },
    creeks: [],
    routes: [],
    town: {
      name: d.town.name,
      tier: d.town.tier,
      services: { ...d.town.services },
      positionMi: { ...d.town.positionMi },
    },
    airstrips: [],
    overlays: [],
    claims: [],
  };
}

/** §5's staking view of an open claim (P2 consumer). */
export function openParcel(_state: GameState, _claimId: ClaimId): OpenParcel | null {
  // CONTRACT-STUB(§3) world.openParcel
  return null;
}
