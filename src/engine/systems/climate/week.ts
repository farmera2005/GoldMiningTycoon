// §1 climate's week-1 initialization and weekly part (DESIGN §1 1.4.3, 1.5, 1.17; P1 contract §1.5 N2, §3 part 1.2).
//   N2 `initClimate`: per district (ascending), the `weather-init` draws (tempAnom, moistAnom, wetnessPrev; s01 #12),
//      the year-1 `season` roll, the week-1 forecasts, the turn-0 weather and `clock.phase`. A mean-calendar game
//      (fixture, s02 #3) draws nothing.
//   1.2 `seasonWeek`: per district ascending, (a) the week-1 season roll and pruning to the current and prior year,
//      (b) recorded §12 shifts, (c) `clock.phase`, reveals and `season.phaseChange` (info, S12-8), (d) forecasts on
//      issue weeks and `season.forecastUpdate`, (e) the weather draw and state and `weather.severe` (s01 #10).
// Both are no-ops until §1's climate package lands, so a P1 game sees every district 'operating' in neutral weather.
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function initClimate(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§1) climate.initClimate
}

export function seasonWeek(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§1) climate.seasonWeek
}
