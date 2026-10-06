// §1 climate selectors (DESIGN §2.11; P1 contract §4.1): pure readers over state, spread into `select` by
// select/index.ts. None reads a hidden field (season drivers, unrevealed dates, the weather state). A name already used
// by another folder fails the composition test.
import { accessOpen, accessOutlook } from './access';
import { phaseOutlook, seasonForecast, seasonPhase, seasonView } from './season';
import { fireLevel, weather } from './weather';

export const climateSelectors = {
  seasonPhase,
  phaseOutlook,
  seasonForecast,
  seasonView,
  weather,
  fireLevel,
  accessOpen,
  accessOutlook,
} as const;
