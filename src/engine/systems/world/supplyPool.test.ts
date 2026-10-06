// DESIGN §3.7 / §3.11 steady-state listing-pool weights (listingPoolWeights).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { snapshotGenParams } from './params';
import { DEFAULT_LISTING_LIFE, listingPoolWeight, listingPoolWeights } from './supplyPool';

const GP = snapshotGenParams(baseTuning, []);

/** The same cycle integrated on a fine grid over the expiry's normal score (reference value). */
function reference(inflow: number, saleMult: number): number {
  const wait = 1 / (0.025 * ((25 * 1.4 + 8 * 1.2 + 19 * 0.6) / 52) * inflow);
  const p = 0.02 * saleMult;
  let life = 0;
  let sold = 0;
  let w = 0;
  for (let z = -8; z <= 8; z += 0.001) {
    const pdf = Math.exp((-z * z) / 2);
    const L = 16 * Math.exp(0.4 * z);
    const surv = Math.pow(1 - p, L);
    life += pdf * ((1 - surv) / p);
    sold += pdf * (1 - surv);
    w += pdf;
  }
  life /= w;
  sold /= w;
  const cooldown = (1 - sold) * 20 + sold * 52;
  return life / (wait + life + cooldown);
}

describe('listingPoolWeights (§3.7)', () => {
  it('matches the steady-state cycle: off-market wait, listing life against background sales, cooldown', () => {
    expect(listingPoolWeight('uneconomic', GP)).toBeCloseTo(reference(1.1, 0.7), 4);
    expect(listingPoolWeight('excellent', GP)).toBeCloseTo(reference(0.6, 2.5), 4);
  });

  it('lists poor ground more of the time than good ground (adverse selection, D-3.9)', () => {
    const w = listingPoolWeights(GP);
    expect(w.uneconomic).toBeGreaterThan(w.marginal);
    expect(w.marginal).toBeGreaterThan(w.good);
    expect(w.good).toBeGreaterThan(w.excellent);
    // ≈ 17% of held parcels are listed at any time (§3.11 expected flow).
    expect(w.marginal).toBeGreaterThan(0.12);
    expect(w.marginal).toBeLessThan(0.22);
    expect(DEFAULT_LISTING_LIFE.expiryMedianWk).toBe(16);
  });
});
