// §7's visible model (DESIGN §7.2, §7.8, §7.9, §7.16, §7.19; s07 #2, #3, #5, #16; P1 contract §4.7). The same physics
// as the flow on the player's knowledge only (estimates, shown skills): the plan editor's projection and warnings, the
// what-if hints, recovery by size for §4 and §5, the production forecast (§11, §5, §13, bots) and the default plan
// (s07 #5; on a null estimate it uses the claim prior, s07 #16). Wave-0 stubs return no projection.
import type { ClaimId, LineId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { SizeRecord } from '../world/enums';
import type { MinePlan, OpsProjection, PlantLine, ProductionForecast, WhatIfHint } from './types';

export function projectOpsVisible(
  _state: GameState,
  _claimId: ClaimId,
  _planOverride?: MinePlan,
): OpsProjection | null {
  // CONTRACT-STUB(§7) ops.projectOpsVisible
  return null;
}

export function opsHints(_state: GameState, _claimId: ClaimId): WhatIfHint[] {
  // CONTRACT-STUB(§7) ops.opsHints
  return [];
}

/** Capture by size class of a claim's line plant (or a candidate plant). */
export function recoveryBySize(
  _state: GameState,
  _claimId: ClaimId,
  _plantOverride?: Pick<PlantLine, 'plantMachineId' | 'machineIds'>,
  _lineId: LineId = 'L1',
): SizeRecord {
  // CONTRACT-STUB(§7) ops.recoveryBySize
  return { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
}

export function productionForecast(
  _state: GameState,
  _fromTurn: number,
  _toTurn: number,
  _claimIds?: readonly ClaimId[],
): ProductionForecast {
  // CONTRACT-STUB(§7) ops.productionForecast
  return { byWeek: [], cleanups: [], washedBcyByClaim: {} };
}

/** The editor's starting plan (s07 #5 roles and cut rules); null when nothing on the claim is minable. */
export function defaultMinePlan(_state: GameState, _claimId: ClaimId): MinePlan | null {
  // CONTRACT-STUB(§7) ops.defaultMinePlan
  return null;
}
