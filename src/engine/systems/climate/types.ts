// §1 climate slice of GameState (DESIGN §1 1.4–1.5, §2.5). The shapes are §1's; the season roll, forecasts and weather
// draws that fill them arrive in P1 (§1 1.19). In P0 the slice is an empty Record and pipeline step 1 rolls nothing.
import type { DistrictId } from '../../core/ids';

/** Per district per week (§1 1.4.2). Arid districts are 'operating' every week. */
export type SeasonPhase = 'winter' | 'breakup' | 'operating' | 'freezeup';

/** `clock.phase` (§2.5): the current phase of every district that has a climate. */
export type SeasonPhaseByDistrict = Record<DistrictId, SeasonPhase>;

export interface SeasonForecast {
  asOfWeek: number;
  breakup: { p10: number; p50: number; p90: number } | null;
  freezeUp: { p10: number; p50: number; p90: number } | null;
}

/** §1 1.4.3: one district's season for one year. `z` and unrevealed dates are hidden truth. */
export interface DistrictYearSeason {
  districtId: DistrictId;
  year: number;
  breakupWeek: number | null;
  operatingStartWeek: number;
  freezeUpWeek: number | null;
  operatingEndWeek: number;
  winterResumesWeek: number | null;
  breakupDurWeeks: number | null;
  freezeDurWeeks: number | null;
  monsoonStartWeek: number | null;
  monsoonEndWeek: number | null;
  z: { breakup: number; freezeUp: number; wetness: number; heat: number };
  revealed: { breakup: boolean; operatingStart: boolean; freezeUp: boolean };
  forecast: SeasonForecast;
  shifts: { breakupWeeks: number; freezeUpWeeks: number };
}

/** §1 1.5: this week's weather in one district (player-visible). */
export interface WeatherWeek {
  tempBand: 'deepCold' | 'cold' | 'cool' | 'mild' | 'hot';
  precip: 'dry' | 'normal' | 'wet' | 'storm';
  streamFlowFactor: number;
  fireDanger: number;
  meanTempF: number;
  fireLevel: 0 | 1 | 2 | 3 | 4;
}

/** §1 1.5: hidden persistence terms of the weather model. */
export interface WeatherState {
  tempAnom: number;
  moistAnom: number;
  flowAnom: number;
  drought: number;
}

export interface DistrictClimate {
  seasons: Record<number, DistrictYearSeason>;
  weather: WeatherWeek;
  lastWeather: WeatherWeek | null;
  sffLast4: number[];
  state: WeatherState;
  wetnessPrev: number;
}

/** §1 1.5 `ClimateSlice` (D-1.35): keyed by district. Empty in P0. */
export type ClimateSlice = Record<DistrictId, DistrictClimate>;

export function emptyClimateSlice(): ClimateSlice {
  return {};
}
