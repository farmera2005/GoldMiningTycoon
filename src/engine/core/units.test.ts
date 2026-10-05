import { describe, expect, it } from 'vitest';
import {
  BCY_PER_ACRE_FOOT,
  CUBIC_YARDS_PER_CUBIC_METRE,
  GRAMS_PER_TROY_OZ,
  OZ_PER_YD3_PER_G_PER_M3,
  TROY_OZ_PER_GRAM,
  gPerM3ToOzPerBcy,
  ozPerBcyToGPerM3,
} from './units';

describe('unit conversions (DESIGN §2.4, D-2.24)', () => {
  it('1 g/m³ = 0.024581 oz/yd³, consistent with 1 g = 0.0321507 ozt and 1 m³ = 1.307951 yd³', () => {
    expect(TROY_OZ_PER_GRAM).toBeCloseTo(0.0321507, 7);
    expect(CUBIC_YARDS_PER_CUBIC_METRE).toBeCloseTo(1.307951, 6);
    expect(1 / GRAMS_PER_TROY_OZ / CUBIC_YARDS_PER_CUBIC_METRE).toBeCloseTo(OZ_PER_YD3_PER_G_PER_M3, 6);
    expect(OZ_PER_YD3_PER_G_PER_M3).toBe(0.024581);
  });

  it('converts the worked grade: 0.012 oz/yd³ = 0.488 g/m³', () => {
    expect(ozPerBcyToGPerM3(0.012)).toBeCloseTo(0.488, 3);
    expect(gPerM3ToOzPerBcy(ozPerBcyToGPerM3(0.0095))).toBeCloseTo(0.0095, 15);
    expect(ozPerBcyToGPerM3(0.0095)).toBeCloseTo(0.39, 2); // §13 T1: 0.0095 oz/bcy (0.39 g/m³)
  });

  it('has 1,613 bcy per acre-foot (§3 block: 1 ft of thickness)', () => {
    expect(Math.round(BCY_PER_ACRE_FOOT)).toBe(1613);
  });
});
