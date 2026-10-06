import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClaimId, DecId, DistrictId, LineId, MsgId } from '../core/ids';
import type { Cents } from '../core/money';
import { applyAction } from '../actions/apply';
import { asAction, registerTestActions } from '../actions/testActions';
import { produceState } from '../state/immutability';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { collateAlerts } from '../systems/inbox/collate';
import type { AlertSignal } from '../systems/inbox/types';
import { advanceWeek } from './advanceWeek';
import { runToNextDecision } from './runToNextDecision';
import { defaultRunAnchor, defaultStopRules, evaluateStops, upcomingDeadlines, type StopRule } from './stops';
import type { WeekReport, WeekResult } from './types';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// newGame is deterministic and states are immutable, so one start state serves every test (world generation is slow).
const BASE = newGame(defaultNewGameSetup({ companyName: 'Stops Test' }), 'stops');
const fresh = (): GameState => BASE;

function act(s: GameState, a: Parameters<typeof asAction>[0]): GameState {
  const r = applyAction(s, asAction(a));
  if (!r.ok) throw new Error(r.error.code);
  return r.state;
}

/** A week whose state and report the test controls. */
/** §13 collation's week-mode stop candidates for a state (the P0 form reads the inbox only). */
function weekCandidates(state: GameState): ReturnType<typeof collateAlerts> {
  let out: ReturnType<typeof collateAlerts> = [];
  produceState(state, (draft) => {
    out = collateAlerts(draft, [], draft.clock.turn, 'week');
  });
  return out;
}

function week(
  prev: GameState,
  edit: { state?: (s: GameState) => GameState; report?: Partial<WeekReport> } = {},
): WeekResult {
  const w = advanceWeek(prev);
  return { state: edit.state ? edit.state(w.state) : w.state, report: { ...w.report, ...edit.report } };
}

const anchorOf = (s: GameState): ReturnType<typeof defaultRunAnchor> => defaultRunAnchor(s);
const signal = (kind: AlertSignal['kind'], severity: AlertSignal['severity']): AlertSignal => ({
  kind,
  severity,
  trigger: 'edge',
  dedupeKey: `${kind}:x`,
  subject: [],
  templateKey: kind,
  params: {},
});

