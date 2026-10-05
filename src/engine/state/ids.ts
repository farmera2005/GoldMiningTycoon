// Id counters seeded from generated data (DESIGN §2.4). §3's generateWorld mints its ids (dst, crk, clm, blk, hld)
// with counters of its own and returns only the WorldSlice, so newGame advances `state.ids` past every canonical id
// found in the generated data; a later nextId can then never collide with a generated id.
import { parseId } from '../core/ids';
import { sortedKeysByCodeUnit } from '../core/iter';
import type { IdCounters } from './types';

function note(counters: IdCounters, s: string): void {
  const parsed = parseId(s);
  if (parsed === null || parsed.num === null) return;
  if ((counters[parsed.prefix] ?? 0) < parsed.num) counters[parsed.prefix] = parsed.num;
}

/** Raises each counter to the highest canonical id of its prefix found anywhere in `value` (keys and strings). */
export function reserveIdsFrom(value: unknown, counters: IdCounters): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const v = stack.pop();
    if (typeof v === 'string') {
      note(counters, v);
    } else if (Array.isArray(v)) {
      for (const item of v) stack.push(item);
    } else if (typeof v === 'object' && v !== null) {
      const rec = v as Record<string, unknown>;
      for (const key of sortedKeysByCodeUnit(rec)) {
        note(counters, key);
        stack.push(rec[key]);
      }
    }
  }
}
