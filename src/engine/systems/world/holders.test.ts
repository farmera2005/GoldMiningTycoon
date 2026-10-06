// NPC holders (DESIGN §3.10.1): runs, grouping and the fixed per-parcel draw order (§2.3 stream rule e), so a groupRunP
// retune never moves another holder's situation, honesty or name.
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { formatId, type ClaimId, type HolderId } from '../../core/ids';
import { rng } from '../../core/rng';
import { assignHolders, heldRuns } from './holders';
import { snapshotGenParams } from './params';
import type { GeoGenParams, SellerProfile } from './types';

const GP = snapshotGenParams(baseTuning, []);

interface Parcel {
  readonly id: ClaimId;
  readonly creekIdx: number;
  readonly side: -1 | 0 | 1;
  readonly rowStart: number;
  readonly nAlong: number;
}

/** A held set with single parcels, short runs and one run longer than maxParcelsPerHolder (6). */
function heldSet(): Parcel[] {
  const out: Parcel[] = [];
  let n = 0;
  const add = (creekIdx: number, side: -1 | 0 | 1, rows: readonly number[]): void => {
    for (const rowStart of rows) out.push({ id: formatId('clm', ++n), creekIdx, side, rowStart, nAlong: 5 });
  };
  add(0, 0, [0, 5, 10]); // one run of 3
  add(0, 0, [30]); // single
  add(0, 1, [0, 5]); // bench run of 2
  add(1, 0, [0, 5, 10, 15, 20, 25, 30, 35]); // a run of 8: grouped as 6 + 2
  add(1, 0, [60]); // single
  add(2, 0, [12, 40, 45]); // single + run of 2
  return out;
}

function withGroupP(p: number): GeoGenParams {
  return { ...GP, seller: { ...GP.seller, groupRunP: p } };
}

function holders(seed: string, p: number): SellerProfile[] {
  let n = 0;
  return assignHolders(rng(seed, 'world', 'holders', 'dst_000001'), heldSet(), withGroupP(p), () =>
    formatId('hld', ++n),
  );
}

const facts = (h: SellerProfile): unknown => ({ situation: h.situation, honesty: h.honesty, name: h.displayName });

/** Each parcel → the holder that holds it. */
function holderOf(hs: readonly SellerProfile[]): Map<ClaimId, SellerProfile> {
  const out = new Map<ClaimId, SellerProfile>();
  for (const h of hs) for (const c of h.claimIds) out.set(c, h);
  return out;
}

describe('assignHolders (§3.10.1)', () => {
  it('finds contiguous runs on the same creek and side, ordered by their first claim id', () => {
    const runs = heldRuns(heldSet()).map((r) => r.map((p) => p.id));
    expect(runs.map((r) => r.length)).toEqual([3, 1, 2, 8, 1, 1, 2]);
  });

  it('gives every held parcel exactly one holder and caps a group at six parcels', () => {
    for (const p of [0, 0.5, 1]) {
      const hs = holders('hold-cap', p);
      const all = hs.flatMap((h) => h.claimIds);
      expect(all.slice().sort()).toEqual(heldSet().map((x) => x.id));
      for (const h of hs) expect(h.claimIds.length).toBeLessThanOrEqual(6);
    }
    expect(holders('hold-cap', 1).map((h) => h.claimIds.length)).toEqual([3, 1, 2, 6, 2, 1, 1, 2]);
  });

  it('a groupRunP retune keeps every single-parcel holder’s situation, honesty and name', () => {
    let compared = 0;
    for (let s = 0; s < 40; s++) {
      const a = holderOf(holders(`hold-${s}`, 0.5));
      const b = holderOf(holders(`hold-${s}`, 0.6));
      for (const [claim, ha] of a) {
        const hb = b.get(claim) as SellerProfile;
        if (ha.claimIds.length !== 1 || hb.claimIds.length !== 1) continue;
        expect(facts(hb)).toEqual(facts(ha));
        compared++;
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('a grouped holder carries the draws its lowest-id parcel would have had alone', () => {
    for (let s = 0; s < 40; s++) {
      const singles = holderOf(holders(`hold-${s}`, 0));
      for (const h of holders(`hold-${s}`, 1)) {
        const alone = singles.get(h.claimIds[0] as ClaimId) as SellerProfile;
        expect(facts(h)).toEqual(facts(alone));
      }
    }
  });

  it('takes a fixed number of draws whatever the grouping', () => {
    const count = (p: number): number => {
      const r = rng('hold-draws', 'world', 'holders', 'dst_000001');
      assignHolders(r, heldSet(), withGroupP(p), () => 'hld_000001' as HolderId);
      return r.drawCount;
    };
    expect(count(0.5)).toBe(count(0));
    expect(count(1)).toBe(count(0));
  });
});
