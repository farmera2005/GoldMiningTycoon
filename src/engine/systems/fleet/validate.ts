// §9 fleet slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (machines, listings, workOrders), then calls this for the slice's own
// invariants: each id-keyed record's id is its key, a machine's location is a known kind, and the policy, market and
// sale log are present. Returns the first problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const ID_KEYED = [
  'machines',
  'listings',
  'auctions',
  'orders',
  'workOrders',
  'partsOrders',
  'contracts',
  'transports',
  'inspections',
  'callouts',
  'sales',
];
const RECORDS = ['parts', 'shopPolicy', 'shopBays', 'dealers', 'market'];
const LOCATION_KINDS: readonly string[] = ['claim', 'yard', 'dealer', 'auctionSite', 'town', 'transit'];

export function fleetSliceProblem(slice: Readonly<Rec>): string | null {
  for (const store of ID_KEYED) {
    const rec = slice[store];
    if (!isRec(rec)) return `fleet.${store}`;
    for (const id of sortedKeysByCodeUnit(rec)) {
      const item = rec[id];
      if (!isRec(item) || item['id'] !== id) return `fleet.${store}.${id}`;
    }
  }
  for (const store of RECORDS) if (!isRec(slice[store])) return `fleet.${store}`;
  if (!Array.isArray(slice['saleLog'])) return 'fleet.saleLog';
  const machines = slice['machines'] as Rec;
  for (const id of sortedKeysByCodeUnit(machines)) {
    const loc = (machines[id] as Rec)['location'];
    if (!isRec(loc) || !LOCATION_KINDS.includes(String(loc['kind'])) || typeof loc['id'] !== 'string') {
      return `fleet.machines.${id}.location`;
    }
  }
  return null;
}
