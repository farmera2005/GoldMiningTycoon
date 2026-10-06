// §8 staff slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (employees, candidates), then calls this for the slice's own invariants:
// each employee and candidate record's id is its key, the market, owner and supervision stores are present and the
// list stores are arrays. Returns the first problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const ID_KEYED = ['employees', 'candidates'];
const RECORDS = ['market', 'owner', 'unpaidWages', 'claimSafety', 'supervision', 'camps', 'flexHourPlan', 'leakage'];
const LISTS = ['injuries', 'separations', 'pendingRefs', 'recruiterOrders', 'staffingCharges'];

export function staffSliceProblem(slice: Readonly<Rec>): string | null {
  for (const store of ID_KEYED) {
    const rec = slice[store];
    if (!isRec(rec)) return `staff.${store}`;
    for (const id of sortedKeysByCodeUnit(rec)) {
      const item = rec[id];
      if (!isRec(item) || item['id'] !== id) return `staff.${store}.${id}`;
    }
  }
  for (const store of RECORDS) if (!isRec(slice[store])) return `staff.${store}`;
  for (const store of LISTS) if (!Array.isArray(slice[store])) return `staff.${store}`;
  const market = slice['market'] as Rec;
  if (!isRec(market['byDistrict'])) return 'staff.market.byDistrict';
  return null;
}
