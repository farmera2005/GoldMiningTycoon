// Redaction (D-13.9), the formula line, Copy as text, and ref resolution against a real game (DESIGN §13.13): the
// cash explanation reaches the ledger (13.24 P0), ledger views carry exact cents, history and tuning refs resolve.
import { describe, expect, it, vi } from 'vitest';
import { asAction, registerTestActions } from '../../engine/actions/testActions';
import { advanceWeek, applyAction, type CalcNode, type GameState, type WeekReport } from '../../engine';
import { freshState } from '../testing/harness';
import { formulaText, opSymbol } from './formulaText';
import { accountMatches, describeLedgerFilter, findTxn, queryLedger } from './ledger';
import { NOT_OBSERVABLE, redact, walkView, type ViewNode } from './redact';
import { cashPostingsRef, cashRef, netWorthRef, relatedLedger } from './refs';
import { resolveExplain, type ResolveContext } from './resolve';
import { treeAsText, valueText } from './textTree';

vi.setConfig({ testTimeout: 60_000 });

/** A synthetic §7-like tree: contained gold from the true grade (hidden, with a knownAlt) and a hidden draw. */
const SYNTHETIC: CalcNode = {
  label: 'Gold to the box',
  value: 52.9,
  unit: 'oz',
  op: 'product',
  children: [
    {
      label: 'Contained gold',
      value: 61.2,
      unit: 'oz',
      op: 'product',
      hidden: true,
      note: 'true block grade 0.0188',
      children: [{ label: 'True grade', value: 0.0188, unit: 'ozPerBcy', hidden: true }],
      knownAlt: {
        label: 'Contained gold (your P50)',
        value: 55.0,
        unit: 'oz',
        op: 'product',
        children: [
          { label: 'Pay washed', value: 3264, unit: 'bcy' },
          { label: 'Your P50 grade', value: 0.0168, unit: 'ozPerBcy' },
        ],
      },
    },
    {
      label: 'Capture draw',
      value: 0.86,
      unit: 'pct',
      op: 'draw',
      hidden: true,
      source: { kind: 'rng', stream: 'ops-grade', key: [1043, 'clm_000012', 'blk_000001'] },
    },
    {
      label: 'Recovery at feed rate',
      value: 0.9,
      unit: 'pct',
      source: { kind: 'tuning', key: 'game.nw.partsResaleFactor' },
    },
  ],
};

describe('redact (D-13.9)', () => {
  const view = redact(SYNTHETIC);
  const nodes = [...walkView(view)].map((n) => n.node);

  it('replaces a hidden node by its knownAlt and drops the hidden subtree, note and source', () => {
    const contained = view.children[0] as ViewNode;
    expect(contained).toMatchObject({ label: 'Contained gold (your P50)', value: 55, redacted: 'knownAlt' });
    expect(contained.children.map((c) => c.label)).toEqual(['Pay washed', 'Your P50 grade']);
    expect(nodes.some((n) => n.label === 'True grade')).toBe(false);
    expect(nodes.some((n) => n.note === 'true block grade 0.0188')).toBe(false);
  });

  it('shows Not observable, with no value, source or children, when there is no knownAlt', () => {
    const draw = view.children[1] as ViewNode;
    expect(draw).toEqual({
      label: 'Capture draw',
      value: null,
      valueText: NOT_OBSERVABLE,
      unit: 'pct',
      children: [],
      redacted: 'notObservable',
    });
  });

  it('keeps visible nodes, their sources and their order', () => {
    expect(view.children[2]).toMatchObject({
      label: 'Recovery at feed rate',
      value: 0.9,
      source: { kind: 'tuning', key: 'game.nw.partsResaleFactor' },
    });
    expect(nodes.every((n) => n.value !== 61.2 && n.value !== 0.0188 && n.value !== 0.86)).toBe(true);
  });

  it('redacts hidden nodes inside a knownAlt too', () => {
    const tricky: CalcNode = {
      label: 'x',
      value: 1,
      unit: 'none',
      hidden: true,
      knownAlt: {
        label: 'alt',
        value: 2,
        unit: 'none',
        children: [{ label: 'leak', value: 3, unit: 'none', hidden: true }],
      },
    };
    expect(redact(tricky).children[0]).toMatchObject({ label: 'leak', value: null, redacted: 'notObservable' });
  });

  it('shows the raw tree, marked, only under the dev reveal', () => {
    const raw = redact(SYNTHETIC, { reveal: true });
    expect(raw.children[0]).toMatchObject({ label: 'Contained gold', value: 61.2, devHidden: true });
    expect(raw.children[0]?.children[0]).toMatchObject({ label: 'True grade', devHidden: true });
  });

  it('never puts truth into Copy as text', () => {
    const text = treeAsText(view);
    expect(text).not.toMatch(/True grade|61\.2|0\.0188|86\.0%/);
    expect(text).toContain('Capture draw  Not observable');
    expect(text).toContain('[tuning: game.nw.partsResaleFactor]');
  });
});

