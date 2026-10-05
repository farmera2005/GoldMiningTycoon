// Undo semantics (DESIGN §2.2, §2.14, D-2.22; §13 T10): any action whose handler drew from a stream, or whose row
// reveals or commits, returns undoable: false; an undoable action applied and undone restores a deep-equal state
// (undo keeps the pre-action state, which applying never mutates), and redoing it reproduces the same result.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAction, hashState, type GameState } from '../../src/engine';
import { asAction, registerTestActions, type TestAction } from '../../src/engine/actions/testActions';
import { WORLD_TIMEOUT_MS, fcParams, newP0, seedArb, testActionArb } from './helpers';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

/** What the engine must report for each test row: draws, reveals and commitments make an action non-undoable. */
function expectedUndoable(a: TestAction): boolean {
  switch (a.type) {
    case 'test/transfer':
    case 'test/decide':
    case 'test/liquidate':
      return true;
    case 'test/draw':
    case 'test/reveal':
    case 'test/commit':
      return false;
  }
}

describe('undo', () => {
  it(
    'flags non-undoable actions and keeps every pre-action state intact',
    () => {
      fc.assert(
        fc.property(seedArb, fc.array(testActionArb, { maxLength: 25 }), (seed, actions) => {
          let s: GameState = newP0(seed);
          const history: { prev: GameState; prevHash: string }[] = [];
          for (const a of actions) {
            const prevHash = hashState(s);
            const r = applyAction(s, asAction(a));
            expect(hashState(s)).toBe(prevHash); // applying never mutates its input
            if (!r.ok) continue;
            expect(r.undoable).toBe(expectedUndoable(a));
            if (r.undoable) {
              // Redo from the restored state reproduces the same result.
              const redo = applyAction(s, asAction(a));
              expect(redo.ok && hashState(redo.state)).toBe(hashState(r.state));
            }
            history.push({ prev: s, prevHash });
            s = r.state;
          }
          // Undo all the way back: each restored state still hashes as it did before its action.
          for (const h of history.reverse()) expect(hashState(h.prev)).toBe(h.prevHash);
        }),
        fcParams(77, 60),
      );
    },
    WORLD_TIMEOUT_MS,
  );
});
