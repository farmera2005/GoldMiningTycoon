// TEST-ONLY action rows (imported by *.test.ts and tests/ only, never by the engine or the UI). P0 has no gameplay
// action besides decision/answer, so the framework's tests register these to exercise applyAction, undoable detection
// (D-2.22), decisions, defaults and run ends. registerTestActions() returns the function that removes them.
import { usdToCents, type Cents } from '../core/money';
import { postInto } from '../systems/finance/ledger';
import type { GameState } from '../state/types';
import { createDecision } from './decisions';
import { registerAction } from './registry';
import type { Action, ActionDef, ActionError, HandlerContext } from './types';

/** Moves cash between the operating and reserve accounts (pure: no draw, reveal or commitment). */
export interface TestTransferAction {
  type: 'test/transfer';
  /** Positive: operating → reserve; negative: reserve → operating. */
  cents: number;
}
/** Draws `n` numbers from the restricted flavor stream (§2.3 rule d) and changes nothing else. */
export interface TestDrawAction {
  type: 'test/draw';
  n: number;
}
export interface TestRevealAction {
  type: 'test/reveal';
}
export interface TestCommitAction {
  type: 'test/commit';
}
/** Creates a decision whose options transfer cash or reveal; non-blocking ones default to option 'a'. */
export interface TestDecideAction {
  type: 'test/decide';
  blocking: boolean;
  deadlineInWeeks: number;
  /** Option 'a' transfers this many cents to reserve. */
  cents: number;
}
/** Raises §11's liquidation flag, which step 16d turns into a run end. */
export interface TestLiquidateAction {
  type: 'test/liquidate';
}

export type TestAction =
  TestTransferAction | TestDrawAction | TestRevealAction | TestCommitAction | TestDecideAction | TestLiquidateAction;

/** Casts a test action to the engine's Action type (test actions are outside the public union). */
export function asAction(a: TestAction): Action {
  return a as unknown as Action;
}

const malformed = (message: string): ActionError => ({ code: 'ACTION_MALFORMED', message });

const transferDef: ActionDef<TestTransferAction> = {
  type: 'test/transfer',
  ownerSection: 2,
  reveals: false,
  commits: false,
  validate(state: GameState, a) {
    if (!Number.isSafeInteger(a.cents) || a.cents === 0) return malformed('cents must be a non-zero integer');
    const from = a.cents > 0 ? 'cash.operating' : 'cash.reserve';
    if ((state.finance.books.company.balances[from] ?? 0) < Math.abs(a.cents)) {
      return { code: 'INSUFFICIENT_FUNDS', message: `${from} cannot cover ${Math.abs(a.cents)} cents` };
    }
    return null;
  },
  handle(draft, a, ctx) {
    const amount = Math.abs(a.cents) as Cents;
    const [to, from] = a.cents > 0 ? ['cash.reserve', 'cash.operating'] : ['cash.operating', 'cash.reserve'];
    const txnId = postInto(draft, {
      date: draft.clock.turn,
      lines: [
        { account: to, debit: amount },
        { account: from, credit: amount },
      ],
      memo: 'Test transfer',
      refs: [],
      source: '§2/test',
    });
    ctx.effect({ kind: 'ledger', txnId });
  },
};

const drawDef: ActionDef<TestDrawAction> = {
  type: 'test/draw',
  ownerSection: 2,
  reveals: false,
  commits: false,
  validate: (_state, a) => (Number.isSafeInteger(a.n) && a.n >= 0 ? null : malformed('n must be ≥ 0')),
  handle(draft, a, ctx: HandlerContext) {
    const r = ctx.rng(draft.meta.seed, 'action', draft.clock.turn, draft.clock.actionSeq);
    for (let i = 0; i < a.n; i++) r.next();
  },
};

const revealDef: ActionDef<TestRevealAction> = {
  type: 'test/reveal',
  ownerSection: 2,
  reveals: true,
  commits: false,
  validate: () => null,
  handle: () => undefined,
};

const commitDef: ActionDef<TestCommitAction> = {
  type: 'test/commit',
  ownerSection: 2,
  reveals: false,
  commits: true,
  validate: () => null,
  handle: () => undefined,
};

const decideDef: ActionDef<TestDecideAction> = {
  type: 'test/decide',
  ownerSection: 2,
  reveals: false,
  commits: false,
  validate(_state, a) {
    if (typeof a.blocking !== 'boolean') return malformed('blocking must be a boolean');
    if (!Number.isSafeInteger(a.deadlineInWeeks) || a.deadlineInWeeks < 0) return malformed('deadlineInWeeks ≥ 0');
    if (!Number.isSafeInteger(a.cents) || a.cents <= 0) return malformed('cents must be positive');
    return null;
  },
  handle(draft, a, ctx) {
    const decId = createDecision(draft, {
      kind: a.blocking ? 'test.blocking' : 'test.optional',
      ownerSection: 2,
      blocking: a.blocking,
      deadlineTurn: draft.clock.turn + a.deadlineInWeeks,
      options: [
        {
          id: 'a',
          labelKey: 'test.a',
          action: asAction({ type: 'test/transfer', cents: a.cents }),
          consequenceKey: 'test.a',
        },
        { id: 'b', labelKey: 'test.b', action: asAction({ type: 'test/reveal' }), consequenceKey: 'test.b' },
      ],
      ...(a.blocking ? {} : { defaultOptionId: 'a' }),
      context: { templateKey: 'test.decide', params: { cents: a.cents }, subject: [] },
    });
    ctx.effect({ kind: 'decision', decId });
  },
};

const liquidateDef: ActionDef<TestLiquidateAction> = {
  type: 'test/liquidate',
  ownerSection: 2,
  reveals: false,
  commits: false,
  validate: () => null,
  handle(draft) {
    draft.finance.distress.liquidation = { cause: 'p1Counter', turn: draft.clock.turn };
  },
};

/** Registers the test rows; returns the function that unregisters them. */
export function registerTestActions(): () => void {
  const undo = [
    registerAction(transferDef),
    registerAction(drawDef),
    registerAction(revealDef),
    registerAction(commitDef),
    registerAction(decideDef),
    registerAction(liquidateDef),
  ];
  return () => {
    for (const u of undo) u();
  };
}

/** One dollar in cents, for readable test amounts. */
export const USD = (usd: number): number => usdToCents(usd);
