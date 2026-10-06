// <Num>, the popover and the drawer (DESIGN §13.13, 13.15, 13.19): keyboard opening with E, Esc closing with focus
// returned to the number, the drawer's tree expanded to ui.explainDefaultDepth, ledger and tuning chips, breadcrumbs,
// Copy as text, and redaction of hidden nodes in the rendered DOM.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { asAction, registerTestActions } from '../../engine/actions/testActions';
import { emptyWeekRecords, type CalcNode, type ExplainRef, type WeekReport } from '../../engine';
import { App } from '../app/App';
import { createHarness, loadState, type Harness } from '../testing/harness';

vi.setConfig({ testTimeout: 60_000 });

let unregister: () => void = () => undefined;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

function setup(): Harness {
  const h = createHarness();
  loadState(h.client);
  render(<App store={h.store} services={h.services} />);
  return h;
}

function topBarCash(): HTMLElement {
  return within(screen.getByRole('banner')).getByRole('button', { name: '$400,000' });
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('<Num>', () => {
  it('renders the formatted value as a focusable number with tabular figures', () => {
    setup();
    const num = topBarCash();
    expect(num.hasAttribute('data-num')).toBe(true);
    expect(num.getAttribute('aria-haspopup')).toBe('dialog');
    expect(num.tabIndex).toBe(0);
  });

  it('opens the popover on E and closes it on Esc, returning focus to the number', () => {
    setup();
    const num = topBarCash();
    num.focus();
    fireEvent.keyDown(num, { key: 'e' });
    const dialog = screen.getByRole('dialog', { name: 'Cash on hand' });
    expect(document.activeElement).toBe(dialog);
    // The value in the header and the one child row (cash.operating).
    expect(within(dialog).getAllByText('$400,000')).toHaveLength(2);
    expect(within(dialog).getByText('= cash.operating')).toBeTruthy();
    expect(within(dialog).getByText('cash.operating')).toBeTruthy();
    expect(within(dialog).getByText(/restricted cash is excluded/)).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(num);
  });

  it('opens on click and closes on a click elsewhere', () => {
    setup();
    fireEvent.click(topBarCash());
    expect(screen.getByRole('dialog', { name: 'Cash on hand' })).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores E with a modifier and other keys', () => {
    setup();
    const num = topBarCash();
    fireEvent.keyDown(num, { key: 'e', ctrlKey: true });
    fireEvent.keyDown(num, { key: 'x' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the drawer', () => {
  function openCashDrawer(): HTMLElement {
    fireEvent.click(topBarCash());
    fireEvent.click(screen.getByRole('button', { name: 'Open breakdown' }));
    return screen.getByRole('dialog', { name: 'Cash on hand' });
  }

  it('shows the tree expanded to ui.explainDefaultDepth and takes focus', () => {
    setup();
    const drawer = openCashDrawer();
    expect(document.activeElement?.textContent).toBe('Cash on hand');
    expect(drawer.querySelectorAll('[data-explain-node]').length).toBe(3);
    expect(within(drawer).getByText('Owner capital contribution')).toBeTruthy();
    // Collapsing a row hides its children.
    fireEvent.click(within(drawer).getByRole('button', { name: 'Collapse cash.operating' }));
    expect(within(drawer).queryByText('Owner capital contribution')).toBeNull();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Expand cash.operating' }));
    expect(within(drawer).getByText('Owner capital contribution')).toBeTruthy();
  });

  it('follows a ledger chip to the postings with exact cents, and walks back by the breadcrumbs', () => {
    setup();
    const drawer = openCashDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'ledger: txn_000001' }));
    const ledger = screen.getByRole('dialog', { name: /Company ledger · Y1 Wk 1/ });
    const table = within(ledger).getByRole('table');
    expect(within(table).getAllByText('$400,000.00').length).toBeGreaterThan(0);
    expect(within(table).getByText('eq.ownerCapital')).toBeTruthy();
    const crumbs = within(ledger).getByRole('navigation', { name: 'Explanation path' });
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Cash on hand' }));
    expect(screen.getByRole('dialog', { name: 'Cash on hand' })).toBeTruthy();
  });

  it('opens the cash ledger from Open ledger', () => {
    setup();
    const drawer = openCashDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Open ledger' }));
    const ledger = screen.getByRole('dialog', { name: 'Company ledger · cash.operating, cash.reserve' });
    expect(within(ledger).getByText('Net (debits less credits)')).toBeTruthy();
  });

  it('copies the tree as text', async () => {
    setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const drawer = openCashDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Copy as text' }));
    await within(drawer).findByText('Copied to the clipboard.');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Cash on hand  $400,000  Σ'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('[ledger: txn_000001]'));
  });

  it('opens a new explanation at ui.explainDefaultDepth, whatever was collapsed in the last one', () => {
    setup();
    const position = screen.getByRole('region', { name: 'Position' });
    const openNetWorth = (): HTMLElement => {
      fireEvent.click(within(position).getByRole('button', { name: '$520,000' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open breakdown' }));
      return screen.getByRole('dialog', { name: 'Owner net worth (scoring)' });
    };
    const freshNodes = openNetWorth().querySelectorAll('[data-explain-node]').length;
    expect(freshNodes).toBeGreaterThan(1);
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Owner net worth (scoring)' }), { key: 'Escape' });

    const cash = openCashDrawer();
    fireEvent.click(within(cash).getByRole('button', { name: 'Collapse Cash on hand' }));
    expect(cash.querySelectorAll('[data-explain-node]')).toHaveLength(1);
    const nw = openNetWorth();
    const toggle = within(nw).getByRole('button', { name: /Owner net worth \(scoring\)$/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(nw.querySelectorAll('[data-explain-node]')).toHaveLength(freshNodes);
  });

  it('shows ledger amounts in exact cents in the popover and drawer headers, as the ledger table does', () => {
    const h = setup();
    act(() => {
      h.client.apply(asAction({ type: 'test/transfer', cents: 4_512_307 }));
    });
    const ref: ExplainRef = { kind: 'ledger', filter: { book: 'company', accounts: ['cash.operating'] } };
    act(() => h.store.getState().openPopover({ ref, anchor: null }));
    const popover = screen.getByRole('dialog', { name: 'Company ledger · cash.operating' });
    expect(within(popover).getByText('$354,876.93')).toBeTruthy();
    expect(within(popover).getByText('$400,000.00')).toBeTruthy();
    expect(within(popover).getByText('−$45,123.07')).toBeTruthy();
    act(() => h.store.getState().openDrawer(ref, null));
    const drawer = screen.getByRole('dialog', { name: 'Company ledger · cash.operating' });
    expect(drawer.querySelector('tfoot td')?.textContent).toBe('$354,876.93');
    expect(within(drawer).getAllByText('$354,876.93')).toHaveLength(2);
  });

  it('closes on Esc and returns focus to the number that opened the popover', () => {
    setup();
    const num = topBarCash();
    const drawer = openCashDrawer();
    fireEvent.keyDown(drawer, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(num);
  });

  it('redacts hidden nodes and opens the tuning viewer from a tuning chip', () => {
    const h = setup();
    const tree: CalcNode = {
      label: 'Synthetic week',
      value: 1,
      unit: 'usd',
      op: 'sum',
      children: [
        { label: 'True grade', value: 0.0188, unit: 'ozPerBcy', hidden: true },
        {
          label: 'Parts resale factor',
          value: 0.5,
          unit: 'mult',
          source: { kind: 'tuning', key: 'game.nw.partsResaleFactor' },
        },
      ],
    };
    const report: WeekReport = {
      turn: 0,
      alerts: [],
      stopCandidates: [],
      ops: {},
      records: emptyWeekRecords(),
      calc: { 'test.tree': tree },
    };
    act(() => {
      h.store.getState().setGame({ calcReports: [report] });
      h.store.getState().openDrawer({ kind: 'report', turn: 0, path: ['test.tree'] }, null);
    });
    const drawer = screen.getByRole('dialog', { name: 'Synthetic week' });
    expect(within(drawer).getByText('Not observable')).toBeTruthy();
    expect(drawer.textContent).not.toContain('0.0188');
    fireEvent.click(within(drawer).getByRole('button', { name: 'tuning: game.nw.partsResaleFactor' }));
    const viewer = screen.getByRole('dialog', { name: 'game.nw.partsResaleFactor' });
    expect(viewer.querySelector('[data-tuning-viewer]')?.textContent).toMatch(/This game.*Base default/);
  });
});
