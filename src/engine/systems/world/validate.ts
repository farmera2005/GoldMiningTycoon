// §3 world slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record, then calls this for the slice's own invariants: the P1 stores are
// present and every found tell sits under its own '<listingId>/<tellKind>' key. Returns the first problem as text
// (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

export function worldSliceProblem(slice: Readonly<Rec>): string | null {
  const tells = slice['foundTells'];
  if (!isRec(tells)) return 'world.foundTells';
  for (const key of sortedKeysByCodeUnit(tells)) {
    const t = tells[key];
    if (!isRec(t) || key !== `${String(t['listingId'])}/${String(t['kind'])}`) return `world.foundTells.${key}`;
  }
  if (!isRec(slice['siteVisits']) || !Array.isArray(slice['supplyQueue'])) return 'world stores';
  return null;
}
