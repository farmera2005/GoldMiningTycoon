// §1 access (DESIGN §1 1.4.5, 1.18; D-1.74; P1 contract §4.1). Computed on demand for the current week and never cached
// in state (s01 #7): the season, the arid washout rule and the district-scoped hooks `geology.access.closed`,
// `access.roadOpen` and `access.airOpen`. §3's `claimAccess` builds on it and adds the claim-scoped closure.
import type { DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { AccessMode, Outlook } from './types';

/** Whether the mode is open in the district this week. */
export function accessOpen(_state: GameState, _districtId: DistrictId, _mode: AccessMode): boolean {
  // CONTRACT-STUB(§1) climate.accessOpen
  return true;
}

/** The planning outlook of the mode at absolute week `turn` (visible facts only). */
export function accessOutlook(_state: GameState, _districtId: DistrictId, _mode: AccessMode, _turn: number): Outlook {
  // CONTRACT-STUB(§1) climate.accessOutlook
  return 'open';
}
