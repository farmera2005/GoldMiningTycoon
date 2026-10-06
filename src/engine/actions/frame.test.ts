// The P1 actions framework (DESIGN §2.2; P1 contract §1.2): non-blocking warnings (s07 #3, S13-3), phase gates,
// Wave-0 stub rows (§0.2), close-only decision options (S08-14), the decision ↔ message link (S12-2) and action-time
// collation of alert effects (S12-3).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DecId, MsgId } from '../core/ids';
import { hashState } from '../state/hash';
import { produceState } from '../state/immutability';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { advanceWeek } from '../turn/advanceWeek';
import { applyAction, validateAction } from './apply';
import { FRAMEWORK_ERROR_CODES, type Action } from './types';
import { getActionDef, registerAction, stubbedActionTypes, validateWithRegistry } from './registry';
import { stubActionDef } from './stub';
import { TEST_WARNING_CODE, asAction, registerTestActions } from './testActions';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// A P0-rules game (the phase gate's subject) and the same game under P1 rules.
const BASE = newGame(defaultNewGameSetup({ companyName: 'Frame Actions' }), 'frame-actions', undefined, {
  rulesPhase: 0,
});
const P1 = produceState(BASE, (d) => {
  d.meta.rulesPhase = 1;
});

function applied(s: GameState, a: Action): GameState {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r.state;
}

describe('warnings (s07 #3, S13-3)', () => {
  it('validateAction and applyAction return the same warnings for a valid action', () => {
    const a = asAction({ type: 'test/warn', n: 2 });
    const v = validateAction(BASE, a);
    expect(v).toEqual({
      ok: true,
      warnings: [
        { code: TEST_WARNING_CODE, message: 'test warning 1' },
        { code: TEST_WARNING_CODE, message: 'test warning 2' },
      ],
    });
    const r = applyAction(BASE, a);
    expect(r.ok && r.warnings).toEqual(v.ok && v.warnings);
    expect(validateAction(BASE, asAction({ type: 'test/warn', n: 0 }))).toEqual({ ok: true, warnings: [] });
  });

  it('reports no warnings for a refused action, and never calls warnings() on one', () => {
    expect(validateAction(BASE, asAction({ type: 'test/warn', n: -1 }))).toMatchObject({
      ok: false,
      error: { code: 'ACTION_MALFORMED' },
    });
  });

  it('decision/answer carries its option action’s warnings', () => {
    const s = produceState(BASE, (draft) => {
      draft.inbox.decisions['dec_000077' as DecId] = {
        id: 'dec_000077' as DecId,
        kind: 'test.warned',
        ownerSection: 2,
        blocking: true,
        createdTurn: 0,
        deadlineTurn: 3,
        options: [{ id: 'go', labelKey: 'x', action: asAction({ type: 'test/warn', n: 1 }), consequenceKey: 'x' }],
        context: { templateKey: 'x', params: {}, subject: [] },
      };
      draft.inbox.decisionIds.push('dec_000077' as DecId);
    });
    const v = validateAction(s, { type: 'decision/answer', decisionId: 'dec_000077' as DecId, optionId: 'go' });
    expect(v).toEqual({ ok: true, warnings: [{ code: TEST_WARNING_CODE, message: 'test warning 1' }] });
  });
});