describe('formula line and op symbols (13.13)', () => {
  const leaf = (label: string): ViewNode => ({ label, value: 1, unit: 'usd', children: [] });
  it('joins child labels by the op', () => {
    expect(formulaText({ op: 'sum', children: ['Labor', 'Fuel', 'Camp'].map(leaf) })).toBe('= Labor + Fuel + Camp');
    expect(formulaText({ op: 'product', children: ['Hours', 'Rate'].map(leaf) })).toBe('= Hours × Rate');
    expect(formulaText({ op: 'ratio', children: ['Cost', 'Pay washed'].map(leaf) })).toBe('= Cost ÷ Pay washed');
    expect(formulaText({ op: 'min', children: ['Dig', 'Haul'].map(leaf) })).toBe('= min(Dig, Haul)');
    expect(formulaText({ op: 'clamp', children: ['x', 'lo', 'hi'].map(leaf) })).toBe('= clamp(x, lo, hi)');
    expect(formulaText({ op: 'draw', children: [] })).toBe('= random draw');
    expect(formulaText({ children: [leaf('a')] })).toBeNull();
    expect(formulaText({ op: 'sum', children: [] })).toBeNull();
  });

  it('names the first terms and counts the rest of a long sum', () => {
    const many = Array.from({ length: 9 }, (_, i) => leaf(`P${i + 1}`));
    expect(formulaText({ op: 'sum', children: many })).toBe('= P1 + P2 + P3 + P4 + P5 + … 4 more');
  });

  it('has a symbol for every op', () => {
    expect((['sum', 'product', 'ratio', 'min', 'max', 'lookup', 'draw', 'clamp'] as const).map(opSymbol)).toEqual([
      'Σ',
      '×',
      '÷',
      'min',
      'max',
      'lookup',
      'draw',
      'clamp',
    ]);
  });
});

describe('ledger view (cash → ledger)', () => {
  it('matches exact accounts and families', () => {
    expect(accountMatches('cash.operating', ['cash.'])).toBe(true);
    expect(accountMatches('cash.operating', ['cash.reserve'])).toBe(false);
    expect(accountMatches('eq.ownerCapital', undefined)).toBe(true);
  });

  it('lists the postings behind cash with exact cents, and their net equals cash on hand', () => {
    const unregister = registerTestActions();
    try {
      let s = freshState();
      const r = applyAction(s, asAction({ type: 'test/transfer', cents: 12_345_67 }));
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      const q = queryLedger(s, { book: 'company', accounts: ['cash.operating', 'cash.reserve'] });
      expect(q.rows.map((x) => [x.memo, x.account, x.debitCents, x.creditCents])).toEqual([
        ['Owner capital contribution', 'cash.operating', 40_000_000, 0],
        ['Test transfer', 'cash.reserve', 1_234_567, 0],
        ['Test transfer', 'cash.operating', 0, 1_234_567],
      ]);
      expect(q.netCents).toBe(40_000_000);
      expect(findTxn(s, q.rows[1]?.txnId ?? '')?.book).toBe('company');
      expect(describeLedgerFilter(s, { book: 'company', accounts: ['cash.operating'], fromTurn: 0, toTurn: 0 })).toBe(
        'Company ledger · cash.operating · Y1 Wk 1',
      );
    } finally {
      unregister();
    }
  });

  it('explains ledger amounts in exact cents, above $1,000 too (13.2 ledger rule, D-13.13)', () => {
    const unregister = registerTestActions();
    try {
      const r = applyAction(freshState(), asAction({ type: 'test/transfer', cents: 4_512_307 }));
      if (!r.ok) throw new Error(r.error.message);
      const ledger = resolveExplain(
        { kind: 'ledger', filter: { book: 'company', accounts: ['cash.operating'] } },
        { state: r.state, calcReports: [], reveal: false },
      );
      expect(valueText(ledger.root)).toBe('$354,876.93');
      expect(ledger.root.children.map((c) => valueText(c))).toEqual(['$400,000.00', '−$45,123.07']);
      const text = treeAsText(ledger.root);
      expect(text).toContain('Company ledger · cash.operating  $354,876.93  Σ');
      expect(text).toContain('Test transfer  −$45,123.07');
    } finally {
      unregister();
    }
  });
});

