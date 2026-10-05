import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DecId } from '../core/ids';
import { EngineGuardError } from '../core/assert';
import { newGame } from '../state/newGame';
import { produceState } from '../state/immutability';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { advanceWeek } from '../turn/advanceWeek';
import { canAdvance } from '../turn/guard';
import { applyAction, validateAction } from './apply';
import { DecisionError, createDecision, openDecisions } from './decisions';
import { asAction, registerTestActions } from './testActions';
import type { Action, DecisionAnswerAction } from './types';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// newGame is deterministic and states are immutable, so one start state serves every test (world generation is slow).
const BASE = newGame(defaultNewGameSetup({ companyName: 'Decision Test' }), 'decide');
const fresh = (): GameState => BASE;

function decide(s: GameState, blocking: boolean, deadlineInWeeks = 2, cents = 500_000): GameState {
  const r = applyAction(s, asAction({ type: 'test/decide', blocking, deadlineInWeeks, cents }));
  if (!r.ok) throw new Error(r.error.code);
  return r.state;
}

const answer = (decisionId: string, optionId: string, params?: DecisionAnswerAction['params']): Action => {
  const a: DecisionAnswerAction = { type: 'decision/answer', decisionId: decisionId as DecId, optionId };
  if (params !== undefined) a.params = params;
  return a;
};

describe('PendingDecision records (DESIGN §2.2)', () => {
  it('stores decisions in inbox.decisions with sorted ids and the creation turn', () => {
    const s = decide(decide(fresh(), false), true);
    expect(s.inbox.decisionIds).toEqual(['dec_000001', 'dec_000002']);
    expect(openDecisions(s).map((d) => [d.id, d.blocking, d.createdTurn, d.deadlineTurn])).toEqual([
      ['dec_000001', false, 0, 2],
      ['dec_000002', true, 0, 2],
    ]);
  });

  it('requires a default option on a non-blocking decision, unique option ids and a deadline not in the past', () => {
    const s = fresh();
    const spec = {
      kind: 'x',
      ownerSection: 2,
      blocking: false,
      deadlineTurn: 0,
      options: [{ id: 'a', labelKey: 'a', action: asAction({ type: 'test/reveal' }), consequenceKey: 'a' }],
      context: { templateKey: 't', params: {}, subject: [] },
    };
    expect(() => produceState(s, (d) => void createDecision(d, spec))).toThrow(DecisionError);
    expect(() => produceState(s, (d) => void createDecision(d, { ...spec, defaultOptionId: 'z' }))).toThrow(
      DecisionError,
    );
    expect(() =>
      produceState(s, (d) => void createDecision(d, { ...spec, defaultOptionId: 'a', deadlineTurn: -1 })),
    ).toThrow(DecisionError);
    const twice = { ...spec, defaultOptionId: 'a', options: [...spec.options, ...spec.options] };
    expect(() => produceState(s, (d) => void createDecision(d, twice))).toThrow(DecisionError);
    expect(() => produceState(s, (d) => void createDecision(d, { ...spec, defaultOptionId: 'a' }))).not.toThrow();
  });

  it('a blocking decision stops the next week until answered (canAdvance, EngineGuardError)', () => {
    const s = decide(fresh(), true);
    expect(canAdvance(s)).toBe('BLOCKING_DECISION_OPEN');
    expect(() => advanceWeek(s)).toThrow(EngineGuardError);
    const r = applyAction(s, answer('dec_000001', 'a'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(canAdvance(r.state)).toBeNull();
  });
});

describe('decision/answer (§13 13.21)', () => {
  it("applies the option's stored action through its handler and closes the decision as answered", () => {
    const s = decide(fresh(), true, 2, 750_000);
    const r = applyAction(s, answer('dec_000001', 'a'));
    if (!r.ok) throw new Error(r.error.code);
    expect(r.state.finance.books.company.balances['cash.reserve']).toBe(750_000);
    expect(r.state.inbox.decisions).toEqual({});
    expect(r.state.inbox.decisionIds).toEqual([]);
    expect(r.state.inbox.closedDecisions['dec_000001' as DecId]).toEqual({
      id: 'dec_000001',
      kind: 'test.blocking',
      closedTurn: 0,
      outcome: 'answered',
      optionId: 'a',
    });
    expect(r.effects).toContainEqual({ kind: 'decision', decId: 'dec_000001' });
    expect(r.undoable).toBe(true);
  });

  it("carries the option action's flags: answering with a revealing option is not undoable", () => {
    const s = decide(fresh(), true);
    expect(applyAction(s, answer('dec_000001', 'b'))).toMatchObject({ ok: true, undoable: false });
  });

  it('merges params into the option action but never its type', () => {
    const s = decide(fresh(), true, 2, 100);
    const r = applyAction(s, answer('dec_000001', 'a', { cents: 2_000 }));
    if (!r.ok) throw new Error(r.error.code);
    expect(r.state.finance.books.company.balances['cash.reserve']).toBe(2_000);
    expect(validateAction(s, answer('dec_000001', 'a', { type: 'test/reveal' } as never))).toMatchObject({
      ok: false,
      error: { code: 'ACTION_MALFORMED' },
    });
  });

  it('validates: DECISION_NOT_FOUND, DECISION_CLOSED, OPTION_INVALID, and the option action’s own codes', () => {
    const s = decide(fresh(), true, 2, 40_000_001);
    expect(validateAction(s, answer('dec_000099', 'a'))).toMatchObject({
      ok: false,
      error: { code: 'DECISION_NOT_FOUND' },
    });
    expect(validateAction(s, answer('dec_000001', 'z'))).toMatchObject({
      ok: false,
      error: { code: 'OPTION_INVALID' },
    });
    expect(validateAction(s, answer('dec_000001', 'a'))).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_FUNDS' },
    });
    const answered = applyAction(s, answer('dec_000001', 'b'));
    if (!answered.ok) throw new Error(answered.error.code);
    expect(validateAction(answered.state, answer('dec_000001', 'b'))).toMatchObject({
      ok: false,
      error: { code: 'DECISION_CLOSED' },
    });
    expect(validateAction(s, { type: 'decision/answer', decisionId: 5 } as unknown as Action)).toMatchObject({
      ok: false,
      error: { code: 'ACTION_MALFORMED' },
    });
  });
});