describe('rules phase and stub rows (P1 contract §0.2, §1.2)', () => {
  it('lists the framework codes, NOT_IMPLEMENTED and ACTION_NOT_IN_PHASE included', () => {
    expect(FRAMEWORK_ERROR_CODES).toEqual(expect.arrayContaining(['NOT_IMPLEMENTED', 'ACTION_NOT_IN_PHASE']));
  });

  it('refuses a later-phase action as ACTION_NOT_IN_PHASE before its own validator, in options too', () => {
    expect(validateAction(BASE, asAction({ type: 'test/later' }))).toMatchObject({
      ok: false,
      error: { code: 'ACTION_NOT_IN_PHASE', message: 'test/later is available from P1' },
    });
    expect(validateWithRegistry(P1, asAction({ type: 'test/later' }))).toBeNull();
  });

  it('a stub row validates to NOT_IMPLEMENTED, changes nothing and is listed until replaced', () => {
    const def = stubActionDef('test/stubbed', 9, { reveals: false, commits: true });
    expect(def).toMatchObject({ type: 'test/stubbed', ownerSection: 9, commits: true, fromPhase: 1, stub: true });
    const undo = registerAction(def);
    try {
      expect(stubbedActionTypes()).toContain('test/stubbed');
      expect(getActionDef('test/stubbed')?.stub).toBe(true);
      expect(validateAction(P1, { type: 'test/stubbed' } as unknown as Action)).toMatchObject({
        ok: false,
        error: { code: 'NOT_IMPLEMENTED' },
      });
      // Under P0 rules the phase gate answers first.
      expect(validateAction(BASE, { type: 'test/stubbed' } as unknown as Action)).toMatchObject({
        ok: false,
        error: { code: 'ACTION_NOT_IN_PHASE' },
      });
    } finally {
      undo();
    }
    expect(stubbedActionTypes()).not.toContain('test/stubbed');
    expect(stubbedActionTypes()).not.toContain('decision/answer');
  });
});

describe('close-only decision options (S08-14)', () => {
  it('an answer to an option without an action closes the decision and changes nothing else', () => {
    const s = applied(BASE, asAction({ type: 'test/closeOnly' }));
    const decId = s.inbox.decisionIds[0] as DecId;
    const answer: Action = { type: 'decision/answer', decisionId: decId, optionId: 'drop' };
    expect(validateAction(s, answer)).toEqual({ ok: true, warnings: [] });
    const r = applyAction(s, answer);
    if (!r.ok) throw new Error(r.error.code);
    expect(r.undoable).toBe(true);
    expect(r.state.inbox.decisions).toEqual({});
    expect(r.state.inbox.closedDecisions[decId]).toMatchObject({ outcome: 'answered', optionId: 'drop' });
    expect(r.state.finance).toBe(s.finance);
    // Params have nothing to merge into.
    expect(validateAction(s, { ...answer, params: { x: 1 } } as Action)).toMatchObject({
      ok: false,
      error: { code: 'ACTION_MALFORMED' },
    });
  });

  it('defaults a close-only option at its deadline', () => {
    const s = applied(BASE, asAction({ type: 'test/closeOnly' }));
    const decId = s.inbox.decisionIds[0] as DecId;
    const after = advanceWeek(s).state;
    expect(after.inbox.closedDecisions[decId]).toMatchObject({ outcome: 'defaulted', optionId: 'keep' });
    expect(after.inbox.closedDecisions[decId]?.errorCode).toBeUndefined();
  });
});

describe('the decision ↔ message link (S12-2)', () => {
  it('turns the decision’s open message to answered when the player answers it', () => {
    const s0 = applied(BASE, asAction({ type: 'test/closeOnly' }));
    const decId = s0.inbox.decisionIds[0] as DecId;
    const msgId = 'msg_000001' as MsgId;
    const s = produceState(s0, (draft) => {
      draft.inbox.messages[msgId] = {
        id: msgId,
        kind: 'staff.layoffDecision',
        severity: 'warning',
        status: 'open',
        trigger: 'edge',
        createdTurn: 0,
        lastTurn: 0,
        count: 1,
        dedupeKey: 'x',
        subject: [],
        templateKey: 'alert.staff.layoffDecision',
        params: {},
        decisionId: decId,
      };
      draft.inbox.messageIds.push(msgId);
    });
    const after = applied(s, { type: 'decision/answer', decisionId: decId, optionId: 'keep' });
    expect(after.inbox.messages[msgId]?.status).toBe('answered');
  });
});

describe('action-time collation (S12-3)', () => {
  it('reports the alert effect and collates it at once (P0 collation adds no message)', () => {
    const r = applyAction(BASE, asAction({ type: 'test/alert' }));
    if (!r.ok) throw new Error(r.error.code);
    expect(r.effects).toEqual([
      {
        kind: 'alert',
        signal: expect.objectContaining({ kind: 'cash.projectedNegative', severity: 'warning' }),
      },
    ]);
    expect(r.state.inbox).toEqual(BASE.inbox);
    expect(hashState(r.state)).not.toBe(hashState(BASE)); // actionSeq advanced
  });
});
