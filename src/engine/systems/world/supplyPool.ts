// The steady-state listing pool (DESIGN §3.7, §3.11): what share of time a held parcel of each class spends listed.
// One cycle is an off-market wait (1 / (baseListHazard × mean seasonMult × inflowMult)), a listing life (§5's expiry
// L ~ 16 × LN(1, 0.4) weeks competing with background sales at backgroundSaleP × saleQualityMult), then a cooldown
// (relist 20 wk after expiry, 52 wk after a sale). Simulator and calibration only (listingPoolWeights).
import { pow } from '../../core/dmath';
import { exp } from '../../core/dmath';
import type { EconClass, GeoGenParams } from './types';

/** §5's listing-life terms (owned by §5's tuning; DESIGN 3.7 calibrated with these values). */
export interface ListingLifeParams {
  readonly expiryMedianWk: number;
  readonly expirySigma: number;
  readonly backgroundSaleP: number;
}

export const DEFAULT_LISTING_LIFE: ListingLifeParams = { expiryMedianWk: 16, expirySigma: 0.4, backgroundSaleP: 0.02 };

// Five-point Gauss–Hermite rule for E[f(Z)], Z ~ N(0, 1) (probabilists' nodes and weights).
const GH_Z = [-2.856970013872806, -1.355626179974266, 0, 1.355626179974266, 2.856970013872806];
const GH_W = [0.011257411327721, 0.222075922005613, 0.533333333333333, 0.222075922005613, 0.011257411327721];

/** Steady-state listed share of a held parcel of class `cls`. */
export function listingPoolWeight(
  cls: EconClass,
  gp: GeoGenParams,
  life: ListingLifeParams = DEFAULT_LISTING_LIFE,
): number {
  const S = gp.supply;
  const wait = 1 / (S.baseListHazard * S.seasonMultMean * S.inflowMult[cls]);
  const p = life.backgroundSaleP * S.saleQualityMult[cls];
  let meanLife = 0;
  let pSold = 0;
  for (let k = 0; k < GH_Z.length; k++) {
    const L = life.expiryMedianWk * exp(life.expirySigma * (GH_Z[k] as number));
    const survive = pow(1 - p, L);
    meanLife += (GH_W[k] as number) * ((1 - survive) / p);
    pSold += (GH_W[k] as number) * (1 - survive);
  }
  const cooldown = (1 - pSold) * S.relistCooldownWk + pSold * S.postSaleCooldownWk;
  return meanLife / (wait + meanLife + cooldown);
}

/** listingPoolWeights (§3.7): per-class weights for held parcels. */
export function listingPoolWeights(
  gp: GeoGenParams,
  life: ListingLifeParams = DEFAULT_LISTING_LIFE,
): Record<EconClass, number> {
  return {
    uneconomic: listingPoolWeight('uneconomic', gp, life),
    marginal: listingPoolWeight('marginal', gp, life),
    good: listingPoolWeight('good', gp, life),
    excellent: listingPoolWeight('excellent', gp, life),
  };
}
