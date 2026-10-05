// Explain-flag invariance (DESIGN §2.2, §2.14; §13 T18, D-13.36): for 20 seeds × 52 weeks, advanceWeek with explain on
// and off gives identical state hashes; only the WeekReport's calc and hints differ.
import { describe, expect, it } from 'vitest';
import { advanceWeek, hashState } from '../../src/engine';
import { WORLD_TIMEOUT_MS, firstDifference, newP0 } from './helpers';

const SEEDS = Array.from({ length: 20 }, (_, i) => `t18-${i}`);
const WEEKS = 52;

describe('T18 explain invariance', () => {
  it.each(SEEDS)(
    'seed %s: 52 weeks with explain on and off stay identical',
    (seed) => {
      // Both runs start from one state object, so subtrees neither run touches stay shared and compare by reference.
      const start = newP0(seed);
      let off = start;
      let on = start;
      for (let w = 0; w < WEEKS; w++) {
        const a = advanceWeek(off, { explain: false });
        const b = advanceWeek(on, { explain: true });
        off = a.state;
        on = b.state;
        expect(firstDifference(on, off), `week ${w + 1}`).toBeNull();
        expect(a.report.calc).toBeUndefined();
        expect(b.report.calc).toBeDefined();
        const { calc: _c, hints: _h, ...rest } = b.report;
        expect(rest).toEqual(a.report);
      }
      expect(hashState(on)).toBe(hashState(off));
    },
    WORLD_TIMEOUT_MS,
  );
});
