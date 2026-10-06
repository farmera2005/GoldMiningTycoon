// Fixed physical constants of the §3 world (DESIGN §3.1, §3.8). Not tuning: a block IS one acre, one foot of it IS
// 1,613 bcy, and these define the grid every save is stored on.
import { MG_PER_TROY_OZ_PARTICLES } from '../../core/units';

/** One block is 1 acre = 209 × 209 ft (§3.1). */
export const BLOCK_FT = 209;
/** Half a block width, the overlap kernel's half-span. */
export const HALF_BLOCK_FT = BLOCK_FT / 2;
/** §3.1: 1 ft of thickness over one acre = 1,613 bcy (43,560 / 27 = 1,613.33, rounded as DESIGN fixes it). */
export const BCY_PER_ACRE_FT = 1613;
export const FT_PER_MI = 5280;
/** mg per troy oz in the particle model (K = 31,103.5, §3.8). */
export const MG_PER_OZ = MG_PER_TROY_OZ_PARTICLES;
/** Index of each size class in the [coarse, medium, fine, ultrafine] tuples. */
export const COARSE = 0;
export const DEG = Math.PI / 180;

/** Valley grid dims by acreage and half-width (§3.1 table). Benches are 2 across (§3.4). */
export function valleyDims(acres: number, valleyHalfWidthFt: number): { nAlong: number; nAcross: number } {
  switch (acres) {
    case 20:
      return { nAlong: 5, nAcross: 4 };
    case 40:
      return { nAlong: 10, nAcross: 4 };
    case 80:
      return valleyHalfWidthFt >= 700 ? { nAlong: 10, nAcross: 8 } : { nAlong: 20, nAcross: 4 };
    case 160:
      return valleyHalfWidthFt >= 700 ? { nAlong: 20, nAcross: 8 } : { nAlong: 40, nAcross: 4 };
    default:
      throw new RangeError(`valleyDims: unsupported claim size ${acres} ac`);
  }
}

export function benchDims(acres: number): { nAlong: number; nAcross: number } {
  if (acres === 20) return { nAlong: 10, nAcross: 2 };
  if (acres === 40) return { nAlong: 20, nAcross: 2 };
  throw new RangeError(`benchDims: benches are 20 or 40 ac, got ${acres}`);
}