describe('evaluateStops (DESIGN §13 13.9, §2.7; T5)', () => {
  it('stops on nothing in a quiet P0 week under the default rules', () => {
    const s = fresh();
    expect(evaluateStops(s, week(s), defaultStopRules(), anchorOf(s))).toEqual([]);
  });

  it('a blocking decision created this turn always stops, even with every rule off', () => {
    const s = fresh();
    const w = week(s, {
      state: (x) =>
        produceState(x, (d) => {
          d.inbox.decisions['dec_000009' as DecId] = {
            id: 'dec_000009' as DecId,
            kind: 'finance.involuntaryPetition',
            ownerSection: 11,
            blocking: true,
            createdTurn: x.clock.turn,
            deadlineTurn: x.clock.turn + 2,
            options: [],
            context: { templateKey: 't', params: {}, subject: [] },
          };
          d.inbox.decisionIds.push('dec_000009' as DecId);
        }),
    });
    const reasons = evaluateStops(s, w, [], anchorOf(s));
    expect(reasons).toEqual([
      {
        kind: 'blockingDecision',
        ref: 'dec_000009',
        label: 'Decision needed: finance.involuntaryPetition',
        severity: 'blocking',
      },
    ]);
    // §13 collation lists it as a stop candidate too; the dedupe keeps one reason.
    const withCandidates = { ...w, report: { ...w.report, stopCandidates: weekCandidates(w.state) } };
    expect(withCandidates.report.stopCandidates).toEqual([
      { ref: 'dec_000009', kind: 'decision', severity: 'blocking' },
    ]);
    expect(evaluateStops(s, withCandidates, [], anchorOf(s))).toHaveLength(1);
  });

  it('alerts: critical always stops; a warning stops unless its kind is muted (D-2.23)', () => {
    const s = fresh();
    const w = week(s, {
      report: {
        stopCandidates: [
          { ref: 'msg_000002' as MsgId, kind: 'employee.quit', severity: 'warning' },
          { ref: 'msg_000001' as MsgId, kind: 'payroll.missed', severity: 'critical' },
          { ref: 'msg_000003' as MsgId, kind: 'listing.new', severity: 'info' },
        ],
      },
    });
    expect(evaluateStops(s, w, [], anchorOf(s)).map((r) => [r.kind, r.ref, r.severity])).toEqual([
      ['alert', 'msg_000001', 'critical'],
      ['alert', 'msg_000002', 'warning'],
    ]);
    const muted: StopRule[] = [{ kind: 'warningKinds', muted: ['employee.quit', 'payroll.missed'] }];
    expect(evaluateStops(s, w, muted, anchorOf(s)).map((r) => r.ref)).toEqual(['msg_000001']);
  });

  it('monthStart fires in exactly weeks 1, 6, 10, 14, 19, 23, 27, 32, 36, 40, 45, 49', () => {
    const rules: StopRule[] = [{ kind: 'monthStart', enabled: true }];
    const fired: number[] = [];
    let s = fresh();
    for (let i = 0; i < 52; i++) {
      const w = advanceWeek(s);
      if (evaluateStops(s, w, rules, anchorOf(s)).length > 0) fired.push(w.state.clock.week);
      s = w.state;
    }
    expect(fired).toEqual([6, 10, 14, 19, 23, 27, 32, 36, 40, 45, 49, 1]);
  });

  it('atTurn fires on its turn only; disabled rules never fire', () => {
    const s = fresh();
    const w = week(s);
    expect(evaluateStops(s, w, [{ kind: 'atTurn', turn: 1 }], anchorOf(s))).toEqual([
      { kind: 'rule', rule: 'atTurn', label: 'Reached turn 1' },
    ]);
    expect(evaluateStops(s, w, [{ kind: 'atTurn', turn: 2 }], anchorOf(s))).toEqual([]);
    expect(evaluateStops(s, w, [{ kind: 'monthStart', enabled: false }], anchorOf(s))).toEqual([]);
  });

  it('cashBelow fires on the downward crossing only', () => {
    const s = fresh();
    const rule: StopRule[] = [{ kind: 'cashBelow', cents: 39_000_000 as Cents, enabled: true }];
    const after = act(s, { type: 'test/transfer', cents: 2_000_000 }); // cash on hand is unchanged by a reserve transfer
    expect(evaluateStops(s, week(after), rule, anchorOf(s))).toEqual([]);
    const dropped = (x: GameState): GameState =>
      produceState(x, (d) => {
        d.finance.books.company.balances['cash.operating'] = 38_000_000 as Cents;
      });
    expect(evaluateStops(s, week(s, { state: dropped }), rule, anchorOf(s))).toEqual([
      { kind: 'rule', rule: 'cashBelow', label: 'Cash fell below the threshold' },
    ]);
    const low = dropped(s);
    expect(evaluateStops(low, week(low), rule, anchorOf(low))).toEqual([]); // already below: no new crossing
  });

  it('goldMove compares with the run anchor, not last week', () => {
    const s = fresh();
    const rules: StopRule[] = [{ kind: 'goldMove', pct: 0.05, enabled: true }];
    expect(evaluateStops(s, week(s), rules, { ...anchorOf(s), startSpotUsdPerFineOz: 4000 })).toEqual([
      { kind: 'rule', rule: 'goldMove', label: 'Gold moved from the run start' },
    ]);
    expect(evaluateStops(s, week(s), rules, { ...anchorOf(s), startSpotUsdPerFineOz: 4100 })).toEqual([]);
  });

  it('everyCleanup names each claim once with its lines; machineFailure reads this week’s signals', () => {
    const s = fresh();
    const result = (claimId: string) => ({ claimId: claimId as ClaimId, turn: 1, payWashedBcy: 0 });
    const cleanup = (lineId: LineId) => ({ turn: 1, lineId, rawOzWeighed: 1 });
    const ops = {
      ['clm_000002' as ClaimId]: { result: result('clm_000002'), cleanups: [cleanup('L1'), cleanup('L2')] },
      ['clm_000001' as ClaimId]: { result: result('clm_000001'), cleanups: [] },
    };
    const w = week(s, { report: { ops, alerts: [signal('machine.failure', 'warning')] } });
    expect(evaluateStops(s, w, [{ kind: 'everyCleanup', claimIds: 'all', enabled: true }], anchorOf(s))).toEqual([
      {
        kind: 'rule',
        rule: 'everyCleanup',
        ref: { kind: 'claim', id: 'clm_000002' },
        label: 'Cleanup on clm_000002 (L1, L2)',
      },
    ]);
    expect(
      evaluateStops(s, w, [{ kind: 'everyCleanup', claimIds: ['clm_000001' as ClaimId], enabled: true }], anchorOf(s)),
    ).toEqual([]);
    expect(evaluateStops(s, w, [{ kind: 'machineFailure', enabled: true }], anchorOf(s))).toHaveLength(1);
  });

  it('deadlineWithin fires once per item, when it enters the window (or is created inside it)', () => {
    let s = act(fresh(), { type: 'test/decide', blocking: false, deadlineInWeeks: 5, cents: 100 }); // due turn 5
    expect(upcomingDeadlines(s)).toEqual([
      { ref: 'dec_000001', dueTurn: 5, createdTurn: 0, label: 'Decision due: test.optional' },
    ]);
    const rules: StopRule[] = [{ kind: 'deadlineWithin', weeks: 2, enabled: true }];
    const firedAt: number[] = [];
    for (let i = 0; i < 5; i++) {
      const w = advanceWeek(s);
      if (evaluateStops(s, w, rules, anchorOf(s)).length > 0) firedAt.push(w.state.clock.turn);
      s = w.state;
    }
    expect(firedAt).toEqual([3]);
  });

  it('seasonPhase fires for a phase change in a district in scope', () => {
    const s = fresh();
    const D = 'dst_000001' as DistrictId;
    const prev = produceState(s, (d) => {
      d.clock.phase[D] = 'winter';
    });
    const w = week(prev, {
      state: (x) =>
        produceState(x, (d) => {
          d.clock.phase[D] = 'breakup';
        }),
    });
    expect(evaluateStops(prev, w, [{ kind: 'seasonPhase', scope: 'all', enabled: true }], anchorOf(prev))).toEqual([
      {
        kind: 'seasonPhase',
        rule: 'seasonPhase',
        ref: { kind: 'district', id: D },
        label: `Season phase: breakup in ${D}`,
      },
    ]);
    // P0 holds no ground, so the default 'held' scope does not fire.
    expect(evaluateStops(prev, w, [{ kind: 'seasonPhase', scope: 'held', enabled: true }], anchorOf(prev))).toEqual([]);
  });

  it('orders reasons: blocking decision, game over, critical, warning, season phase, rule', () => {
    const s = act(fresh(), { type: 'test/liquidate' });
    const w = week(s, {
      report: {
        stopCandidates: [
          { ref: 'msg_000005' as MsgId, kind: 'employee.quit', severity: 'warning' },
          { ref: 'msg_000004' as MsgId, kind: 'payroll.missed', severity: 'critical' },
        ],
      },
    });
    const kinds = evaluateStops(s, w, [{ kind: 'atTurn', turn: 1 }], anchorOf(s)).map((r) => [r.kind, r.severity]);
    expect(kinds).toEqual([
      ['gameOver', undefined],
      ['alert', 'critical'],
      ['alert', 'warning'],
      ['rule', undefined],
    ]);
  });
});

