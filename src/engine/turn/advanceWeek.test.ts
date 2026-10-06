import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EngineGuardError } from '../core/assert';
import { applyAction } from '../actions/apply';
import { createDecision } from '../actions/decisions';
import { asAction, registerTestActions } from '../actions/testActions';
import type { DecId } from '../core/ids';
import { hashState } from '../state/hash';
import { produceState } from '../state/immutability';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { collateAlerts } from '../systems/inbox/collate';
import { advanceWeek } from './advanceWeek';
import { canAdvance } from './guard';
import { PIPELINE } from './pipeline';
import { deriveWeekCalendar } from './steps/step01Calendar';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// newGame is deterministic and states are immutable, so one start state serves every test (world generation is slow).
const BASE = newGame(defaultNewGameSetup({ companyName: 'Advance Test' }), 'adv');
const fresh = (): GameState => BASE;

function weeks(s: GameState, n: number): GameState {
  let out = s;
  for (let i = 0; i < n; i++) out = advanceWeek(out).state;
  return out;
}

describe('the weekly pipeline (DESIGN §2.6)', () => {
  it('runs steps 0–16 in the canonical order with their acting sections', () => {
    expect(PIPELINE.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(PIPELINE.map((p) => p.name)).toEqual([
      'Guard',
      'Calendar & season',
      'Macro & gold price',
      'Markets refresh',
      'Events',
      'Competitors',
      'Negotiations & pending deals',
      'Staff availability',
      'Fleet availability',
      'Operations',
      'Wear, failures, injuries',
      'Shop',
      'Cleanup',
      'Permits & compliance',
      'Finance',
      'Distress',
      'Wrap-up',
    ]);
    expect(PIPELINE[3]?.sections).toEqual([3, 5, 4, 8, 9]); // D-2.11
  });

  it('increments the turn first: the first advance simulates turn 1 = year 1 week 2 (D-2.13)', () => {
    const { state, report } = advanceWeek(fresh());
    expect(state.clock).toMatchObject({ turn: 1, year: 1, week: 2 });
    expect(report.turn).toBe(1);
    expect(report).toEqual({ turn: 1, alerts: [], stopCandidates: [], ops: {} });
  });

  it('rolls the year after week 52 and writes the year rollup in week 52', () => {
    const s = weeks(fresh(), 51);
    expect(s.clock).toMatchObject({ turn: 51, year: 1, week: 52 });
    expect(s.history.annual).toHaveLength(1);
    expect(s.history.annual[0]).toMatchObject({ year: 1, cashEndCents: 40_000_000, ownerNwEndCents: 52_000_000 });
    const next = advanceWeek(s).state;
    expect(next.clock).toMatchObject({ turn: 52, year: 2, week: 1 });
    expect(next.history.annual).toHaveLength(1);
  });

  it('keeps the history ring at 157 entries, ascending, ending at the current turn', () => {
    const s = weeks(fresh(), 10);
    expect(s.history.weekly).toHaveLength(157);
    expect(s.history.weekly[0]?.turn).toBe(-146);
    expect(s.history.weekly[156]).toMatchObject({ turn: 10, company: { cashCents: 40_000_000 } });
  });

  it('derives the week calendar in step 1 (§1 1.3)', () => {
    const at = (turn: number): ReturnType<typeof deriveWeekCalendar> => {
      const s = fresh();
      return deriveWeekCalendar({
        ...s,
        clock: { ...s.clock, turn, year: Math.floor(turn / 52) + 1, week: (turn % 52) + 1 },
      });
    };
    expect(at(60)).toMatchObject({
      year: 2,
      week: 9,
      displayYear: 2028,
      reportingMonth: 2,
      isMonthEnd: true,
      quarter: 1,
    });
    expect(at(51)).toMatchObject({ week: 52, isYearEnd: true, isQuarterEnd: true, isMonthEnd: true });
    expect(at(52)).toMatchObject({ week: 1, isYearStart: true, isMonthEnd: false });
  });

  it('adds explanation trees only with explain, and never changes the state (T18)', () => {
    const s = fresh();
    const off = advanceWeek(s, { explain: false });
    const on = advanceWeek(s, { explain: true });
    expect(hashState(on.state)).toBe(hashState(off.state));
    expect(off.report.calc).toBeUndefined();
    expect(on.report.calc?.['finance.cashOnHand']).toMatchObject({ label: 'Cash on hand', value: 400_000 });
    expect(on.report.hints).toEqual({});
  });

  it('is pure: the input state is unchanged and the same input gives the same output', () => {
    const s = fresh();
    const h = hashState(s);
    const a = advanceWeek(s);
    const b = advanceWeek(s);
    expect(hashState(s)).toBe(h);
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.report).toEqual(b.report);
  });

  it('ends the run in 16d on §11’s liquidation flag and then refuses to advance (GAME_OVER)', () => {
    const r = applyAction(fresh(), asAction({ type: 'test/liquidate' }));
    if (!r.ok) throw new Error(r.error.code);
    expect(canAdvance(r.state)).toBeNull();
    const { state } = advanceWeek(r.state);
    expect(state.company).toMatchObject({ runStatus: 'lost', endReason: 'liquidated', liquidationPath: 'p1Counter' });
    expect(state.history.weekly[156]?.turn).toBe(1); // the snapshot follows 16d, so the final week is recorded
    expect(canAdvance(state)).toBe('GAME_OVER');
    let thrown: unknown;
    try {
      advanceWeek(state);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(EngineGuardError);
    expect((thrown as EngineGuardError).code).toBe('GAME_OVER');
  });

  // A decision created inside the pipeline: an open non-blocking decision whose default option runs `test/decide`
  // is defaulted by the step-16 section wrap-up (§2.2), which creates the follow-up decision at the simulated turn,
  // before §13's collation reads the inbox.
  function withFollowUpDefault(followUpBlocking: boolean): GameState {
    return produceState(fresh(), (draft) => {
      createDecision(draft, {
        kind: 'test.followUp',
        ownerSection: 2,
        blocking: false,
        deadlineTurn: 1,
        defaultOptionId: 'next',
        options: [
          {
            id: 'next',
            labelKey: 'test.next',
            action: asAction({ type: 'test/decide', blocking: followUpBlocking, deadlineInWeeks: 3, cents: 100 }),
            consequenceKey: 'test.next',
          },
        ],
        context: { templateKey: 'test.followUp', params: {}, subject: [] },
      });
    });
  }

  it('collects blocking decisions created this turn as stop candidates (§13 13.10 collation, P0 stub)', () => {
    const { state, report } = advanceWeek(withFollowUpDefault(true));
    expect(state.inbox.closedDecisions['dec_000001' as DecId]).toMatchObject({ outcome: 'defaulted', closedTurn: 1 });
    expect(state.inbox.decisions['dec_000002' as DecId]).toMatchObject({ blocking: true, createdTurn: 1 });
    expect(report.stopCandidates).toEqual([{ ref: 'dec_000002', kind: 'decision', severity: 'blocking' }]);
    expect(canAdvance(state)).toBe('BLOCKING_DECISION_OPEN');
  });

  it('does not collect a non-blocking decision created the same turn', () => {
    const { state, report } = advanceWeek(withFollowUpDefault(false));
    expect(state.inbox.decisions['dec_000002' as DecId]).toMatchObject({ blocking: false, createdTurn: 1 });
    expect(report.stopCandidates).toEqual([]);
  });

  it('collation keeps only blocking decisions created at the current turn', () => {
    // At the player's hand (turn 0): a blocking decision of an earlier turn is not this week's candidate.
    let s = fresh();
    for (const blocking of [true, false]) {
      const r = applyAction(s, asAction({ type: 'test/decide', blocking, deadlineInWeeks: 5, cents: 100 }));
      if (!r.ok) throw new Error(r.error.code);
      s = r.state;
    }
    expect(collateAlerts(s)).toEqual([{ ref: 'dec_000001', kind: 'decision', severity: 'blocking' }]);
    const later = produceState(s, (draft) => {
      draft.clock.turn = 1;
    });
    expect(collateAlerts(later)).toEqual([]);
  });
});
