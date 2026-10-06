// §1 climate's week record (P1 contract §1.3): the visible facts of the week per district, written in step 1 and
// carried by `WeekReport.records.climate`. Visible data only: season drivers and unrevealed dates never appear here.
import type { DistrictId } from '../../core/ids';
import type { SeasonPhase, WeatherWeek } from './types';

export interface ClimateWeekRecord {
  byDistrict: Record<DistrictId, { phase: SeasonPhase; weather: WeatherWeek; forecastIssued: boolean }>;
}

export function emptyClimateWeekRecord(): ClimateWeekRecord {
  return { byDistrict: {} };
}
