// §5 land slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (tenures, listings, negotiations, auctions, interests, closings,
// diligence, stakings, jvs), then calls this for the slice's own invariants: each stored record's id is its key, a
// tenure's claim exists in its record, and the seller memory and pending true-ups are present. Returns the first
// problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const ID_KEYED = ['tenures', 'listings', 'negotiations', 'auctions', 'interests', 'closings', 'diligence', 'stakings', 'jvs'];

export function landSliceProblem(slice: Readonly<Rec>): string | null {
  for (const store of ID_KEYED) {
    const rec = slice[store];
    if (!isRec(rec)) return `land.${store}`;
    for (const id of sortedKeysByCodeUnit(rec)) {
      const item = rec[id];
      if (!isRec(item) || item['id'] !== id) return `land.${store}.${id}`;
    }
  }
  const tenures = slice['tenures'] as Rec;
  for (const id of sortedKeysByCodeUnit(tenures)) {
    if (typeof (tenures[id] as Rec)['claimId'] !== 'string') return `land.tenures.${id}.claimId`;
  }
  if (!isRec(slice['sellerMemory']) || !Array.isArray(slice['pendingTrueUps'])) return 'land stores';
  return null;
}
