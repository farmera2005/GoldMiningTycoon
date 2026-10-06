// P1 explain plumbing (DESIGN §13.13, §13.21 `ui/openExplain`; S13-5, S13-6): generic dispatch over the engine's
// typed explainer registry, report refs built only through the engine's calc-key builder, "Compare with last week",
// and EXPLAIN_EXPIRED with its history and ledger fallbacks (T26's reload case).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalcKeyError, emptyWeekRecords, explain, type CalcNode, type ExplainRef, type WeekReport } from '../../engine';
import { App } from '../app/App';
import { createHarness, freshState, loadState, type Harness } from '../testing/harness';
import { compareNodes, compareWithLastWeek, COMPARE_HIGHLIGHTS } from './compare';
import { openExplain } from './openExplain';
import { redact } from './redact';
import { cashPostingsRef, explainFallbacks, historyRef, liveRef, reportRef } from './refs';
import { isExplainer, resolveExplain } from './resolve';

vi.setConfig({ testTimeout: 60_000 });

function weekReport(turn: number, calc: Record<string, CalcNode>): WeekReport {
  return { turn, alerts: [], stopCandidates: [], ops: {}, records: emptyWeekRecords(), calc };
}

const KEY = 'ops/directCostPerBcy/clm_000012';

function costTree(labor: number, fuel: number, camp: number, extra?: number): CalcNode {
  const children: CalcNode[] = [
    { label: 'Labor incl. burden', value: labor, unit: 'usd' },
    { label: 'Fuel', value: fuel, unit: 'usd' },
    { label: 'Camp', value: camp, unit: 'usd' },
    { label: 'True grade', value: 0.0188, unit: 'ozPerBcy', hidden: true },
  ];
  if (extra !== undefined) children.push({ label: 'Site fixed', value: extra, unit: 'usd' });
  return {
    label: 'Direct operating cost',
    value: labor + fuel + camp + (extra ?? 0),
    unit: 'usd',
    op: 'sum',
    children,
  };
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('generic explainer dispatch (S13-5)', () => {
  it('reaches every explainer of the registry by name, or says it cannot', () => {
    const state = freshState();
    for (const name of Object.keys(explain)) {
      expect(isExplainer(name)).toBe(true);
      const r = resolveExplain(
        { kind: 'live', explainer: name as never, args: [] },
        {
          state,
          calcReports: [],
          reveal: false,
        },
      );
      expect(['tree', 'unavailable']).toContain(r.kind);
    }
    expect(resolveExplain(liveRef('cash'), { state, calcReports: [], reveal: false }).root).toMatchObject({
      value: 400_000,
    });
  });

  it('answers NOT_FOUND for a name the registry does not have (a stale ref), instead of throwing', () => {
    const r = resolveExplain(
      { kind: 'live', explainer: 'noSuchExplainer' as never, args: [] },
      {
        state: freshState(),
        calcReports: [],
        reveal: false,
      },
    );
    expect(r).toMatchObject({ kind: 'unavailable', reason: 'NOT_FOUND' });
  });
});

describe('report refs (S13-6)', () => {
  it('are built through the engine calc-key builder, then down the tree by labels', () => {
    expect(
      reportRef(5, { folder: 'ops', metric: 'directCostPerBcy', entityId: 'clm_000012', lineId: 'L1' }, 'Fuel'),
    ).toEqual({ kind: 'report', turn: 5, path: ['ops/directCostPerBcy/clm_000012/L1', 'Fuel'] });
    expect(() => reportRef(5, { folder: 'ops', metric: 'Bad Metric', entityId: 'clm_000012' })).toThrow(CalcKeyError);
  });
});

describe('compare with last week (13.13)', () => {
  it('pairs children by label, gives Δ and highlights the largest changes', () => {
    const cmp = compareNodes(redact(costTree(20_000, 8_000, 2_700, 750)), redact(costTree(19_000, 5_000, 2_600)));
    expect(cmp.delta).toBe(4_850);
    const rows = Object.fromEntries(cmp.children.map((c) => [c.label, c]));
    expect(rows['Fuel']).toMatchObject({ now: 8_000, before: 5_000, delta: 3_000, highlight: true });
    expect(rows['Labor incl. burden']).toMatchObject({ delta: 1_000, highlight: true });
    expect(rows['Camp']).toMatchObject({ delta: 100, highlight: true });
    expect(rows['Site fixed']).toMatchObject({ now: 750, before: null, delta: null, highlight: false });
    expect(cmp.children.filter((c) => c.highlight)).toHaveLength(COMPARE_HIGHLIGHTS);
    // Redaction first: the hidden child is Not observable on both sides, never a number.
    expect(rows['True grade']).toMatchObject({ now: null, before: null, delta: null });
  });

  it('finds the same path in the prior retained week, or reports it missing', () => {
    const ref: ExplainRef = { kind: 'report', turn: 6, path: [KEY] };
    const now = weekReport(6, { [KEY]: costTree(20_000, 8_000, 2_700) });
    const before = weekReport(5, { [KEY]: costTree(19_000, 5_000, 2_600) });
    expect(compareWithLastWeek(ref, [now, before])?.delta).toBe(4_100);
    expect(compareWithLastWeek(ref, [now])?.before).toBeNull();
    expect(compareWithLastWeek(ref, [])).toBeNull();
    expect(compareWithLastWeek(historyRef('cashCents', 1), [now])).toBeNull();
  });

  it('shows the comparison in the drawer behind a pressed toggle', () => {
    const h = createHarness();
    loadState(h.client);
    render(<App store={h.store} services={h.services} />);
    act(() => {
      h.store.getState().setGame({
        calcReports: [
          weekReport(6, { [KEY]: costTree(20_000, 8_000, 2_700) }),
          weekReport(5, { [KEY]: costTree(19_000, 5_000, 2_600) }),
        ],
      });
      h.store.getState().openDrawer({ kind: 'report', turn: 6, path: [KEY] }, null);
    });
    const drawer = screen.getByRole('dialog', { name: 'Direct operating cost' });
    const toggle = within(drawer).getByRole('button', { name: 'Compare with last week' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    const table = within(drawer).getByRole('table', { name: 'Compared with last week' });
    const fuel = within(table).getByRole('row', { name: /Fuel/ });
    expect(fuel.textContent).toContain('▲ +$3,000');
    expect(fuel.hasAttribute('data-changed-most')).toBe(true);
    expect(table.textContent).not.toContain('0.0188');
  });
});

describe('ui/openExplain and EXPLAIN_EXPIRED (13.21, T26)', () => {
  function setup(): Harness {
    const h = createHarness();
    loadState(h.client);
    render(<App store={h.store} services={h.services} />);
    return h;
  }

  it('opens a retained report and answers ok', () => {
    const h = setup();
    act(() => h.store.getState().setGame({ calcReports: [weekReport(0, { [KEY]: costTree(1, 2, 3) })] }));
    let result: ReturnType<typeof openExplain> | null = null;
    act(() => {
      result = openExplain(h.store, { kind: 'report', turn: 0, path: [KEY] }, { surface: 'drawer' });
    });
    expect(result).toEqual({ ok: true });
    expect(screen.getByRole('dialog', { name: 'Direct operating cost' })).toBeTruthy();
  });

  it('answers EXPLAIN_EXPIRED beyond retention, and the drawer offers the history value and the week’s ledger', () => {
    const h = setup();
    const ref = reportRef(0, { folder: 'ops', metric: 'payWashedBcy', entityId: 'clm_000012' });
    let result: ReturnType<typeof openExplain> | null = null;
    act(() => {
      result = openExplain(h.store, ref, { surface: 'drawer' });
    });
    expect(result).toEqual({
      ok: false,
      code: 'EXPLAIN_EXPIRED',
      fallbacks: [historyRef('payWashedBcy', 0), cashPostingsRef(0)],
    });
    const drawer = screen.getByRole('dialog', { name: 'Pay washed' });
    expect(drawer.textContent).toContain('is no longer kept');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Ledger for that week' }));
    expect(document.querySelector('[data-ledger-view]')).not.toBeNull();
  });

  it('falls back to the week’s cash when the report metric has no history series; nothing for other refs', () => {
    expect(explainFallbacks({ kind: 'report', turn: 3, path: [KEY] })).toEqual([
      historyRef('cashCents', 3),
      cashPostingsRef(3),
    ]);
    expect(explainFallbacks(historyRef('cashCents', 3))).toEqual([]);
  });
});
