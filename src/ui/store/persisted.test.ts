// UiPersisted (DESIGN §13.18, D-13.3, D-13.10, D-13.54; T22 inbox pruning): defaults from §13.25's ui.* keys,
// field-by-field reading of a save's block, and the save-time pruning and report cap.
import { describe, expect, it, vi } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { STOP_RULE_DEFAULTS, defaultStopRules, type GameState, type WeekReport } from '../../engine';
import { freshState } from '../testing/harness';
import {
  UI_PERSISTED_VERSION,
  defaultUiPersisted,
  jsonKb,
  persistedForSave,
  readUiPersisted,
  reportsToPersist,
  uiDefaultStopRules,
} from './persisted';

vi.setConfig({ testTimeout: 60_000 });

const report = (turn: number, pad = 0): WeekReport => ({
  turn,
  alerts: [],
  stopCandidates: [],
  ops: {},
  calc: pad === 0 ? {} : { big: { label: 'x'.repeat(pad), value: 0, unit: 'none' } },
});

describe('defaults', () => {
  it('starts with the 13.9 stop rules built from ui.runDeadlineNoticeWeeks and ui.runGoldMoveStopPct', () => {
    const p = defaultUiPersisted();
    expect(p.stopRules).toEqual(
      defaultStopRules({
        deadlineNoticeWeeks: uiConfig['ui.runDeadlineNoticeWeeks'],
        goldMoveStopPct: uiConfig['ui.runGoldMoveStopPct'],
      }),
    );
    expect(uiDefaultStopRules()).toEqual(defaultStopRules(STOP_RULE_DEFAULTS));
    expect(p).toMatchObject({
      inbox: {},
      tableLayouts: {},
      baselines: {},
      savedSearches: [],
      searchNotices: [],
      tutorial: { enabled: false, completed: [], dismissed: [] },
      recentReports: [],
      ironman: false,
      gameId: '',
      uiVersion: UI_PERSISTED_VERSION,
    });
  });
});

describe('readUiPersisted', () => {
  it('gives the defaults for a save with no UI block', () => {
    expect(readUiPersisted(undefined, 'lfallback')).toEqual(defaultUiPersisted({ gameId: 'lfallback' }));
    expect(readUiPersisted('junk', 'lfallback')).toEqual(defaultUiPersisted({ gameId: 'lfallback' }));
  });

  it('keeps a saved game id, and gives a v1 block (no id) or a damaged id the fallback (13.16)', () => {
    expect(readUiPersisted({ gameId: 'gabc123', uiVersion: 2 }, 'lfallback').gameId).toBe('gabc123');
    expect(readUiPersisted({ uiVersion: 1 }, 'lfallback').gameId).toBe('lfallback');
    expect(readUiPersisted({ gameId: 'a/b', uiVersion: 2 }, 'lfallback').gameId).toBe('lfallback');
    expect(readUiPersisted({ gameId: 7, uiVersion: 2 }, 'lfallback').gameId).toBe('lfallback');
  });

  it('keeps each good field and replaces each damaged one', () => {
    const p = readUiPersisted(
      {
        inbox: { msg_000001: { read: true, archived: 'no', snoozedUntilTurn: 7 }, msg_000002: 5 },
        stopRules: [{ kind: 'nonsense' }],
        tutorial: { enabled: true, completed: ['a', 3], dismissed: 'x' },
        ironman: true,
        tableLayouts: [],
        recentReports: [report(4), { turn: 'x' }],
        uiVersion: 0,
      },
      'lfallback',
    );
    expect(p.inbox).toEqual({ msg_000001: { read: true, archived: false, snoozedUntilTurn: 7 } });
    expect(p.stopRules).toEqual(uiDefaultStopRules());
    expect(p.tutorial).toEqual({ enabled: true, completed: ['a'], dismissed: [] });
    expect(p.ironman).toBe(true);
    expect(p.tableLayouts).toEqual({});
    expect(p.recentReports.map((r) => r.turn)).toEqual([4]);
    expect(p.uiVersion).toBe(UI_PERSISTED_VERSION);
  });

  it('round-trips its own output', () => {
    const p = { ...defaultUiPersisted({ ironman: true, gameId: 'g0123' }), recentReports: [report(2)] };
    expect(readUiPersisted(JSON.parse(JSON.stringify(p)), 'lother')).toEqual(p);
  });
});

describe('save-time form', () => {
  it('prunes inbox flags to messages still in state (T22)', () => {
    const state = freshState();
    const withMessage = {
      ...state,
      inbox: { ...state.inbox, messages: { msg_000002: {} } },
    } as unknown as GameState;
    const p = {
      ...defaultUiPersisted(),
      inbox: { msg_000001: { read: true, archived: false }, msg_000002: { read: false, archived: true } },
    } as ReturnType<typeof defaultUiPersisted>;
    expect(persistedForSave(p, withMessage, []).inbox).toEqual({ msg_000002: { read: false, archived: true } });
  });

  it('persists the newest ui.calcPersistWeeks report, and none above ui.persistReportMaxKb', () => {
    expect(reportsToPersist([report(3), report(2), report(1)]).map((r) => r.turn)).toEqual([3]);
    const big = report(9, uiConfig['ui.persistReportMaxKb'] * 1000 + 10);
    expect(jsonKb(big)).toBeGreaterThan(uiConfig['ui.persistReportMaxKb']);
    expect(reportsToPersist([big, report(8)])).toEqual([]);
  });
});
