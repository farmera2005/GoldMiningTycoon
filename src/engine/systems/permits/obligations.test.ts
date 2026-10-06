// The §6 obligation store (DESIGN §6.9; D-6.41; s05 #1, #2; P1 contract §4.6): create (status by window, sorted ids),
// idempotent satisfy, cancel, the range query in due-turn order and the statutory/billable rule.
import { describe, expect, it } from 'vitest';
import type { ObligationId } from '../../core/ids';
import type { Cents } from '../../core/money';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import type { GameState } from '../../state/types';
import {
  cancelObligation,
  createObligation,
  ObligationError,
  obligationsInRange,
  satisfyObligation,
  settlementClass,
} from './obligations';
import type { ObligationSpec } from './types';

const BASE = newGame(defaultNewGameSetup({ companyName: 'Obligations Test' }), 'obligations');

function spec(over: Partial<ObligationSpec> = {}): ObligationSpec {
  return {
    kind: 'leaseAdvanceRoyalty',
    category: 'lease',
    owner: '§5',
    payer: 'player',
    title: 'Advance royalty',
    subject: {},
    createdTurn: 0,
    windowOpenTurn: 0,
    dueTurn: 10,
    amount: 500_000 as Cents,
    prepLeadWeeks: 0,
    payableNow: true,
    autoPayEligible: true,
    autoPay: false,
    consequence: { kind: 'default', text: 'Lease default notice', severity: 'critical' },
    graceWeeks: 2,
    ...over,
  };
}

function withObligations(specs: ObligationSpec[]): { state: GameState; ids: ObligationId[] } {
  const ids: ObligationId[] = [];
  const state = produceState(BASE, (d) => {
    for (const s of specs) ids.push(createObligation(d, s));
  });
  return { state, ids };
}

describe('the obligation store (§6.9)', () => {
  it('mints sorted ids and opens the status by window: due once open, else upcoming', () => {
    const { state, ids } = withObligations([spec({ windowOpenTurn: 0 }), spec({ windowOpenTurn: 5, dueTurn: 8 })]);
    expect(ids).toEqual(['obl_000001', 'obl_000002']);
    expect(state.permits.obligationIds).toEqual(ids);
    expect(ids.map((id) => state.permits.obligations[id]?.status)).toEqual(['due', 'upcoming']);
  });

  it('satisfies once (idempotent), recording the turn and the route', () => {
    const { state, ids } = withObligations([spec()]);
    const id = ids[0]!;
    const once = produceState(state, (d) => satisfyObligation(d, id, 'payment'));
    expect(once.permits.obligations[id]).toMatchObject({
      status: 'satisfied',
      satisfiedTurn: 0,
      satisfiedVia: 'payment',
    });
    const twice = produceState(once, (d) => satisfyObligation(d, id, 'autoPay'));
    expect(twice).toBe(once);
    expect(() => produceState(state, (d) => satisfyObligation(d, 'obl_999999' as ObligationId, 'payment'))).toThrow(
      ObligationError,
    );
  });

  it('cancels an open obligation, twice is a no-op, and a satisfied one cannot be cancelled', () => {
    const { state, ids } = withObligations([spec(), spec()]);
    const [a, b] = [ids[0]!, ids[1]!];
    const cancelled = produceState(state, (d) => cancelObligation(d, a));
    expect(cancelled.permits.obligations[a]?.status).toBe('cancelled');
    expect(produceState(cancelled, (d) => cancelObligation(d, a))).toBe(cancelled);
    const paid = produceState(state, (d) => satisfyObligation(d, b, 'payment'));
    expect(() => produceState(paid, (d) => cancelObligation(d, b))).toThrow(ObligationError);
  });

  it('lists a range by due turn, then id, with filters', () => {
    const { state, ids } = withObligations([
      spec({ dueTurn: 12 }),
      spec({ dueTurn: 4, kind: 'loanPayment', owner: '§11', category: 'finance' }),
      spec({ dueTurn: 12 }),
      spec({ dueTurn: 30 }),
    ]);
    expect(obligationsInRange(state, 0, 20).map((o) => o.id)).toEqual([ids[1], ids[0], ids[2]]);
    expect(obligationsInRange(state, 0, 52, { owner: '§11' }).map((o) => o.id)).toEqual([ids[1]]);
    expect(obligationsInRange(state, 13, 29)).toEqual([]);
  });

  it('classes §1, §5 and §11 money and late-fee, escalate and default consequences billable, the rest statutory', () => {
    const c = (owner: ObligationSpec['owner'], kind: ObligationSpec['consequence']['kind']) =>
      settlementClass({ owner, consequence: { kind, text: '', severity: 'info' } });
    expect(c('§5', 'forfeitClaim')).toBe('billable');
    expect(c('§11', 'violation')).toBe('billable');
    expect(c('§1', 'gateCloses')).toBe('billable');
    expect(c('§6', 'lateFee')).toBe('billable');
    expect(c('§6', 'forfeitClaim')).toBe('statutory');
    expect(c('§8', 'violation')).toBe('statutory');
  });
});