describe('runToNextDecision (DESIGN §2.7)', () => {
  it('stops at exactly maxWeeks with a maxWeeks reason and returns every report', () => {
    const r = runToNextDecision(fresh(), { maxWeeks: 13, stopRules: defaultStopRules() });
    expect(r.state.clock.turn).toBe(13);
    expect(r.reports.map((x) => x.turn)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(r.stoppedBecause).toEqual([{ kind: 'maxWeeks', label: 'Ran 13 weeks' }]);
  });

  it('stops on the first rule that fires, and on game over', () => {
    const r = runToNextDecision(fresh(), { maxWeeks: 26, stopRules: [{ kind: 'monthStart', enabled: true }] });
    expect(r.state.clock.week).toBe(6);
    const over = runToNextDecision(act(fresh(), { type: 'test/liquidate' }), { maxWeeks: 26, stopRules: [] });
    expect(over.state.clock.turn).toBe(1);
    expect(over.stoppedBecause).toEqual([{ kind: 'gameOver', label: 'Run ended: liquidated (p1Counter)' }]);
  });

  it('equals the same number of advanceWeek calls, explain on or off', () => {
    const s = fresh();
    const a = runToNextDecision(s, { maxWeeks: 8, stopRules: [], explain: true });
    const b = runToNextDecision(s, { maxWeeks: 8, stopRules: [] });
    let manual = s;
    for (let i = 0; i < 8; i++) manual = advanceWeek(manual).state;
    expect(a.state).toEqual(manual);
    expect(b.state).toEqual(manual);
  });

  it('refuses to start when the state cannot advance, and checks maxWeeks', () => {
    const blocked = act(fresh(), { type: 'test/decide', blocking: true, deadlineInWeeks: 1, cents: 100 });
    expect(() => runToNextDecision(blocked, { maxWeeks: 4, stopRules: [] })).toThrow(/blocking decision/);
    expect(() => runToNextDecision(fresh(), { maxWeeks: 0, stopRules: [] })).toThrow(RangeError);
  });

  it('defaultStopRules matches §13 13.9 (UI defaults from ui.*)', () => {
    expect(defaultStopRules()).toEqual([
      { kind: 'warningKinds', muted: [] },
      { kind: 'seasonPhase', scope: 'held', enabled: true },
      { kind: 'deadlineWithin', weeks: 2, enabled: true },
      { kind: 'everyCleanup', claimIds: 'all', enabled: false },
      { kind: 'cashBelow', cents: 0, enabled: false },
      { kind: 'machineFailure', enabled: false },
      { kind: 'listingMatch', searches: [], enabled: false },
      { kind: 'monthStart', enabled: false },
      { kind: 'goldMove', pct: 0.05, enabled: false },
    ]);
  });
});
