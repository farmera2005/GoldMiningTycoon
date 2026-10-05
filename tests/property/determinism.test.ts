// Determinism under replay (DESIGN §2.3, §2.14): same seed + setup + action log ⇒ byte-identical states and reports.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  REPLAY_FORMAT,
  advanceWeek,
  applyAction,
  hashState,
  newGame,
  replayLog,
  type LoggedAction,
} from '../../src/engine';
import { asAction, registerTestActions } from '../../src/engine/actions/testActions';
import { P0_SETUP, WORLD_TIMEOUT_MS, fcParams, newP0, play, seedArb, weekPlanArb } from './helpers';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

describe('determinism under replay', () => {
  it(
    'newGame builds the same state from the same seed and setup (fresh builds, no shared objects)',
    () => {
      for (const seed of ['fresh-1', 'fresh-2']) {
        const a = newGame(P0_SETUP, seed);
        const b = newGame(P0_SETUP, seed);
        expect(a).not.toBe(b);
        expect(hashState(b)).toBe(hashState(a));
      }
    },
    WORLD_TIMEOUT_MS,
  );

  it(
    'two plays of the same seed and actions give identical per-week hashes and reports',
    () => {
      fc.assert(
        fc.property(seedArb, weekPlanArb(12), (seed, plan) => {
          const a = play(newP0(seed), plan);
          const b = play(newP0(seed), plan);
          expect(b.hashes).toEqual(a.hashes);
          expect(JSON.stringify(b.reports)).toBe(JSON.stringify(a.reports));
        }),
        fcParams(20261005, 40),
      );
    },
    WORLD_TIMEOUT_MS,
  );

  it(
    'an action log recorded during play replays to the same end-of-turn hashes',
    () => {
      // Each replay rebuilds its world from the log, so this property keeps its run count small.
      fc.assert(
        fc.property(seedArb, weekPlanArb(10), (seed, plan) => {
          // Record what a client logs: the actions that applied, with the turn and actionSeq they applied at.
          let s = newP0(seed);
          const log: LoggedAction[] = [];
          const endOfTurn: string[] = [];
          for (const actions of plan) {
            for (const a of actions) {
              const r = applyAction(s, asAction(a));
              if (!r.ok) continue;
              s = r.state;
              log.push({ turn: s.clock.turn, actionSeq: s.clock.actionSeq, action: asAction(a) });
            }
            endOfTurn.push(hashState(s));
            s = advanceWeek(s).state;
          }
          endOfTurn.push(hashState(s));
          const replayed = replayLog({
            format: REPLAY_FORMAT,
            version: 1,
            seed,
            setup: P0_SETUP,
            weeks: plan.length,
            actions: log,
          });
          expect(replayed.hashes.map((h) => h.hash)).toEqual(endOfTurn);
        }),
        fcParams(4242, 8),
      );
    },
    WORLD_TIMEOUT_MS,
  );
});
