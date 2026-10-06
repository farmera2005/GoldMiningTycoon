// §1 climate explainers (DESIGN §2.8; P1 contract §4.1): pure (state, ...args) → CalcNode, spread into `explain` by
// explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). A name already used by another folder fails the
// composition test. Calc nodes built from the hidden season drivers are tagged hidden with a knownAlt (s01 #27).
import type { CalcNode } from '../../core/calc';
import type { DistrictId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

/** The breakup and freeze-up forecast of a district (P50 week). */
function seasonForecastExplain(_state: GameState, _districtId: DistrictId): CalcNode {
  // CONTRACT-STUB(§1) climate.explain.seasonForecast
  return stubCalcNode('Season forecast', 'weeks');
}

/** The weather hours multiplier of a shift. */
function weatherHoursMultExplain(_state: GameState, _districtId: DistrictId, _shift: 0 | 1): CalcNode {
  // CONTRACT-STUB(§1) climate.explain.weatherHoursMult
  return stubCalcNode('Weather hours multiplier', 'mult');
}

export const climateExplainers = {
  seasonForecast: seasonForecastExplain,
  weatherHoursMult: weatherHoursMultExplain,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
