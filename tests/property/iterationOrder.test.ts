// Iteration-order independence (DESIGN §2.3 item 3, §2.14): permuting the insertion order of every Record in state
// leaves the week's result unchanged (state hash and the order-sensitive report), and every `…Ids` array equals its
// Record's keys in compareIds order.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareIds } from '../../src/engine';
import { registerTestActions } from '../../src/engine/actions/testActions';
import {
  WORLD_TIMEOUT_MS,
  fcParams,
  idsArrayProblems,
  mulberry32,
  newP0,
  permuteRecords,
  play,
  seedArb,
  weekPlanArb,
} from './helpers';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

describe('iteration-order independence', () => {
  it(
    'a permuted copy of any reachable state plays on identically',
    () => {
      fc.assert(
        fc.property(seedArb, weekPlanArb(6), weekPlanArb(6), fc.integer(), (seed, before, after, shuffleSeed) => {
          const reached = play(newP0(seed), before).state;
          const permuted = permuteRecords(reached, mulberry32(shuffleSeed));
          const a = play(reached, after);
          const b = play(permuted, after);
          expect(b.hashes).toEqual(a.hashes);
          // Reports are compared as JSON text, where arrays and key order both count.
          expect(JSON.stringify(b.reports)).toBe(JSON.stringify(a.reports));
          expect(idsArrayProblems(a.state, compareIds)).toEqual([]);
          expect(idsArrayProblems(b.state, compareIds)).toEqual([]);
          for (const ids of Object.values(a.state.events.modifierIdsByTarget)) {
            expect([...ids].sort(compareIds)).toEqual(ids);
          }
        }),
        fcParams(1337, 30),
      );
    },
    WORLD_TIMEOUT_MS,
  );
});
