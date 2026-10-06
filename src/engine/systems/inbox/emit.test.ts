// Emitting and collating alert signals (DESIGN §13 13.10; S12-2, S12-3, S12-11; P1 contract §4.13).
import { describe, expect, it } from 'vitest';
import type { DecId } from '../../core/ids';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import { emptyWeekRecords } from '../../turn/week';
import type { WeekReportBuilder } from '../../turn/types';
import { collateAlerts } from './collate';
import { AlertSignalError, emitAlert } from './emit';
import type { AlertKind, AlertSignal } from './types';

const BASE = newGame(defaultNewGameSetup({ companyName: 'Inbox Test' }), 'inbox');

const report = (): WeekReportBuilder => ({
  turn: 1,
  alerts: [],
  stopCandidates: [],
  ops: {},
  records: emptyWeekRecords(),
  calc: {},
  hints: {},
});

const signal = (over: Partial<AlertSignal> = {}): AlertSignal => ({
  kind: 'staff.recallDecision',
  severity: 'warning',
  trigger: 'edge',
  dedupeKey: 'recall/2028',
  subject: [{ kind: 'company', id: 'company' }],
  templateKey: 'alert.staff.recallDecision',
  params: { year: 2028 },
  decisionId: 'dec_000004' as DecId,
  action: { labelKey: 'action.answer', route: '#/inbox' },
  explain: { kind: 'live', explainer: 'cash', args: [] },
  ...over,
});

describe('emitAlert', () => {
  it('appends a copy of the signal, decision link, action and explain ref included (S12-2, S12-11)', () => {
    const r = report();
    const s = signal();
    emitAlert({ report: r }, s);
    expect(r.alerts).toEqual([s]);
    expect(r.alerts[0]).not.toBe(s);
    s.params['year'] = 1999;
    expect(r.alerts[0]?.params['year']).toBe(2028);
  });

  it('refuses an unknown kind and a blocking severity (blocking messages come only from decisions)', () => {
    expect(() => emitAlert({ report: report() }, signal({ kind: 'mine.exploded' as AlertKind }))).toThrow(
      AlertSignalError,
    );
    expect(() => emitAlert({ report: report() }, signal({ severity: 'blocking' as AlertSignal['severity'] }))).toThrow(
      /cannot be blocking/,
    );
  });

  it('refuses a signal that contradicts its taxonomy row (trigger; severity unless the row is a rule)', () => {
    expect(() => emitAlert({ report: report() }, signal({ trigger: 'level' }))).toThrow(/edge alert/);
    expect(() => emitAlert({ report: report() }, signal({ severity: 'critical' }))).toThrow(/is warning/);
    // employee.quit's severity is the owner's rule (warning; critical for the only foreman).
    const r = report();
    emitAlert({ report: r }, signal({ kind: 'employee.quit', severity: 'critical' }));
    expect(r.alerts).toHaveLength(1);
  });
});

describe('collateAlerts(draft, signals, turn, mode) (S12-3)', () => {
  it('week mode returns this turn’s blocking decisions; action mode returns none; P0 adds no message', () => {
    const s = produceState(BASE, (draft) => {
      draft.inbox.decisions['dec_000001' as DecId] = {
        id: 'dec_000001' as DecId,
        kind: 'test.blocking',
        ownerSection: 2,
        blocking: true,
        createdTurn: 0,
        deadlineTurn: 2,
        options: [{ id: 'a', labelKey: 'a', consequenceKey: 'a' }],
        context: { templateKey: 't', params: {}, subject: [] },
      };
      draft.inbox.decisionIds.push('dec_000001' as DecId);
    });
    let week: ReturnType<typeof collateAlerts> = [];
    let action: ReturnType<typeof collateAlerts> = [];
    const after = produceState(s, (draft) => {
      week = collateAlerts(draft, [signal()], 0, 'week');
      action = collateAlerts(draft, [signal()], 0, 'action');
    });
    expect(week).toEqual([{ ref: 'dec_000001', kind: 'decision', severity: 'blocking' }]);
    expect(action).toEqual([]);
    expect(after).toBe(s);
  });
});
