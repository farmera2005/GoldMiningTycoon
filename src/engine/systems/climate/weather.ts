// §1 weather readers (DESIGN §1 1.5, 1.18; P1 contract §4.1). The week's weather is visible: step 1 stores it in the
// district's climate record, so `weather` reads it there, and a district without a climate (P0 rules) reads the
// neutral week. The hours multiplier §7 applies (heat and fire-level hours, s07 #18) and the fire-level day-shift cap
// arrive with §1's climate package.
import type { Calc, ExplainCtx } from '../../core/calc';
import type { DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { WeatherWeek } from './types';

/** The neutral week every reader sees before §1 rolls weather (and in a P0 game). */
export const NEUTRAL_WEATHER: Readonly<WeatherWeek> = {
  tempBand: 'mild',
  precip: 'normal',
  streamFlowFactor: 1,
  fireDanger: 0,
  meanTempF: 60,
  fireLevel: 0,
};

/** This week's weather in the district (visible; a copy). */
export function weather(state: GameState, districtId: DistrictId): WeatherWeek {
  return { ...(state.climate[districtId]?.weather ?? NEUTRAL_WEATHER) };
}

/** The fire level 0–4 this week. */
export function fireLevel(state: GameState, districtId: DistrictId): WeatherWeek['fireLevel'] {
  return (state.climate[districtId]?.weather ?? NEUTRAL_WEATHER).fireLevel;
}

/** §7's weather hours multiplier for a shift (P1: heat × fire-level hours; precipitation from P5). */
export function weatherHoursMult(_state: GameState, _districtId: DistrictId, _shift: 0 | 1, _ex: ExplainCtx): Calc {
  // CONTRACT-STUB(§1) climate.weatherHoursMult
  return { value: 1 };
}

/** Fire level 3 caps the day shift at `ops.fireLevel3DayShiftMaxHours` (contract); null = no cap. */
export function shiftHoursCap(_state: GameState, _districtId: DistrictId, _shift: 0 | 1): number | null {
  // CONTRACT-STUB(§1) climate.shiftHoursCap
  return null;
}