describe('default at deadline (§2.2)', () => {
  it('applies the default option in step 16 of the deadline week and closes it as defaulted', () => {
    let s = decide(fresh(), false, 2, 300_000);
    s = advanceWeek(s).state; // turn 1: not yet due
    expect(s.inbox.decisionIds).toEqual(['dec_000001']);
    s = advanceWeek(s).state; // turn 2: deadline
    expect(s.inbox.decisionIds).toEqual([]);
    expect(s.inbox.closedDecisions['dec_000001' as DecId]).toMatchObject({
      outcome: 'defaulted',
      optionId: 'a',
      closedTurn: 2,
    });
    expect(s.finance.books.company.balances['cash.reserve']).toBe(300_000);
    expect(s.clock.actionSeq).toBe(1); // pipeline defaults are not player actions
  });

  it('closes a default whose action no longer validates, recording the code and changing nothing else', () => {
    let s = decide(fresh(), false, 1, 40_000_001);
    s = advanceWeek(s).state;
    expect(s.inbox.closedDecisions['dec_000001' as DecId]).toMatchObject({
      outcome: 'defaulted',
      errorCode: 'INSUFFICIENT_FUNDS',
    });
    expect(s.finance.books.company.balances['cash.reserve']).toBeUndefined();
  });

  it('prunes closed records after game.alerts.inboxRetentionWeeks (104)', () => {
    let s = decide(fresh(), false, 0, 100);
    s = advanceWeek(s).state; // defaulted in turn 1 (deadline 0 ≤ 1)
    expect(s.inbox.closedDecisionIds).toEqual(['dec_000001']);
    for (let i = 0; i < 104; i++) s = advanceWeek(s).state;
    expect(s.clock.turn).toBe(105);
    expect(s.inbox.closedDecisionIds).toEqual(['dec_000001']);
    s = advanceWeek(s).state;
    expect(s.inbox.closedDecisionIds).toEqual([]);
    expect(s.inbox.closedDecisions).toEqual({});
  });
});
