// §12 events slice check at load (DESIGN §2.9, D-2.43; P1 contract §1.7). save/validate.ts first checks every top-level
// `…Ids` array of the slice against its Record (active, preps), then calls this for the slice's own invariants: each
// modifier's id is its key and it is indexed under its target, every index entry names a stored modifier, the version
// counter is a non-negative integer, and the director, cooldowns and lists are present. Returns the first problem as
// text (reported as SAVE_CORRUPT), or null.
import { sortedKeysByCodeUnit } from '../../core/iter';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

export function eventsSliceProblem(slice: Readonly<Rec>): string | null {
  const modifiers = slice['modifiers'];
  const index = slice['modifierIdsByTarget'];
  if (!isRec(modifiers) || !isRec(index)) return 'events.modifiers';
  const version = slice['modifiersVersion'];
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) return 'events.modifiersVersion';
  for (const id of sortedKeysByCodeUnit(modifiers)) {
    const m = modifiers[id];
    if (!isRec(m) || m['id'] !== id || typeof m['target'] !== 'string') return `events.modifiers.${id}`;
    const ids = index[m['target']];
    if (!Array.isArray(ids) || !ids.includes(id)) return `events.modifierIdsByTarget.${m['target']}`;
  }
  for (const target of sortedKeysByCodeUnit(index)) {
    const ids = index[target];
    if (!Array.isArray(ids)) return `events.modifierIdsByTarget.${target}`;
    for (const id of ids) {
      if (typeof id !== 'string' || !isRec(modifiers[id])) return `events.modifierIdsByTarget.${target}`;
    }
  }
  for (const store of ['active', 'preps', 'annualCounts', 'cooldowns', 'categoryBlockedUntil', 'director']) {
    if (!isRec(slice[store])) return `events.${store}`;
  }
  for (const store of ['history', 'scheduled']) if (!Array.isArray(slice[store])) return `events.${store}`;
  return null;
}