describe('resolveExplain', () => {
  const ctx = (state: GameState | null, calcReports: readonly WeekReport[] = []): ResolveContext => ({
    state,
    calcReports,
    reveal: false,
  });

  it('explains cash on hand down to its ledger transactions', () => {
    const r = resolveExplain(cashRef, ctx(freshState()));
    expect(r.kind).toBe('tree');
    expect(r.root).toMatchObject({ label: 'Cash on hand', value: 400_000, op: 'sum' });
    const leaf = r.root.children[0]?.children[0];
    expect(leaf).toMatchObject({
      label: 'Owner capital contribution',
      source: { kind: 'entity', ref: { kind: 'ledgerTxn' } },
    });
    expect(relatedLedger(cashRef)).toEqual({
      kind: 'ledger',
      filter: { book: 'company', accounts: ['cash.operating', 'cash.reserve'] },
    });
  });

  it('explains owner net worth (scoring)', () => {
    const r = resolveExplain(netWorthRef, ctx(freshState()));
    expect(r.root).toMatchObject({ label: 'Owner net worth (scoring)', value: 520_000 });
  });

  it('resolves ledger, history, tuning and report refs, and expires a report beyond retention', () => {
    const s0 = freshState();
    const week = advanceWeek(s0, { explain: true });
    const s1 = week.state;
    const ledger = resolveExplain(cashPostingsRef(0), ctx(s1));
    expect(ledger).toMatchObject({
      kind: 'ledger',
      root: { value: 40_000_000, unit: 'cents', fmt: { money: 'ledger' } },
    });
    const history = resolveExplain({ kind: 'history', metric: 'cashCents', turn: 1 }, ctx(s1));
    expect(history.root).toMatchObject({ label: 'Cash on hand at week end', value: 40_000_000, unit: 'cents' });
    expect(resolveExplain({ kind: 'history', metric: 'cashCents', turn: 999 }, ctx(s1))).toMatchObject({
      kind: 'unavailable',
      reason: 'EXPLAIN_EXPIRED',
    });
    const tuning = resolveExplain({ kind: 'tuning', key: 'game.startCalendarYear' }, ctx(s1));
    expect(tuning).toMatchObject({ kind: 'tuning', resolved: 2027, base: 2027, root: { value: 2027 } });
    const report = resolveExplain({ kind: 'report', turn: 1, path: ['finance.cashOnHand'] }, ctx(s1, [week.report]));
    expect(report.root).toMatchObject({ label: 'Cash on hand', value: 400_000 });
    expect(
      resolveExplain(
        { kind: 'report', turn: 1, path: ['finance.cashOnHand', 'cash.operating'] },
        ctx(s1, [week.report]),
      ).root,
    ).toMatchObject({ label: 'cash.operating' });
    expect(resolveExplain({ kind: 'report', turn: 1, path: ['finance.cashOnHand'] }, ctx(s1, []))).toMatchObject({
      kind: 'unavailable',
      reason: 'EXPLAIN_EXPIRED',
    });
  });

  it('answers without a game only for player inputs', () => {
    expect(resolveExplain(cashRef, ctx(null))).toMatchObject({ kind: 'unavailable', reason: 'NO_GAME' });
    expect(resolveExplain({ kind: 'input', label: 'Cash threshold', route: '#/settings' }, ctx(null))).toMatchObject({
      kind: 'input',
      route: '#/settings',
    });
  });
});
