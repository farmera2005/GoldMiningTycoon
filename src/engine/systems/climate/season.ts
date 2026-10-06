// §1 season readers (DESIGN §1 1.4, 1.18; P1 contract §4.1). `seasonPhase` is the current week's phase from
// `clock.phase` (written by init part N2 and step 1c). The planning readers answer from revealed dates and the
// forecast only, never from the hidden season drivers; until §1's climate package lands they return the contract's
// neutral values (operating, no forecast, no dates).
import type { DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { PhaseOutlook, SeasonForecast, SeasonPhase, SeasonView } from './types';

/** The district's phase this week; 'operating' for a district without a climate (P0 rules). */
export function seasonPhase(state: GameState, districtId: DistrictId): SeasonPhase {
  return state.clock.phase[districtId] ?? 'operating';
}

/** The phase of absolute week `turn` as far as the player can know it (s01 #9; unrolled years use climatology). */
export function phaseOutlook(_state: GameState, _districtId: DistrictId, _turn: number): PhaseOutlook {
  // CONTRACT-STUB(§1) climate.phaseOutlook
  return 'operating';
}

/** The current breakup and freeze-up date forecast (visible), or null when none has been issued. */
export function seasonForecast(state: GameState, districtId: DistrictId): SeasonForecast | null {
  // The forecast is the visible part of the hidden season record; it is copied, never aliased.
  const forecast = state.climate[districtId]?.seasons[state.clock.year]?.forecast;
  return forecast === undefined ? null : { ...forecast };
}

/** §13 and bots: revealed dates, the forecast and the phase (D-1.27). */
export function seasonView(state: GameState, districtId: DistrictId): SeasonView {
  // CONTRACT-STUB(§1) climate.seasonView
  return {
    districtId,
    year: state.clock.year,
    phase: seasonPhase(state, districtId),
    breakupWeek: null,
    operatingStartWeek: null,
    freezeUpWeek: null,
    operatingEndWeek: null,
    monsoonStartWeek: null,
    monsoonEndWeek: null,
    forecast: { asOfWeek: 0, breakup: null, freezeUp: null },
  };
}

/** §6's active weeks of a district year (consumer from P2). */
export function expectedActiveWeeks(_state: GameState, _districtId: DistrictId, _year: number): number {
  // CONTRACT-STUB(§1) climate.expectedActiveWeeks
  return 0;
}
