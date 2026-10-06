// §6 permits slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (`obligationIds` ↔ `obligations`), then calls this: each obligation's id
// is its key and its status is one of 6.9's. Returns the first problem as text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

const STATUSES = ['upcoming', 'due', 'satisfied', 'missed', 'waived', 'cancelled', 'cured', 'inPlan'];

export function permitsSliceProblem(slice: Readonly<Rec>): string | null {
  const obligations = slice['obligations'];
  if (!isRec(obligations)) return 'permits.obligations';
  for (const id of sortedKeysByCodeUnit(obligations)) {
    const o = obligations[id];
    if (!isRec(o) || o['id'] !== id || !STATUSES.includes(String(o['status']))) return `permits.obligations.${id}`;
  }
  return null;
}
