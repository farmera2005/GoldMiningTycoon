// §10 gold slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (buyers, lots, moves, shipments, forwards, puts), then calls this for the
// slice's own invariants: each id-keyed record's id is its key, every lot's weight is a non-negative integer of
// milli-ounces, and the standing order, archive, inventory identity and week accumulator are present. Returns the
// first problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const ID_KEYED = ['buyers', 'lots', 'shipments', 'forwards'];
const RECORDS = [
  'claimFineness',
  'standingOrder',
  'archive',
  'createdRawMilliOz',
  'weekSales',
  'storage',
  'moves',
  'metalAccounts',
  'refineryHistory',
  'puts',
];

export function goldSliceProblem(slice: Readonly<Rec>): string | null {
  for (const store of ID_KEYED) {
    const rec = slice[store];
    if (!isRec(rec)) return `gold.${store}`;
    for (const id of sortedKeysByCodeUnit(rec)) {
      const item = rec[id];
      if (!isRec(item) || item['id'] !== id) return `gold.${store}.${id}`;
    }
  }
  for (const store of RECORDS) if (!isRec(slice[store])) return `gold.${store}`;
  if (!Array.isArray(slice['sales'])) return 'gold.sales';
  const lots = slice['lots'] as Rec;
  for (const id of sortedKeysByCodeUnit(lots)) {
    const raw = (lots[id] as Rec)['rawMilliOz'];
    if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) return `gold.lots.${id}.rawMilliOz`;
  }
  return null;
}
