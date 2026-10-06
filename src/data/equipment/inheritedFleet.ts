// The Inheritor's worn fleet (DESIGN §1 1.8.2, §9 9.3.3, D-9.61): model, age, hours and options of all eight items,
// which §9's `materializeInheritedFleet` turns into grade-D machines on the family claim (P1). §1 1.8.2 gives the
// ages and three of the meters; the other hours are chosen so that each item's `resaleEstimate` (FMV at condRef ×
// `fleet.p1GradePriceMult.D`, 9.3.2) lands on §1's figure. Camps and pickups use the light curve (hours weight 0.3)
// like pumps and generators, and site items accrue no meter hours in play, so their hours only price them.
//
// Formula output at turn 0 (cpi 1, brand multipliers 1, grade D 0.70), restated into §1 1.8.2 by D-9.61:
//   ex30   24 yr / 21,500 h  ageEq 19.17  dep 0.1167  $35.1k
//   dz6    30 yr / 26,000 h  ageEq 23.67  dep 0.1327  $48.3k + ripper ($35k × the same factors) $3.3k = $51.5k
//   ld950  22 yr / 18,000 h  ageEq 17.00  dep 0.1188  $31.6k
//   tr50   18 yr / 12,000 h  ageEq 15.00  dep 0.1159  $9.7k   (chosen: ≈ 670 h a season, a plant's 0.6 × 1,150)
//   pmp6   12 yr /  8,000 h  ageEq 10.00  dep 0.2349  $6.2k   (chosen: ≈ 670 h a season)
//   gen100 15 yr / 30,000 h  ageEq 16.50  dep 0.1244  $4.4k
//   pickup 14 yr /  9,000 h  ageEq 11.60  dep 0.1978  $9.0k   (chosen: engine hours ≈ 640 a year)
//   campT8 15 yr / 10,500 h  ageEq 12.60  dep 0.1785  $5.0k   (chosen: ≈ 700 occupied hours a season)
//   total ≈ $152.6k (§1: ≈ $152k)
import type { InheritedFleetSpecRow } from './types';

export const inheritedFleetSpec = {
  items: [
    { modelId: 'ex30', ageYears: 24, hours: 21_500, options: [] },
    { modelId: 'dz6', ageYears: 30, hours: 26_000, options: ['ripper'] },
    { modelId: 'ld950', ageYears: 22, hours: 18_000, options: [] },
    { modelId: 'tr50', ageYears: 18, hours: 12_000, options: [] },
    { modelId: 'pmp6', ageYears: 12, hours: 8_000, options: [] },
    { modelId: 'gen100', ageYears: 15, hours: 30_000, options: [] },
    { modelId: 'pickup', ageYears: 14, hours: 9_000, options: [] },
    { modelId: 'campT8', ageYears: 15, hours: 10_500, options: [] },
  ],
} as const satisfies InheritedFleetSpecRow;
