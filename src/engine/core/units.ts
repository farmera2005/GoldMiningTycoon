// Fixed unit conversions (DESIGN §2.4). Swell factors (bcy ↔ lcy) are tuning, not constants, and live in data/tuning.

/** Grams per troy ounce (exact by definition: 1 ozt = 31.1034768 g). */
export const GRAMS_PER_TROY_OZ = 31.1034768;
/** Milligrams per troy ounce as §3's particle model uses it (K = 31,103.5 mg/ozt, rounded as §3 3.8 states). */
export const MG_PER_TROY_OZ_PARTICLES = 31103.5;
/** Troy ounces per gram (1 g = 0.0321507 ozt, §2.4). */
export const TROY_OZ_PER_GRAM = 1 / GRAMS_PER_TROY_OZ;
/** Cubic yards per cubic metre (1 m³ = 1.307951 yd³). */
export const CUBIC_YARDS_PER_CUBIC_METRE = 1.307950619314392;
/** Grade conversion (D-2.24, D-13.14): 1 g/m³ = 0.024581 oz/yd³, the rounded figure DESIGN fixes for display. */
export const OZ_PER_YD3_PER_G_PER_M3 = 0.024581;

/** Grade in oz per bcy → g/m³ (the geologist panel's second unit). */
export function ozPerBcyToGPerM3(ozPerBcy: number): number {
  return ozPerBcy / OZ_PER_YD3_PER_G_PER_M3;
}

/** Grade in g/m³ → oz per bcy. */
export function gPerM3ToOzPerBcy(gPerM3: number): number {
  return gPerM3 * OZ_PER_YD3_PER_G_PER_M3;
}

/** Cubic feet per cubic yard, and the §3 block volume: 1 acre × 1 ft = 43,560 ft³ = 1,613.33 bcy. */
export const CUBIC_FEET_PER_CUBIC_YARD = 27;
export const SQUARE_FEET_PER_ACRE = 43560;
/** bcy in one acre-foot of ground (43,560 / 27). §3 rounds this to 1,613 bcy per acre-foot of thickness. */
export const BCY_PER_ACRE_FOOT = SQUARE_FEET_PER_ACRE / CUBIC_FEET_PER_CUBIC_YARD;
/** US gallons in one acre-foot of water. */
export const GALLONS_PER_ACRE_FOOT = 325851.4;
/** Minutes per hour, for gpm × hours → gallons. */
export const MINUTES_PER_HOUR = 60;
/** Short tons per metric tonne (§14 hard rock is in short tons). */
export const SHORT_TONS_PER_TONNE = 1.10231131;
